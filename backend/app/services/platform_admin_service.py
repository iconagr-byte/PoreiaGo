"""Super Admin — cross-tenant operations, health, provisioning."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

import redis.asyncio as aioredis
from sqlalchemy import bindparam, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.booking import Booking
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.tenant import Tenant, TenantPlan
from olympus.tenant.dedicated_db import provision_dedicated_database
from olympus.tenant.provisioning import IsolationStrategy
from olympus.tenant.schema_provision import provision_tenant_schema
from app.models.user import User, UserRole
from app.services.auth_service import hash_password
from app.services.billing_service import BillingService
from app.services.tenant_modules import (
    _heal_subscription_plan_column,
    _tenant_noload_options,
)

logger = logging.getLogger(__name__)

_PLAN_BASE_CENTS = {
    TenantPlan.STARTER: 9900,
    TenantPlan.PROFESSIONAL: 29900,
    TenantPlan.ENTERPRISE: 0,
    TenantPlan.RENT: 14900,
}

_SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$")
_DOMAIN_RE = re.compile(
    r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$",
)
_AFM_RE = re.compile(r"^\d{9}$")


def _parse_settings(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}


def _ops_from_settings(settings: dict[str, Any]) -> dict[str, str | None]:
    ops = settings.get("ops") if isinstance(settings.get("ops"), dict) else {}
    return {
        "contact_email": str(ops.get("contact_email") or "").strip() or None,
        "contact_phone": str(ops.get("contact_phone") or "").strip() or None,
        "admin_notes": str(ops.get("admin_notes") or "").strip() or None,
    }


def normalize_custom_domain(value: str | None) -> str | None:
    raw = str(value or "").strip().lower()
    if not raw:
        return None
    raw = re.sub(r"^https?://", "", raw)
    raw = raw.split("/")[0].split("?")[0].strip().rstrip(".")
    if raw.startswith("www."):
        # keep www-stripped canonical host for registry uniqueness
        candidate = raw[4:]
        if _DOMAIN_RE.match(candidate):
            raw = candidate
    if not _DOMAIN_RE.match(raw):
        raise ValueError("Invalid custom domain — use example.com (χωρίς https://)")
    return raw


def normalize_vat_number(value: str | None) -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if not _AFM_RE.match(digits):
        raise ValueError("Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία")
    return digits


async def _rls_off(session: AsyncSession) -> None:
    """Allow cross-tenant aggregates when the DB role permits it."""
    try:
        await session.execute(text("SET LOCAL row_security = off"))
    except Exception as exc:
        logger.debug("row_security off not available: %s", exc)


class PlatformAdminService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._settings = get_settings()

    async def health(self) -> dict:
        checks: dict[str, dict] = {}

        try:
            await self._session.execute(text("SELECT 1"))
            checks["postgres"] = {"status": "ok"}
        except Exception as exc:
            checks["postgres"] = {"status": "error", "detail": str(exc)[:200]}

        try:
            r = aioredis.from_url(self._settings.redis_url, decode_responses=True)
            pong = await r.ping()
            await r.aclose()
            checks["redis"] = {"status": "ok" if pong else "error"}
        except Exception as exc:
            checks["redis"] = {"status": "error", "detail": str(exc)[:200]}

        stripe_ok = bool(self._settings.stripe_secret_key)
        checks["stripe"] = {
            "status": "configured" if stripe_ok else "not_configured",
        }

        overall = "ok" if all(
            c.get("status") in ("ok", "configured", "not_configured")
            for c in checks.values()
        ) else "degraded"
        if checks.get("postgres", {}).get("status") == "error":
            overall = "down"

        return {
            "status": overall,
            "service": "project-saas-platform",
            "environment": self._settings.environment,
            "checks": checks,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }

    async def overview(self) -> dict:
        billing = {
            "mrr_cents": 0,
            "mrr_eur": 0.0,
            "total_tenants": 0,
            "active_tenants": 0,
            "trial_tenants": 0,
            "past_due_tenants": 0,
            "churn_rate_hint": 0.0,
        }
        try:
            billing = await BillingService(self._session).platform_analytics()
        except Exception:
            logger.exception("platform overview billing failed")
            try:
                await self._session.rollback()
            except Exception:
                pass

        health = {"status": "unknown"}
        try:
            health = await self.health()
        except Exception:
            logger.exception("platform overview health failed")

        recent_tenants: list[dict] = []
        try:
            recent = await self._session.execute(
                select(Tenant)
                .options(*_tenant_noload_options())
                .order_by(Tenant.created_at.desc())
                .limit(5),
            )
            recent_rows = list(recent.scalars().all())
            subs = await self._safe_subscription_maps([t.id for t in recent_rows])
            recent_tenants = [
                self._tenant_summary(t, subscription=subs.get(t.id)) for t in recent_rows
            ]
        except Exception:
            logger.exception("platform overview recent_tenants failed")
            try:
                await self._session.rollback()
            except Exception:
                pass
            recent_tenants = await self._list_tenants_raw_fallback(limit=5)

        await _rls_off(self._session)
        total_users = 0
        total_bookings = 0
        try:
            total_users = int(
                await self._session.scalar(select(func.count()).select_from(User)) or 0,
            )
        except Exception:
            logger.exception("platform overview total_users failed")
            try:
                await self._session.rollback()
            except Exception:
                pass
        try:
            total_bookings = int(
                await self._session.scalar(select(func.count()).select_from(Booking)) or 0,
            )
        except Exception:
            logger.exception("platform overview total_bookings failed")
            try:
                await self._session.rollback()
            except Exception:
                pass

        return {
            "health_status": health.get("status") or "unknown",
            "billing": billing,
            "total_users": total_users,
            "total_bookings": total_bookings,
            "recent_tenants": recent_tenants,
        }

    def _tenant_summary(self, tenant: Tenant, *, subscription: dict | None = None) -> dict:
        sub = subscription or {}
        plan = tenant.plan.value if hasattr(tenant.plan, "value") else str(tenant.plan or "starter")
        return {
            "id": str(tenant.id),
            "slug": tenant.slug or "",
            "legal_name": tenant.legal_name or tenant.slug or "Office",
            "plan": plan,
            "is_active": bool(tenant.is_active),
            "subscription_status": sub.get("status"),
            "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
        }

    async def _safe_subscription_maps(
        self,
        tenant_ids: list[UUID],
    ) -> dict[UUID, dict]:
        """
        Load subscription fields via raw SQL — never ORM SELECT *.

        Contabo DBs often miss subscriptions.plan; ORM mapping then 500s.
        """
        if not tenant_ids:
            return {}
        try:
            result = await self._session.execute(
                text(
                    """
                    SELECT tenant_id,
                           status,
                           stripe_subscription_id,
                           current_period_end,
                           trial_ends_at,
                           COALESCE(base_amount_cents, 0) AS base_amount_cents,
                           COALESCE(cancel_at_period_end, false) AS cancel_at_period_end
                    FROM subscriptions
                    WHERE tenant_id IN :ids
                    """
                ).bindparams(bindparam("ids", expanding=True)),
                {"ids": list(tenant_ids)},
            )
            out: dict[UUID, dict] = {}
            for row in result.mappings().all():
                tid = row["tenant_id"]
                if not isinstance(tid, UUID):
                    tid = UUID(str(tid))
                out[tid] = {
                    "status": str(row["status"] or ""),
                    "plan": "starter",
                    "stripe_subscription_id": row["stripe_subscription_id"],
                    "current_period_end": row["current_period_end"],
                    "trial_ends_at": row["trial_ends_at"],
                    "base_amount_cents": int(row["base_amount_cents"] or 0),
                    "cancel_at_period_end": bool(row["cancel_at_period_end"]),
                }
            return out
        except Exception:
            logger.exception("raw subscription load failed")
            try:
                await self._session.rollback()
            except Exception:
                pass
            # Best-effort heal, then retry once.
            try:
                await _heal_subscription_plan_column(self._session)
            except Exception:
                pass
            try:
                result = await self._session.execute(
                    text(
                        """
                        SELECT tenant_id, status
                        FROM subscriptions
                        WHERE tenant_id IN :ids
                        """
                    ).bindparams(bindparam("ids", expanding=True)),
                    {"ids": list(tenant_ids)},
                )
                out = {}
                for row in result.mappings().all():
                    tid = row["tenant_id"]
                    if not isinstance(tid, UUID):
                        tid = UUID(str(tid))
                    out[tid] = {
                        "status": str(row["status"] or ""),
                        "plan": "starter",
                        "stripe_subscription_id": None,
                        "current_period_end": None,
                        "trial_ends_at": None,
                        "base_amount_cents": 0,
                        "cancel_at_period_end": False,
                    }
                return out
            except Exception:
                logger.exception("raw subscription load still failing")
                try:
                    await self._session.rollback()
                except Exception:
                    pass
                return {}

    async def _list_tenants_raw_fallback(self, *, limit: int = 50, offset: int = 0) -> list[dict]:
        """Last-resort list when Tenant ORM mapping cannot load."""
        try:
            result = await self._session.execute(
                text(
                    """
                    SELECT id,
                           slug,
                           COALESCE(NULLIF(BTRIM(legal_name), ''), slug, 'Office') AS legal_name,
                           vat_number,
                           COALESCE(NULLIF(BTRIM(subdomain), ''), slug, 'office') AS subdomain,
                           custom_domain,
                           COALESCE(plan, 'starter') AS plan,
                           COALESCE(is_active, true) AS is_active,
                           stripe_customer_id,
                           created_at,
                           updated_at,
                           suspended_at,
                           suspended_reason
                    FROM tenants
                    ORDER BY created_at DESC NULLS LAST
                    OFFSET :offset LIMIT :limit
                    """
                ),
                {"offset": offset, "limit": limit},
            )
            items = []
            for row in result.mappings().all():
                items.append(
                    {
                        "id": row["id"],
                        "slug": row["slug"] or "",
                        "legal_name": row["legal_name"] or row["slug"] or "Office",
                        "vat_number": row["vat_number"],
                        "subdomain": row["subdomain"] or row["slug"] or "office",
                        "custom_domain": row["custom_domain"],
                        "plan": str(row["plan"] or "starter"),
                        "is_active": bool(row["is_active"]),
                        "stripe_customer_id": row["stripe_customer_id"],
                        "created_at": row["created_at"],
                        "updated_at": row["updated_at"],
                        "subscription": None,
                        "contact_email": None,
                        "contact_phone": None,
                        "admin_notes": None,
                        "suspended_at": row["suspended_at"],
                        "suspended_reason": row["suspended_reason"],
                        "domain_in_registry": bool(row["custom_domain"]),
                    }
                )
            return items
        except Exception:
            logger.exception("raw tenants fallback failed")
            try:
                await self._session.rollback()
            except Exception:
                pass
            return []

    async def list_tenants(
        self,
        *,
        offset: int = 0,
        limit: int = 50,
        q: str | None = None,
        is_active: bool | None = None,
        plan: TenantPlan | None = None,
        subscription_status: SubscriptionStatus | None = None,
    ) -> tuple[list[dict], int]:
        limit = min(max(limit, 1), 100)
        try:
            # Never selectinload(subscription): missing subscriptions.plan → HTTP 500.
            stmt = select(Tenant).options(*_tenant_noload_options())
            count_stmt = select(func.count()).select_from(Tenant)

            if q:
                pattern = f"%{q.strip()}%"
                filt = or_(
                    Tenant.slug.ilike(pattern),
                    Tenant.legal_name.ilike(pattern),
                    Tenant.subdomain.ilike(pattern),
                )
                stmt = stmt.where(filt)
                count_stmt = count_stmt.where(filt)

            if is_active is not None:
                stmt = stmt.where(Tenant.is_active.is_(is_active))
                count_stmt = count_stmt.where(Tenant.is_active.is_(is_active))

            if plan is not None:
                stmt = stmt.where(Tenant.plan == plan)
                count_stmt = count_stmt.where(Tenant.plan == plan)

            if subscription_status is not None:
                # Status-only join — do not pull Subscription ORM entities.
                stmt = stmt.join(Subscription, Subscription.tenant_id == Tenant.id).where(
                    Subscription.status == subscription_status,
                )
                count_stmt = count_stmt.join(
                    Subscription, Subscription.tenant_id == Tenant.id,
                ).where(Subscription.status == subscription_status)

            total = int(await self._session.scalar(count_stmt) or 0)
            result = await self._session.execute(
                stmt.order_by(Tenant.created_at.desc()).offset(offset).limit(limit),
            )
            tenants = list(result.scalars().unique().all())
            subs = await self._safe_subscription_maps([t.id for t in tenants])
            items = [
                self._tenant_detail(t, include_counts=False, subscription=subs.get(t.id))
                for t in tenants
            ]
            return items, total
        except Exception:
            logger.exception("ORM list_tenants failed — using raw SQL fallback")
            try:
                await self._session.rollback()
            except Exception:
                pass
            items = await self._list_tenants_raw_fallback(limit=limit, offset=offset)
            return items, len(items)

    async def get_tenant(self, tenant_id: UUID) -> dict | None:
        try:
            result = await self._session.execute(
                select(Tenant)
                .options(*_tenant_noload_options())
                .where(Tenant.id == tenant_id),
            )
            tenant = result.scalar_one_or_none()
            if not tenant:
                return None
            return await self._tenant_detail_async(tenant)
        except Exception:
            logger.exception("get_tenant ORM failed for %s", tenant_id)
            try:
                await self._session.rollback()
            except Exception:
                pass
            rows = await self._list_tenants_raw_fallback(limit=200, offset=0)
            for row in rows:
                if str(row.get("id")) == str(tenant_id):
                    return row
            return None

    async def _tenant_detail_async(self, tenant: Tenant) -> dict:
        subs = await self._safe_subscription_maps([tenant.id])
        detail = self._tenant_detail(
            tenant,
            include_counts=True,
            subscription=subs.get(tenant.id),
        )
        from app.core.auth_deps import apply_tenant_rls

        try:
            await apply_tenant_rls(self._session, tenant.id)
            detail["user_count"] = int(
                await self._session.scalar(
                    select(func.count()).select_from(User).where(User.tenant_id == tenant.id),
                )
                or 0,
            )
            detail["booking_count"] = int(
                await self._session.scalar(
                    select(func.count()).select_from(Booking).where(Booking.tenant_id == tenant.id),
                )
                or 0,
            )
        except Exception:
            logger.exception("tenant detail counts failed for %s", tenant.id)
            try:
                await self._session.rollback()
            except Exception:
                pass
            detail["user_count"] = detail.get("user_count") or 0
            detail["booking_count"] = detail.get("booking_count") or 0
        return detail

    def _tenant_detail(
        self,
        tenant: Tenant,
        *,
        include_counts: bool,
        subscription: dict | Subscription | None = None,
    ) -> dict:
        sub_map: dict | None
        if isinstance(subscription, Subscription):
            sub_map = {
                "status": subscription.status.value,
                "plan": (
                    subscription.plan.value
                    if hasattr(subscription.plan, "value")
                    else str(subscription.plan or "starter")
                ),
                "stripe_subscription_id": subscription.stripe_subscription_id,
                "current_period_end": subscription.current_period_end,
                "trial_ends_at": subscription.trial_ends_at,
                "base_amount_cents": subscription.base_amount_cents,
                "cancel_at_period_end": subscription.cancel_at_period_end,
            }
        else:
            sub_map = subscription

        ops = _ops_from_settings(_parse_settings(tenant.settings_json))
        plan_value = tenant.plan.value if hasattr(tenant.plan, "value") else str(tenant.plan or "starter")
        slug = (tenant.slug or "").strip() or "office"
        out = {
            "id": tenant.id,
            "slug": slug,
            "legal_name": (tenant.legal_name or "").strip() or slug,
            "vat_number": tenant.vat_number,
            "subdomain": (tenant.subdomain or "").strip() or slug,
            "custom_domain": tenant.custom_domain,
            "plan": plan_value,
            "is_active": bool(tenant.is_active),
            "stripe_customer_id": tenant.stripe_customer_id,
            "created_at": tenant.created_at,
            "updated_at": tenant.updated_at,
            "subscription": None,
            "contact_email": ops["contact_email"],
            "contact_phone": ops["contact_phone"],
            "admin_notes": ops["admin_notes"],
            "suspended_at": tenant.suspended_at,
            "suspended_reason": tenant.suspended_reason,
            "domain_in_registry": bool(tenant.custom_domain),
        }
        if sub_map:
            out["subscription"] = {
                "status": str(sub_map.get("status") or "trialing"),
                "plan": str(sub_map.get("plan") or plan_value),
                "stripe_subscription_id": sub_map.get("stripe_subscription_id"),
                "current_period_end": sub_map.get("current_period_end"),
                "trial_ends_at": sub_map.get("trial_ends_at"),
                "base_amount_cents": int(sub_map.get("base_amount_cents") or 0),
                "cancel_at_period_end": bool(sub_map.get("cancel_at_period_end")),
            }
        if include_counts:
            out["user_count"] = 0
            out["booking_count"] = 0
        return out

    async def provision_tenant(
        self,
        *,
        slug: str,
        legal_name: str,
        subdomain: str,
        plan: TenantPlan,
        admin_email: str,
        admin_password: str,
        admin_full_name: str,
        vat_number: str | None = None,
    ) -> tuple[Tenant, User]:
        slug = slug.strip().lower()
        subdomain = subdomain.strip().lower()
        if not _SLUG_RE.match(slug):
            raise ValueError("Invalid slug — use lowercase letters, numbers, hyphens")
        if not _SLUG_RE.match(subdomain):
            raise ValueError("Invalid subdomain")

        dup = await self._session.execute(
            select(Tenant.id).where(
                or_(Tenant.slug == slug, Tenant.subdomain == subdomain),
            ),
        )
        if dup.scalar_one_or_none():
            raise ValueError("Slug or subdomain already exists")

        tenant = Tenant(
            id=uuid4(),
            slug=slug,
            legal_name=legal_name.strip(),
            vat_number=vat_number,
            subdomain=subdomain,
            plan=plan,
            is_active=True,
            isolation_strategy=(
                IsolationStrategy.DATABASE.value
                if plan == TenantPlan.ENTERPRISE
                else IsolationStrategy.SCHEMA.value
                if plan == TenantPlan.PROFESSIONAL
                else IsolationStrategy.SHARED_RLS.value
            ),
        )
        self._session.add(tenant)
        await self._session.flush()

        self._session.add(
            Subscription(
                id=uuid4(),
                tenant_id=tenant.id,
                plan=plan,
                status=SubscriptionStatus.TRIALING,
                base_amount_cents=_PLAN_BASE_CENTS[plan],
                trial_ends_at=datetime.now(timezone.utc) + timedelta(days=14),
            ),
        )

        admin = User(
            id=uuid4(),
            tenant_id=tenant.id,
            email=admin_email.strip().lower(),
            password_hash=hash_password(admin_password),
            full_name=admin_full_name.strip(),
            roles=[UserRole.TENANT_ADMIN.value],
            is_active=True,
        )
        self._session.add(admin)
        await self._session.flush()
        if tenant.isolation_strategy == IsolationStrategy.SCHEMA.value:
            await provision_tenant_schema(self._session, tenant)
        elif tenant.isolation_strategy == IsolationStrategy.DATABASE.value:
            await provision_dedicated_database(self._session, tenant)
        logger.info("Provisioned tenant %s (%s)", tenant.slug, tenant.id)
        return tenant, admin

    async def update_tenant(
        self,
        tenant_id: UUID,
        *,
        legal_name: str | None = None,
        plan: TenantPlan | None = None,
        is_active: bool | None = None,
        vat_number: str | None = None,
        custom_domain: str | None = None,
        contact_email: str | None = None,
        contact_phone: str | None = None,
        admin_notes: str | None = None,
    ) -> Tenant | None:
        result = await self._session.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if not tenant:
            return None

        if legal_name is not None:
            tenant.legal_name = legal_name.strip()
        if plan is not None:
            tenant.plan = plan
            sub = await BillingService(self._session).get_subscription(tenant_id)
            if sub:
                sub.plan = plan
                sub.base_amount_cents = _PLAN_BASE_CENTS[plan]
        if is_active is not None:
            tenant.is_active = is_active
            if is_active:
                tenant.suspended_at = None
                tenant.suspended_reason = None
            elif not tenant.suspended_at:
                tenant.suspended_at = datetime.now(timezone.utc)
                tenant.suspended_reason = tenant.suspended_reason or "superadmin"
        if vat_number is not None:
            tenant.vat_number = normalize_vat_number(vat_number)
        if custom_domain is not None:
            clean = normalize_custom_domain(custom_domain)
            if clean:
                dup = await self._session.execute(
                    select(Tenant.id).where(
                        Tenant.custom_domain == clean,
                        Tenant.id != tenant_id,
                    ),
                )
                if dup.scalar_one_or_none():
                    raise ValueError("Το custom domain χρησιμοποιείται ήδη από άλλο γραφείο")
            tenant.custom_domain = clean

        if contact_email is not None or contact_phone is not None or admin_notes is not None:
            settings = _parse_settings(tenant.settings_json)
            ops = settings.get("ops") if isinstance(settings.get("ops"), dict) else {}
            if contact_email is not None:
                ops["contact_email"] = str(contact_email).strip().lower()
            if contact_phone is not None:
                ops["contact_phone"] = str(contact_phone).strip()
            if admin_notes is not None:
                ops["admin_notes"] = str(admin_notes).strip()
            settings["ops"] = ops
            tenant.settings_json = json.dumps(settings, ensure_ascii=False)

        return tenant

    async def suspend_tenant(self, tenant_id: UUID, *, reason: str = "superadmin") -> bool:
        billing = BillingService(self._session)
        result = await self._session.execute(select(Tenant.id).where(Tenant.id == tenant_id))
        if not result.scalar_one_or_none():
            return False
        await billing.suspend_tenant(tenant_id, reason=reason)
        sub = await billing.get_subscription(tenant_id)
        if sub and sub.status not in (SubscriptionStatus.CANCELED, SubscriptionStatus.PAST_DUE):
            sub.status = SubscriptionStatus.PAST_DUE
        return True

    async def reactivate_tenant(self, tenant_id: UUID) -> bool:
        billing = BillingService(self._session)
        result = await self._session.execute(select(Tenant.id).where(Tenant.id == tenant_id))
        if not result.scalar_one_or_none():
            return False
        await billing.reactivate_tenant(tenant_id)
        sub = await billing.get_subscription(tenant_id)
        if sub and sub.status == SubscriptionStatus.PAST_DUE:
            sub.status = SubscriptionStatus.ACTIVE
        return True
