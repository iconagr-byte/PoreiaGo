"""Stripe billing — checkout, webhooks, suspend/reactivate tenants."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

import stripe
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models.provisioning import ProvisioningJobStatus, TenantProvisioningJob
from app.models.subscription import Subscription, SubscriptionStatus, UsageSnapshot
from app.models.tenant import Tenant, TenantPlan
from app.services.auth_service import hash_password
from app.services.tenant_provisioning_service import TenantProvisioningServiceFacade
from app.services.usage_metering_service import UsageMeteringService

logger = logging.getLogger(__name__)

ACTIVE_SUBSCRIPTION_STATUSES = frozenset({
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.TRIALING,
})

SUSPEND_STATUSES = frozenset({
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.UNPAID,
    SubscriptionStatus.CANCELED,
})


def _stripe_client() -> stripe:
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise ValueError("STRIPE_SECRET_KEY is not configured")
    stripe.api_key = settings.stripe_secret_key
    return stripe


def _plan_price_id(plan: TenantPlan, *, billing_interval: str = "month") -> str:
    settings = get_settings()
    yearly = billing_interval == "year"
    mapping = {
        TenantPlan.STARTER: (
            settings.stripe_price_starter_yearly if yearly else settings.stripe_price_starter
        ),
        TenantPlan.PROFESSIONAL: (
            settings.stripe_price_professional_yearly if yearly else settings.stripe_price_professional
        ),
        TenantPlan.ENTERPRISE: (
            settings.stripe_price_enterprise_yearly if yearly else settings.stripe_price_enterprise
        ),
    }
    price_id = mapping.get(plan, "")
    if not price_id and yearly:
        mapping_monthly = {
            TenantPlan.STARTER: settings.stripe_price_starter,
            TenantPlan.PROFESSIONAL: settings.stripe_price_professional,
            TenantPlan.ENTERPRISE: settings.stripe_price_enterprise,
        }
        price_id = mapping_monthly.get(plan, "")
    if not price_id:
        raise ValueError(f"Stripe price not configured for plan: {plan.value}")
    return price_id


def _plan_base_cents(plan: TenantPlan, *, billing_interval: str = "month") -> int:
    monthly = {
        TenantPlan.STARTER: 9900,
        TenantPlan.PROFESSIONAL: 29900,
        TenantPlan.ENTERPRISE: 0,
    }.get(plan, 9900)
    if billing_interval == "year" and monthly:
        return monthly * 10
    return monthly


def _status_from_stripe(raw: str | None) -> SubscriptionStatus:
    try:
        return SubscriptionStatus(raw or "incomplete")
    except ValueError:
        return SubscriptionStatus.INCOMPLETE


def _ts_to_dt(ts: int | None) -> datetime | None:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc)


class BillingService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._settings = get_settings()

    async def get_subscription(self, tenant_id: UUID) -> Subscription | None:
        result = await self._session.execute(
            select(Subscription).where(Subscription.tenant_id == tenant_id),
        )
        return result.scalar_one_or_none()

    async def get_or_create_subscription(self, tenant: Tenant) -> Subscription:
        sub = await self.get_subscription(tenant.id)
        if sub:
            return sub
        sub = Subscription(
            id=uuid4(),
            tenant_id=tenant.id,
            plan=tenant.plan,
            status=SubscriptionStatus.TRIALING,
            base_amount_cents=_plan_base_cents(tenant.plan),
        )
        self._session.add(sub)
        await self._session.flush()
        return sub

    async def ensure_stripe_customer(self, tenant: Tenant) -> str:
        if tenant.stripe_customer_id:
            return tenant.stripe_customer_id
        _stripe_client()
        customer = stripe.Customer.create(
            name=tenant.legal_name,
            metadata={"tenant_id": str(tenant.id), "slug": tenant.slug},
        )
        tenant.stripe_customer_id = customer.id
        await self._session.flush()
        return customer.id

    async def create_checkout_session(
        self,
        tenant: Tenant,
        *,
        plan: TenantPlan | None = None,
        billing_interval: str = "month",
    ) -> dict:
        target_plan = plan or tenant.plan
        interval = billing_interval if billing_interval in ("month", "year") else "month"
        price_id = _plan_price_id(target_plan, billing_interval=interval)
        customer_id = await self.ensure_stripe_customer(tenant)
        sub = await self.get_or_create_subscription(tenant)
        sub.plan = target_plan
        sub.stripe_price_id = price_id
        sub.base_amount_cents = _plan_base_cents(target_plan, billing_interval=interval)

        _stripe_client()
        line_items = [{"price": price_id, "quantity": 1}]
        settings = self._settings
        if settings.stripe_price_metered_bus:
            line_items.append({"price": settings.stripe_price_metered_bus})
        if settings.stripe_price_metered_trip:
            line_items.append({"price": settings.stripe_price_metered_trip})

        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=line_items,
            success_url=settings.billing_success_url,
            cancel_url=settings.billing_cancel_url,
            client_reference_id=str(tenant.id),
            metadata={
                "tenant_id": str(tenant.id),
                "plan": target_plan.value,
                "billing_interval": interval,
            },
            subscription_data={
                "metadata": {
                    "tenant_id": str(tenant.id),
                    "plan": target_plan.value,
                    "billing_interval": interval,
                }
            },
        )
        return {"checkout_url": session.url, "session_id": session.id}

    async def create_signup_checkout_session(
        self,
        *,
        legal_name: str,
        admin_email: str,
        subdomain: str,
        password: str,
        plan: TenantPlan = TenantPlan.STARTER,
        billing_interval: str = "month",
    ) -> dict:
        """Public SaaS signup — creates provisioning job + Stripe Checkout (no existing tenant)."""
        subdomain_norm = subdomain.strip().lower()
        taken = await self._session.execute(
            select(Tenant.id).where(
                or_(Tenant.slug == subdomain_norm, Tenant.subdomain == subdomain_norm),
            ).limit(1),
        )
        if taken.scalar_one_or_none():
            raise ValueError("Subdomain already taken")

        interval = billing_interval if billing_interval in ("month", "year") else "month"
        price_id = _plan_price_id(plan, billing_interval=interval)
        isolation = (
            "database"
            if plan == TenantPlan.ENTERPRISE
            else "schema"
            if plan == TenantPlan.PROFESSIONAL
            else "shared_rls"
        )

        job = TenantProvisioningJob(
            id=uuid4(),
            status=ProvisioningJobStatus.PENDING.value,
            isolation_strategy=isolation,
            payload={
                "legal_name": legal_name.strip(),
                "admin_email": admin_email.lower().strip(),
                "subdomain": subdomain_norm,
                "plan": plan.value,
                "billing_interval": interval,
                "admin_password_hash": hash_password(password),
            },
        )
        self._session.add(job)
        await self._session.flush()

        _stripe_client()
        line_items = [{"price": price_id, "quantity": 1}]
        settings = self._settings
        if settings.stripe_price_metered_bus:
            line_items.append({"price": settings.stripe_price_metered_bus})
        if settings.stripe_price_metered_trip:
            line_items.append({"price": settings.stripe_price_metered_trip})

        session = stripe.checkout.Session.create(
            mode="subscription",
            customer_email=admin_email.lower().strip(),
            line_items=line_items,
            success_url=settings.billing_signup_success_url,
            cancel_url=settings.billing_signup_cancel_url,
            client_reference_id=str(job.id),
            metadata={
                "signup_flow": "true",
                "provisioning_job_id": str(job.id),
                "plan": plan.value,
                "billing_interval": interval,
                "subdomain": subdomain_norm,
            },
            subscription_data={
                "metadata": {
                    "provisioning_job_id": str(job.id),
                    "plan": plan.value,
                    "billing_interval": interval,
                    "subdomain": subdomain_norm,
                }
            },
        )
        job.status = ProvisioningJobStatus.CHECKOUT_STARTED.value
        job.stripe_checkout_session_id = session.id
        await self._session.flush()
        return {"checkout_url": session.url, "session_id": session.id}

    async def create_portal_session(self, tenant: Tenant) -> dict:
        customer_id = await self.ensure_stripe_customer(tenant)
        _stripe_client()
        portal = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=self._settings.billing_success_url,
        )
        return {"portal_url": portal.url}

    async def suspend_tenant(self, tenant_id: UUID, *, reason: str) -> None:
        result = await self._session.execute(
            select(Tenant).where(Tenant.id == tenant_id),
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            logger.warning("suspend_tenant: unknown tenant %s (%s)", tenant_id, reason)
            return
        tenant.is_active = False
        logger.info("Tenant suspended: %s (%s)", tenant.slug, reason)

    async def reactivate_tenant(self, tenant_id: UUID) -> None:
        result = await self._session.execute(
            select(Tenant).where(Tenant.id == tenant_id),
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            return
        tenant.is_active = True
        logger.info("Tenant reactivated: %s", tenant.slug)

    async def sync_subscription_from_stripe(
        self,
        tenant_id: UUID,
        stripe_sub: dict,
        *,
        plan_hint: str | None = None,
    ) -> Subscription:
        result = await self._session.execute(
            select(Tenant).where(Tenant.id == tenant_id),
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise ValueError(f"Unknown tenant {tenant_id}")

        sub = await self.get_or_create_subscription(tenant)
        sub.stripe_subscription_id = stripe_sub.get("id")
        sub.status = _status_from_stripe(stripe_sub.get("status"))
        sub.current_period_start = _ts_to_dt(stripe_sub.get("current_period_start"))
        sub.current_period_end = _ts_to_dt(stripe_sub.get("current_period_end"))
        sub.cancel_at_period_end = bool(stripe_sub.get("cancel_at_period_end"))
        sub.canceled_at = _ts_to_dt(stripe_sub.get("canceled_at"))
        sub.trial_ends_at = _ts_to_dt(stripe_sub.get("trial_end"))

        if plan_hint:
            try:
                sub.plan = TenantPlan(plan_hint)
                tenant.plan = sub.plan
            except ValueError:
                pass

        items = (stripe_sub.get("items") or {}).get("data") or []
        if items:
            sub.stripe_price_id = items[0].get("price", {}).get("id")

        if sub.status in ACTIVE_SUBSCRIPTION_STATUSES:
            await self.reactivate_tenant(tenant_id)
        elif sub.status in SUSPEND_STATUSES:
            await self.suspend_tenant(tenant_id, reason=f"subscription_{sub.status.value}")

        return sub

    async def report_usage_to_stripe(self, tenant_id: UUID) -> UsageSnapshot:
        result = await self._session.execute(
            select(Tenant)
            .options(selectinload(Tenant.subscription))
            .where(Tenant.id == tenant_id),
        )
        tenant = result.scalar_one_or_none()
        if not tenant or not tenant.subscription:
            raise ValueError("No subscription for tenant")

        sub = tenant.subscription
        if not sub.stripe_subscription_id:
            raise ValueError("Subscription not linked to Stripe")

        snap = await UsageMeteringService(self._session).snapshot_current_month(tenant_id)
        settings = self._settings
        if not settings.stripe_secret_key:
            return snap

        _stripe_client()
        stripe_sub = stripe.Subscription.retrieve(sub.stripe_subscription_id)
        items = stripe_sub.get("items", {}).get("data", [])
        bus_item = trip_item = None
        for item in items:
            price_id = item.get("price", {}).get("id")
            if price_id == settings.stripe_price_metered_bus:
                bus_item = item
            elif price_id == settings.stripe_price_metered_trip:
                trip_item = item

        record_ids: list[str] = []
        now = int(datetime.now(timezone.utc).timestamp())

        if bus_item and sub.metered_buses:
            rec = stripe.SubscriptionItem.create_usage_record(
                bus_item["id"],
                quantity=snap.active_buses,
                timestamp=now,
                action="set",
            )
            record_ids.append(rec.id)

        if trip_item and sub.metered_trips:
            rec = stripe.SubscriptionItem.create_usage_record(
                trip_item["id"],
                quantity=snap.monthly_trips,
                timestamp=now,
                action="set",
            )
            record_ids.append(rec.id)

        snap.reported_to_stripe_at = datetime.now(timezone.utc)
        snap.stripe_usage_record_ids = {"ids": record_ids}
        return snap

    async def handle_webhook_event(self, payload: bytes, sig_header: str) -> dict:
        if not self._settings.stripe_webhook_secret:
            raise ValueError("STRIPE_WEBHOOK_SECRET is not configured")
        _stripe_client()
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            self._settings.stripe_webhook_secret,
        )
        etype = event["type"]
        data = event["data"]["object"]

        if etype == "checkout.session.completed":
            await self._on_checkout_completed(data)
        elif etype == "customer.subscription.updated":
            await self._on_subscription_updated(data)
        elif etype == "customer.subscription.deleted":
            await self._on_subscription_deleted(data)
        elif etype == "invoice.paid":
            await self._on_invoice_paid(data)
        elif etype == "invoice.payment_failed":
            await self._on_invoice_payment_failed(data)
        else:
            logger.debug("Unhandled Stripe event: %s", etype)

        return {"received": True, "type": etype}

    async def _tenant_id_from_stripe_object(self, obj: dict) -> UUID | None:
        meta = obj.get("metadata") or {}
        tid = meta.get("tenant_id")
        if tid:
            try:
                return UUID(str(tid))
            except ValueError:
                pass
        ref = obj.get("client_reference_id")
        if ref:
            try:
                return UUID(str(ref))
            except ValueError:
                pass
        customer_id = obj.get("customer")
        if customer_id:
            result = await self._session.execute(
                select(Tenant).where(Tenant.stripe_customer_id == customer_id),
            )
            tenant = result.scalar_one_or_none()
            if tenant:
                return tenant.id
        return None

    async def _on_checkout_completed(self, session: dict) -> None:
        meta = session.get("metadata") or {}
        if meta.get("signup_flow") == "true":
            await self._on_signup_checkout_completed(session)
            return

        tenant_id = await self._tenant_id_from_stripe_object(session)
        if not tenant_id:
            return
        sub_id = session.get("subscription")
        if not sub_id:
            return
        _stripe_client()
        stripe_sub = stripe.Subscription.retrieve(sub_id)
        plan_hint = meta.get("plan")
        await self.sync_subscription_from_stripe(tenant_id, stripe_sub, plan_hint=plan_hint)

    async def _on_signup_checkout_completed(self, session: dict) -> None:
        meta = session.get("metadata") or {}
        job_id_raw = meta.get("provisioning_job_id") or session.get("client_reference_id")
        if not job_id_raw:
            logger.warning("Signup checkout completed without provisioning_job_id")
            return

        try:
            job_id = UUID(str(job_id_raw))
        except ValueError:
            logger.warning("Invalid provisioning_job_id: %s", job_id_raw)
            return

        result = await self._session.execute(
            select(TenantProvisioningJob).where(TenantProvisioningJob.id == job_id),
        )
        job = result.scalar_one_or_none()
        if not job:
            logger.warning("Unknown provisioning job %s", job_id)
            return

        stripe_customer_id = session.get("customer")
        stripe_sub_id = session.get("subscription")
        if not stripe_customer_id or not stripe_sub_id:
            job.status = ProvisioningJobStatus.FAILED.value
            job.error_message = "Missing Stripe customer or subscription"
            return

        if job.status == ProvisioningJobStatus.COMPLETED.value and job.tenant_id:
            _stripe_client()
            stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)
            await self.sync_subscription_from_stripe(
                job.tenant_id,
                stripe_sub,
                plan_hint=meta.get("plan"),
            )
            return

        existing = await self._session.execute(
            select(Tenant).where(Tenant.stripe_customer_id == stripe_customer_id),
        )
        existing_tenant = existing.scalar_one_or_none()
        if existing_tenant:
            job.tenant_id = existing_tenant.id
            job.status = ProvisioningJobStatus.COMPLETED.value
            job.completed_at = datetime.now(timezone.utc)
            job.stripe_checkout_session_id = session.get("id")
            _stripe_client()
            stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)
            await self.sync_subscription_from_stripe(
                existing_tenant.id,
                stripe_sub,
                plan_hint=meta.get("plan"),
            )
            return

        payload = job.payload or {}
        plan_raw = meta.get("plan") or payload.get("plan") or TenantPlan.STARTER.value
        try:
            plan = TenantPlan(plan_raw)
        except ValueError:
            plan = TenantPlan.STARTER

        provisioning = TenantProvisioningServiceFacade(self._session)
        try:
            tenant = await provisioning.provision_from_stripe_checkout(
                stripe_customer_id=stripe_customer_id,
                stripe_subscription_id=stripe_sub_id,
                plan=plan,
                legal_name=payload.get("legal_name") or meta.get("legal_name", "New Tenant"),
                admin_email=payload.get("admin_email") or session.get("customer_email", ""),
                admin_password_hash=payload.get("admin_password_hash", ""),
                subdomain_hint=payload.get("subdomain") or meta.get("subdomain"),
            )
        except ValueError as exc:
            job.status = ProvisioningJobStatus.FAILED.value
            job.error_message = str(exc)[:500]
            logger.warning("Signup provisioning failed for job %s: %s", job_id, exc)
            return
        except Exception as exc:
            job.status = ProvisioningJobStatus.FAILED.value
            job.error_message = str(exc)[:500]
            logger.exception("Signup provisioning error for job %s", job_id)
            raise

        job.tenant_id = tenant.id
        job.status = ProvisioningJobStatus.COMPLETED.value
        job.completed_at = datetime.now(timezone.utc)
        job.stripe_checkout_session_id = session.get("id")

        _stripe_client()
        stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)
        await self.sync_subscription_from_stripe(tenant.id, stripe_sub, plan_hint=plan.value)
        logger.info("Signup provisioning completed: tenant=%s job=%s", tenant.slug, job_id)

    async def _on_subscription_updated(self, stripe_sub: dict) -> None:
        tenant_id = await self._tenant_id_from_stripe_object(stripe_sub)
        if not tenant_id:
            return
        plan_hint = (stripe_sub.get("metadata") or {}).get("plan")
        await self.sync_subscription_from_stripe(tenant_id, stripe_sub, plan_hint=plan_hint)

    async def _on_subscription_deleted(self, stripe_sub: dict) -> None:
        tenant_id = await self._tenant_id_from_stripe_object(stripe_sub)
        if not tenant_id:
            return
        sub = await self.get_subscription(tenant_id)
        if sub:
            sub.status = SubscriptionStatus.CANCELED
            sub.canceled_at = datetime.now(timezone.utc)
        await self.suspend_tenant(tenant_id, reason="subscription_deleted")

    async def _on_invoice_paid(self, invoice: dict) -> None:
        tenant_id = await self._tenant_id_from_stripe_object(invoice)
        if not tenant_id:
            return
        sub_id = invoice.get("subscription")
        if sub_id:
            _stripe_client()
            stripe_sub = stripe.Subscription.retrieve(sub_id)
            await self.sync_subscription_from_stripe(tenant_id, stripe_sub)
        else:
            await self.reactivate_tenant(tenant_id)

    async def _on_invoice_payment_failed(self, invoice: dict) -> None:
        tenant_id = await self._tenant_id_from_stripe_object(invoice)
        if not tenant_id:
            return
        sub = await self.get_subscription(tenant_id)
        if sub:
            sub.status = SubscriptionStatus.PAST_DUE
        await self.suspend_tenant(tenant_id, reason="invoice_payment_failed")

    async def report_usage_for_all_tenants(self, *, stripe_only: bool = True) -> dict:
        """Batch metered usage — snapshots all tenants, pushes to Stripe when linked."""
        await UsageMeteringService(self._session).snapshot_all_tenants()

        stmt = select(Tenant.id).join(Subscription, Subscription.tenant_id == Tenant.id)
        if stripe_only:
            stmt = stmt.where(
                Subscription.stripe_subscription_id.isnot(None),
                Subscription.status.in_(list(ACTIVE_SUBSCRIPTION_STATUSES)),
            )

        result = await self._session.execute(stmt)
        tenant_ids = list(result.scalars().all())

        stats: dict = {
            "tenants_total": len(tenant_ids),
            "reported": 0,
            "snapshots_only": 0,
            "errors": [],
        }

        for tenant_id in tenant_ids:
            try:
                snap = await self.report_usage_to_stripe(tenant_id)
                if snap.reported_to_stripe_at:
                    stats["reported"] += 1
                else:
                    stats["snapshots_only"] += 1
            except ValueError as exc:
                stats["snapshots_only"] += 1
                stats["errors"].append({"tenant_id": str(tenant_id), "error": str(exc)})
            except Exception as exc:
                logger.exception("Usage report failed for tenant %s", tenant_id)
                stats["errors"].append({"tenant_id": str(tenant_id), "error": str(exc)[:200]})

        return stats

    async def platform_analytics(self) -> dict:
        """Super Admin — MRR snapshot & tenant counts."""
        total = await self._session.scalar(select(func.count()).select_from(Tenant))
        active_tenants = await self._session.scalar(
            select(func.count()).select_from(Tenant).where(Tenant.is_active.is_(True)),
        )
        trial_count = await self._session.scalar(
            select(func.count())
            .select_from(Subscription)
            .where(Subscription.status == SubscriptionStatus.TRIALING),
        )
        past_due = await self._session.scalar(
            select(func.count())
            .select_from(Subscription)
            .where(Subscription.status == SubscriptionStatus.PAST_DUE),
        )
        mrr_cents = await UsageMeteringService(self._session).mrr_estimate_cents()
        return {
            "mrr_cents": mrr_cents,
            "mrr_eur": round(mrr_cents / 100, 2),
            "total_tenants": int(total or 0),
            "active_tenants": int(active_tenants or 0),
            "trial_tenants": int(trial_count or 0),
            "past_due_tenants": int(past_due or 0),
            "churn_rate_hint": round(
                (int(past_due or 0) / max(int(active_tenants or 0), 1)) * 100,
                2,
            ),
        }
