"""Public abandoned-cart tracking (B2C checkout)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from travel_platform.revenue.abandoned_carts import (
    get_by_resume_token,
    mark_completed,
    upsert_cart,
)
from schemas.platform_admin import AbandonedCartResponse, AbandonedCartUpsert

router = APIRouter(prefix="/api/abandoned", tags=["abandoned-cart"])


async def _host_tenant_id(request: Request) -> str:
    """Bind abandoned carts to the office that owns the Host (never cross-office)."""
    try:
        from middleware.domain_tenant import _is_platform_host, _request_host
        from travel_platform.settings.office_host_guard import (
            host_looks_like_achillio_travel,
            login_host_forced_tenant_id,
            resolve_poreiago_platform_tenant_id,
        )

        host = _request_host(request)
        if host_looks_like_achillio_travel(host):
            forced = await login_host_forced_tenant_id(host, is_platform_host=False)
            if forced is not None:
                return str(forced)
        if _is_platform_host(host):
            platform = await resolve_poreiago_platform_tenant_id()
            if platform:
                return str(platform)
        tid = getattr(request.state, "tenant_id", None)
        if tid:
            return str(tid)
    except Exception:
        pass
    return ""


@router.post("/carts", response_model=AbandonedCartResponse)
async def upsert_abandoned_cart(request: Request, body: AbandonedCartUpsert):
    cart = upsert_cart(
        trip_id=body.trip_id,
        trip_title=body.trip_title,
        seats=body.seats,
        amount_eur=body.amount_eur,
        passenger_name=body.passenger_name,
        passenger_email=body.passenger_email or "",
        passenger_phone=body.passenger_phone or "",
        resume_token=body.resume_token,
        tenant_id=await _host_tenant_id(request),
    )
    return AbandonedCartResponse(**cart.to_dict())


@router.get("/resume/{resume_token}", response_model=AbandonedCartResponse)
async def get_resume_cart(resume_token: str):
    cart = get_by_resume_token(resume_token)
    if not cart:
        raise HTTPException(status_code=404, detail="Η κράτηση δεν βρέθηκε ή έχει ολοκληρωθεί.")
    return AbandonedCartResponse(**cart.to_dict())


@router.post("/resume/{resume_token}/complete")
async def complete_abandoned_cart(resume_token: str):
    if not mark_completed(resume_token):
        raise HTTPException(status_code=404, detail="Cart not found")
    return {"ok": True}
