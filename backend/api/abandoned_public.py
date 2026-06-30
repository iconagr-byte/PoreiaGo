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


@router.post("/carts", response_model=AbandonedCartResponse)
async def upsert_abandoned_cart(body: AbandonedCartUpsert):
    cart = upsert_cart(
        trip_id=body.trip_id,
        trip_title=body.trip_title,
        seats=body.seats,
        amount_eur=body.amount_eur,
        passenger_name=body.passenger_name,
        passenger_email=body.passenger_email or "",
        passenger_phone=body.passenger_phone or "",
        resume_token=body.resume_token,
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
