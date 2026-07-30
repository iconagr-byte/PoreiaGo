"""Stripe billing API — checkout, portal, webhooks, usage."""

from __future__ import annotations

import json
import logging
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    BillingCheckoutRequest,
    BillingCheckoutResponse,
    BillingConfigResponse,
    BillingEnableRentAddonResponse,
    BillingPortalResponse,
    BillingSignupCheckoutRequest,
    BillingSubscriptionResponse,
    BillingTrialRequest,
    BillingUsageReportResponse,
    OfficeModulesResponse,
)
from app.core.auth_deps import get_current_tenant_id, get_tenant_db, require_roles
from app.core.database import AsyncSessionLocal
from app.models.tenant import Tenant, TenantPlan
from app.models.user import UserRole
from app.services.billing_service import BillingService, stripe_readiness
from app.services.tenant_modules import (
    enable_rent_addon_in_settings,
    initial_settings_for_plan,
    modules_for_tenant,
    parse_tenant_settings,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["SaaS Billing"])


async def _load_tenant(session: AsyncSession, tenant_id: UUID) -> Tenant:
    result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return tenant


@router.get("/config", response_model=BillingConfigResponse)
async def billing_config():
    """Public — whether Stripe checkout is ready (no secrets)."""
    data = stripe_readiness()
    return BillingConfigResponse(**data)


@router.get("/subscription", response_model=BillingSubscriptionResponse)
async def get_subscription(
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
):
    tenant = await _load_tenant(db, tenant_id)
    billing = BillingService(db)
    sub = await billing.get_or_create_subscription(tenant)
    return BillingSubscriptionResponse(
        tenant_id=tenant.id,
        plan=sub.plan.value,
        status=sub.status.value,
        is_active=tenant.is_active,
        stripe_customer_id=tenant.stripe_customer_id,
        stripe_subscription_id=sub.stripe_subscription_id,
        current_period_end=sub.current_period_end,
        trial_ends_at=sub.trial_ends_at,
        cancel_at_period_end=sub.cancel_at_period_end,
        base_amount_cents=sub.base_amount_cents,
    )


@router.get("/modules", response_model=OfficeModulesResponse)
async def get_office_modules(
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
):
    """Authenticated office product modules — drives Back Office nav for Rent-only."""
    tenant = await _load_tenant(db, tenant_id)
    return OfficeModulesResponse(**modules_for_tenant(tenant))


def _dump_settings(settings: dict[str, Any]) -> str:
    return json.dumps(settings, ensure_ascii=False)


@router.post("/enable-rent-addon", response_model=BillingEnableRentAddonResponse)
async def enable_rent_addon(
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    """Enable Rent module as add-on on the current bus office plan (keeps trips)."""
    tenant = await _load_tenant(db, tenant_id)
    if tenant.plan == TenantPlan.RENT:
        mods = modules_for_tenant(tenant)
        return BillingEnableRentAddonResponse(
            **mods,
            message="Το γραφείο είναι ήδη σε αυτόνομο Rent συμβόλαιο",
        )

    current = parse_tenant_settings(tenant.settings_json)
    updated = enable_rent_addon_in_settings(current)
    # Seed rent appearance defaults if missing.
    if not isinstance(updated.get("site_appearance"), dict):
        seeded = initial_settings_for_plan(TenantPlan.RENT, office_name=tenant.legal_name)
        appearance = seeded.get("site_appearance")
        if isinstance(appearance, dict):
            updated["site_appearance"] = appearance
    tenant.settings_json = _dump_settings(updated)
    await db.commit()
    await db.refresh(tenant)
    mods = modules_for_tenant(tenant)
    return BillingEnableRentAddonResponse(
        **mods,
        message="Το Rent add-on ενεργοποιήθηκε — εμφανίζεται το μενού Ενοικιάσεις",
    )


@router.post("/checkout-session", response_model=BillingCheckoutResponse)
async def create_checkout(
    body: BillingCheckoutRequest,
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    tenant = await _load_tenant(db, tenant_id)
    plan = TenantPlan(body.plan) if body.plan else tenant.plan
    try:
        result = await BillingService(db).create_checkout_session(
            tenant,
            plan=plan,
            billing_interval=body.billing_interval,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return BillingCheckoutResponse(**result)


@router.post("/start-trial", response_model=BillingSubscriptionResponse)
async def start_trial(
    body: BillingTrialRequest,
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    """Activate 14-day trial when Stripe is not configured on the server."""
    tenant = await _load_tenant(db, tenant_id)
    try:
        plan = TenantPlan(body.plan)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Invalid plan: {body.plan}") from exc
    try:
        sub = await BillingService(db).start_local_trial(
            tenant,
            plan=plan,
            billing_interval=body.billing_interval,
        )
        if plan == TenantPlan.RENT:
            current = parse_tenant_settings(tenant.settings_json)
            seeded = initial_settings_for_plan(TenantPlan.RENT, office_name=tenant.legal_name)
            merged = {**current, **seeded}
            # Keep existing site_appearance keys; fill gaps from rent seed.
            cur_app = current.get("site_appearance") if isinstance(current.get("site_appearance"), dict) else {}
            seed_app = seeded.get("site_appearance") if isinstance(seeded.get("site_appearance"), dict) else {}
            merged["site_appearance"] = {**seed_app, **cur_app}
            tenant.settings_json = _dump_settings(merged)
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return BillingSubscriptionResponse(
        tenant_id=tenant.id,
        plan=sub.plan.value,
        status=sub.status.value,
        is_active=tenant.is_active,
        stripe_customer_id=tenant.stripe_customer_id,
        stripe_subscription_id=sub.stripe_subscription_id,
        current_period_end=sub.current_period_end,
        trial_ends_at=sub.trial_ends_at,
        cancel_at_period_end=sub.cancel_at_period_end,
        base_amount_cents=sub.base_amount_cents,
    )


@router.post("/signup-checkout", response_model=BillingCheckoutResponse)
async def signup_checkout(body: BillingSignupCheckoutRequest):
    """Public SaaS signup — Stripe Checkout, or demo provision when demo_mode is on."""
    try:
        plan = TenantPlan(body.plan)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Invalid plan: {body.plan}") from exc

    readiness = stripe_readiness()
    use_demo = bool(readiness.get("demo_mode"))

    async with AsyncSessionLocal() as db:
        try:
            billing = BillingService(db)
            if use_demo:
                result = await billing.create_signup_demo_session(
                    legal_name=body.legal_name,
                    admin_email=str(body.admin_email),
                    subdomain=body.subdomain,
                    password=body.password,
                    plan=plan,
                    billing_interval=body.billing_interval,
                )
            else:
                result = await billing.create_signup_checkout_session(
                    legal_name=body.legal_name,
                    admin_email=str(body.admin_email),
                    subdomain=body.subdomain,
                    password=body.password,
                    plan=plan,
                    billing_interval=body.billing_interval,
                )
            await db.commit()
        except ValueError as exc:
            await db.rollback()
            detail = str(exc)
            code = status.HTTP_409_CONFLICT if "taken" in detail.lower() else status.HTTP_503_SERVICE_UNAVAILABLE
            raise HTTPException(code, detail=detail) from exc
        except Exception as exc:
            await db.rollback()
            logger.exception("Signup checkout failed")
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to start signup checkout",
            ) from exc
    return BillingCheckoutResponse(**result)


@router.post("/portal-session", response_model=BillingPortalResponse)
async def create_portal(
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    tenant = await _load_tenant(db, tenant_id)
    try:
        result = await BillingService(db).create_portal_session(tenant)
    except ValueError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return BillingPortalResponse(**result)


@router.post("/report-usage", response_model=BillingUsageReportResponse)
async def report_usage(
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    try:
        snap = await BillingService(db).report_usage_to_stripe(tenant_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return BillingUsageReportResponse(
        active_buses=snap.active_buses,
        monthly_trips=snap.monthly_trips,
        period_start=snap.period_start.isoformat(),
        reported_to_stripe=snap.reported_to_stripe_at is not None,
    )


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Stripe webhook — no JWT; verified via stripe-signature header."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    if not sig:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Missing stripe-signature")

    async with AsyncSessionLocal() as db:
        try:
            result = await BillingService(db).handle_webhook_event(payload, sig)
            await db.commit()
        except ValueError as exc:
            await db.rollback()
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        except Exception as exc:
            await db.rollback()
            logger.exception("Stripe webhook failed")
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Webhook processing failed") from exc
    return result

