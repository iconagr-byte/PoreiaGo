"""Stripe webhook → tenant factory (delegates to olympus.tenant.provisioning)."""

from __future__ import annotations

from app.models.tenant import Tenant, TenantPlan
from olympus.tenant.provisioning import TenantProvisioningService
from sqlalchemy.ext.asyncio import AsyncSession


class TenantProvisioningServiceFacade:
    """Application-layer entry for billing webhooks."""

    def __init__(self, session: AsyncSession) -> None:
        self._inner = TenantProvisioningService(session)

    async def provision_from_stripe_checkout(
        self,
        *,
        stripe_customer_id: str,
        stripe_subscription_id: str,
        plan: TenantPlan,
        legal_name: str,
        admin_email: str,
        admin_password_hash: str,
        subdomain_hint: str | None = None,
    ) -> Tenant:
        return await self._inner.provision_from_stripe(
            stripe_customer_id=stripe_customer_id,
            stripe_subscription_id=stripe_subscription_id,
            plan=plan,
            legal_name=legal_name,
            admin_email=admin_email,
            admin_password_hash=admin_password_hash,
            subdomain_hint=subdomain_hint,
        )

    async def activate_subscription(self, tenant_id, stripe_status: str) -> None:
        await self._inner.activate_subscription(tenant_id, stripe_status)

    async def suspend_tenant(self, tenant_id, reason: str) -> None:
        await self._inner.suspend_tenant(tenant_id, reason)
