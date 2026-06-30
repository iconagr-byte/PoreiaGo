"""Tenant onboarding factory — Stripe checkout → isolated tenant data plane."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subscription import Subscription, SubscriptionStatus
from app.models.tenant import Tenant, TenantPlan
from app.models.user import User
from app.services.audit_service import AuditService
from app.models.audit import AuditAction

from olympus.tenant.dedicated_db import provision_dedicated_database
from olympus.tenant.schema_provision import (
    provision_tenant_schema,
    schema_name_for_tenant,
)

logger = logging.getLogger(__name__)


class IsolationStrategy(str, Enum):
    SHARED_RLS = "shared_rls"
    SCHEMA = "schema"
    DATABASE = "database"


def slugify(value: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return (s[:48] or f"tenant-{uuid4().hex[:8]}")


class TenantProvisioningService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._audit = AuditService(session)

    async def provision_from_stripe(
        self,
        *,
        stripe_customer_id: str,
        stripe_subscription_id: str,
        plan: TenantPlan,
        legal_name: str,
        admin_email: str,
        admin_password_hash: str,
        subdomain_hint: str | None = None,
        trial_days: int = 14,
    ) -> Tenant:
        existing = await self._session.execute(
            select(Tenant).where(Tenant.stripe_customer_id == stripe_customer_id),
        )
        if existing.scalar_one_or_none():
            raise ValueError("Tenant already provisioned for this Stripe customer")

        slug = await self._unique_slug(subdomain_hint or legal_name)
        subdomain = slug
        isolation = (
            IsolationStrategy.DATABASE.value
            if plan == TenantPlan.ENTERPRISE
            else IsolationStrategy.SCHEMA.value
            if plan == TenantPlan.PROFESSIONAL
            else IsolationStrategy.SHARED_RLS.value
        )

        tenant = Tenant(
            id=uuid4(),
            slug=slug,
            legal_name=legal_name,
            subdomain=subdomain,
            plan=plan,
            is_active=True,
            stripe_customer_id=stripe_customer_id,
            isolation_strategy=isolation,
            settings_json='{"theme":{"primary":"#005d90"}}',
        )

        subscription = Subscription(
            id=uuid4(),
            tenant_id=tenant.id,
            stripe_subscription_id=stripe_subscription_id,
            status=SubscriptionStatus.TRIALING,
            plan=plan,
            trial_ends_at=datetime.now(timezone.utc) + timedelta(days=trial_days),
            metered_buses=True,
            metered_trips=True,
        )

        admin = User(
            id=uuid4(),
            tenant_id=tenant.id,
            email=admin_email.lower(),
            password_hash=admin_password_hash,
            full_name=legal_name,
            roles=["tenant_admin"],
            is_active=True,
        )

        self._session.add(tenant)
        self._session.add(subscription)
        self._session.add(admin)
        await self._session.flush()

        await self._run_migrations_for_tenant(tenant, isolation)
        await self._seed_default_roles(tenant.id)

        await self._audit.record(
            tenant_id=tenant.id,
            actor_id=None,
            actor_email="system@olympus",
            action=AuditAction.CREATE,
            resource_type="tenant",
            resource_id=str(tenant.id),
            detail=f"Provisioned via Stripe ({isolation})",
            after_state={"slug": slug, "plan": plan.value, "stripe_customer_id": stripe_customer_id},
        )

        logger.info("Provisioned tenant %s (%s)", tenant.slug, isolation)
        return tenant

    async def _unique_slug(self, base: str) -> str:
        slug = slugify(base)
        candidate = slug
        suffix = 0
        while True:
            result = await self._session.execute(
                select(Tenant.id).where(
                    or_(Tenant.slug == candidate, Tenant.subdomain == candidate),
                ).limit(1),
            )
            if not result.scalar_one_or_none():
                return candidate
            suffix += 1
            candidate = f"{slug}-{suffix}"[:48]

    async def _run_migrations_for_tenant(self, tenant: Tenant, isolation: str) -> None:
        if isolation == IsolationStrategy.SHARED_RLS.value:
            return
        if isolation == IsolationStrategy.SCHEMA.value:
            await provision_tenant_schema(self._session, tenant)
            logger.info("Schema %s ready for tenant %s", schema_name_for_tenant(tenant.slug), tenant.slug)
            return
        await provision_dedicated_database(self._session, tenant)

    async def _seed_default_roles(self, tenant_id: UUID) -> None:
        """Default RBAC templates — documented in tenant settings for admin onboarding."""
        from sqlalchemy import select

        result = await self._session.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if not tenant:
            return
        import json

        settings = {}
        if tenant.settings_json:
            try:
                settings = json.loads(tenant.settings_json)
            except json.JSONDecodeError:
                settings = {}
        settings["default_roles"] = ["tenant_admin", "dispatcher", "driver", "customer"]
        tenant.settings_json = json.dumps(settings, ensure_ascii=False)

    async def activate_subscription(self, tenant_id: UUID, stripe_status: str) -> None:
        result = await self._session.execute(
            select(Subscription).where(Subscription.tenant_id == tenant_id),
        )
        sub = result.scalar_one_or_none()
        if not sub:
            return
        try:
            sub.status = SubscriptionStatus(stripe_status)
        except ValueError:
            sub.status = SubscriptionStatus.ACTIVE
        if sub.status == SubscriptionStatus.ACTIVE:
            sub.trial_ends_at = None

    async def suspend_tenant(self, tenant_id: UUID, reason: str) -> None:
        result = await self._session.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if tenant:
            tenant.is_active = False
            await self._audit.record(
                tenant_id=tenant_id,
                actor_id=None,
                actor_email="billing@olympus",
                action=AuditAction.UPDATE,
                resource_type="tenant",
                resource_id=str(tenant_id),
                detail=f"Suspended: {reason}",
            )
