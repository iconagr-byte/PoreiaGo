"""Super Admin platform API — tenants, health, MRR overview."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    AuditLogListResponse,
    AuditLogResponse,
    BillingAnalyticsResponse,
    PlatformHealthResponse,
    PlatformOverviewResponse,
    PlatformTenantCreateRequest,
    PlatformTenantCreateResponse,
    PlatformTenantListResponse,
    PlatformTenantSummary,
    PlatformTenantUpdateRequest,
    TokenResponse,
    UsageMeteringJobResponse,
)
from app.core.auth_deps import apply_tenant_rls, get_client_ip, get_current_user_id, get_platform_db, require_superadmin
from app.models.subscription import SubscriptionStatus
from app.models.tenant import TenantPlan
from app.services.billing_service import BillingService
from app.services.audit_service import AuditService, audit_log_to_dict
from app.services.platform_admin_service import PlatformAdminService
from app.api.olympus_platform import router as olympus_tls_router
from olympus.security.impersonation import ImpersonationService

router = APIRouter(prefix="/platform", tags=["Super Admin Platform"])
router.include_router(olympus_tls_router)


def _tenant_model(data: dict) -> PlatformTenantSummary:
    payload = dict(data or {})
    slug = str(payload.get("slug") or "office").strip() or "office"
    payload["slug"] = slug
    payload["legal_name"] = str(payload.get("legal_name") or "").strip() or slug
    payload["subdomain"] = str(payload.get("subdomain") or "").strip() or slug
    payload["plan"] = str(payload.get("plan") or "starter")
    payload["is_active"] = bool(payload.get("is_active", True))
    payload.setdefault("domain_in_registry", bool(payload.get("custom_domain")))
    try:
        return PlatformTenantSummary(**payload)
    except Exception as exc:
        # Never 500 the whole list because one row fails validation.
        raise ValueError(f"Invalid tenant payload for {slug}: {exc}") from exc


@router.get("/health", response_model=PlatformHealthResponse)
async def platform_health(
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    _: Annotated[None, Depends(require_superadmin)],
):
    data = await PlatformAdminService(db).health()
    return PlatformHealthResponse(**data)


@router.get("/overview", response_model=PlatformOverviewResponse)
async def platform_overview(
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    _: Annotated[None, Depends(require_superadmin)],
):
    try:
        data = await PlatformAdminService(db).overview()
        try:
            data["billing"] = BillingAnalyticsResponse(**(data.get("billing") or {}))
        except Exception:
            data["billing"] = BillingAnalyticsResponse(
                mrr_cents=0,
                mrr_eur=0.0,
                total_tenants=0,
                active_tenants=0,
                trial_tenants=0,
                past_due_tenants=0,
                churn_rate_hint=0.0,
            )
        return PlatformOverviewResponse(
            health_status=str(data.get("health_status") or "unknown"),
            billing=data["billing"],
            total_users=int(data.get("total_users") or 0),
            total_bookings=int(data.get("total_bookings") or 0),
            recent_tenants=list(data.get("recent_tenants") or []),
        )
    except Exception as exc:
        # Soft-fail — Super Admin UI must still open.
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Platform overview unavailable: {exc}",
        ) from exc


@router.get("/billing/analytics", response_model=BillingAnalyticsResponse)
async def billing_analytics(
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    _: Annotated[None, Depends(require_superadmin)],
):
    data = await BillingService(db).platform_analytics()
    return BillingAnalyticsResponse(**data)


@router.post("/billing/report-usage-all", response_model=UsageMeteringJobResponse)
async def report_usage_all(
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    _: Annotated[None, Depends(require_superadmin)],
    stripe_only: bool = Query(True, description="Only active/trialing Stripe subscriptions"),
):
    stats = await BillingService(db).report_usage_for_all_tenants(stripe_only=stripe_only)
    return UsageMeteringJobResponse(**stats)


@router.get("/tenants", response_model=PlatformTenantListResponse)
async def list_tenants(
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    _: Annotated[None, Depends(require_superadmin)],
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    q: str | None = Query(None, max_length=128),
    is_active: bool | None = None,
    plan: str | None = None,
    subscription_status: str | None = None,
):
    try:
        plan_enum = TenantPlan(plan) if plan else None
        status_enum = SubscriptionStatus(subscription_status) if subscription_status else None
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    try:
        items, total = await PlatformAdminService(db).list_tenants(
            offset=offset,
            limit=limit,
            q=q,
            is_active=is_active,
            plan=plan_enum,
            subscription_status=status_enum,
        )
        safe_items: list[PlatformTenantSummary] = []
        for row in items:
            try:
                safe_items.append(_tenant_model(row))
            except Exception:
                continue
        return PlatformTenantListResponse(
            items=safe_items,
            total=total,
            offset=offset,
            limit=limit,
        )
    except Exception as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Tenant list unavailable: {exc}",
        ) from exc


@router.get("/tenants/{tenant_id}", response_model=PlatformTenantSummary)
async def get_tenant(
    tenant_id: UUID,
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    _: Annotated[None, Depends(require_superadmin)],
):
    data = await PlatformAdminService(db).get_tenant(tenant_id)
    if not data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return _tenant_model(data)


@router.post("/tenants", response_model=PlatformTenantCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    body: PlatformTenantCreateRequest,
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    _: Annotated[None, Depends(require_superadmin)],
):
    try:
        tenant, admin = await PlatformAdminService(db).provision_tenant(
            slug=body.slug,
            legal_name=body.legal_name,
            subdomain=body.subdomain,
            plan=TenantPlan(body.plan),
            admin_email=body.admin_email,
            admin_password=body.admin_password,
            admin_full_name=body.admin_full_name,
            vat_number=body.vat_number,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    detail = await PlatformAdminService(db).get_tenant(tenant.id)
    return PlatformTenantCreateResponse(
        tenant=_tenant_model(detail or {}),
        admin_user_id=admin.id,
    )


@router.patch("/tenants/{tenant_id}", response_model=PlatformTenantSummary)
async def update_tenant(
    tenant_id: UUID,
    body: PlatformTenantUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    _: Annotated[None, Depends(require_superadmin)],
):
    plan = TenantPlan(body.plan) if body.plan else None
    try:
        tenant = await PlatformAdminService(db).update_tenant(
            tenant_id,
            legal_name=body.legal_name,
            plan=plan,
            is_active=body.is_active,
            vat_number=body.vat_number,
            custom_domain=body.custom_domain,
            contact_email=body.contact_email,
            contact_phone=body.contact_phone,
            admin_notes=body.admin_notes,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not tenant:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    try:
        from travel_platform.growth.traefik_domains import sync_traefik_custom_domains_from_db

        await sync_traefik_custom_domains_from_db(db)
    except Exception:
        pass
    data = await PlatformAdminService(db).get_tenant(tenant_id)
    return _tenant_model(data or {})


@router.post("/tenants/{tenant_id}/suspend")
async def suspend_tenant(
    tenant_id: UUID,
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    _: Annotated[None, Depends(require_superadmin)],
):
    ok = await PlatformAdminService(db).suspend_tenant(tenant_id)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return {"suspended": True, "tenant_id": str(tenant_id)}


@router.post("/tenants/{tenant_id}/reactivate")
async def reactivate_tenant(
    tenant_id: UUID,
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    _: Annotated[None, Depends(require_superadmin)],
):
    ok = await PlatformAdminService(db).reactivate_tenant(tenant_id)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return {"reactivated": True, "tenant_id": str(tenant_id)}


@router.post("/tenants/{tenant_id}/impersonate", response_model=TokenResponse)
async def impersonate_tenant(
    tenant_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    superadmin_id: Annotated[UUID, Depends(get_current_user_id)],
    _: Annotated[None, Depends(require_superadmin)],
):
    """SuperAdmin masquerade — short-lived JWT scoped to target tenant."""
    service = ImpersonationService(db)
    email = await service.resolve_superadmin_email(superadmin_id)
    client_ip = await get_client_ip(request)
    try:
        token = await service.start_impersonation(
            superadmin_id=superadmin_id,
            superadmin_email=email,
            target_tenant_id=tenant_id,
            client_ip=client_ip,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    tenant = await PlatformAdminService(db).get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return TokenResponse(
        access_token=token,
        tenant_id=tenant_id,
        tenant_slug=tenant.get("slug"),
        roles=["tenant_admin"],
    )


@router.get("/tenants/{tenant_id}/audit", response_model=AuditLogListResponse)
async def platform_tenant_audit(
    tenant_id: UUID,
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    _: Annotated[None, Depends(require_superadmin)],
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    resource_type: str | None = None,
):
    await apply_tenant_rls(db, tenant_id)
    entries, total = await AuditService(db).list_logs(
        tenant_id,
        resource_type=resource_type,
        limit=limit,
        offset=offset,
    )
    return AuditLogListResponse(
        items=[AuditLogResponse(**audit_log_to_dict(e)) for e in entries],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/integrations")
async def get_platform_integrations(
    _: Annotated[None, Depends(require_superadmin)],
):
    """Super-admin only — readiness flags, never plaintext secrets."""
    from travel_platform.integrations.secrets_store import public_status

    return public_status()


@router.put("/integrations")
async def upsert_platform_integrations(
    body: dict,
    _: Annotated[None, Depends(require_superadmin)],
):
    """
    Super-admin only — save Aviationstack / Twilio keys (encrypted at rest).
    Empty fields keep existing values. Pass clear_fields to wipe.
    """
    from travel_platform.integrations.secrets_store import public_status, save_secrets

    payload = body or {}
    clear_fields = payload.get("clear_fields") if isinstance(payload.get("clear_fields"), list) else []
    save_secrets(payload, clear_fields=clear_fields)
    return public_status()
