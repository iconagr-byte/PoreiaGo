"""Customer bookings API — sync My Wallet ↔ Control Panel."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.customer_auth import get_current_customer
from ticketing.customer_bookings import (
    get_booking,
    list_all_bookings,
    list_bookings_for_email,
    upsert_booking,
    upsert_many_for_customer,
)

router = APIRouter(tags=["Customer Bookings"])


class BookingSyncRequest(BaseModel):
    bookings: list[dict[str, Any]] = Field(default_factory=list)


class BookingUpsertRequest(BaseModel):
    booking: dict[str, Any]


@router.get("/api/customer/bookings")
async def my_bookings(account: dict = Depends(get_current_customer)):
    items = await list_bookings_for_email(account["email"])
    return {"items": items, "total": len(items)}


@router.post("/api/customer/bookings/sync")
async def sync_my_bookings(
    body: BookingSyncRequest,
    account: dict = Depends(get_current_customer),
):
    """Bulk upsert — client στέλνει τοπικές κρατήσεις, server επιστρέφει πλήρη λίστα."""
    try:
        items = await upsert_many_for_customer(
            account["email"],
            account.get("customer_id"),
            body.bookings,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"items": items, "total": len(items), "synced": len(body.bookings)}


@router.post("/api/customer/bookings")
async def upsert_my_booking(
    body: BookingUpsertRequest,
    account: dict = Depends(get_current_customer),
):
    try:
        saved = await upsert_booking(
            body.booking,
            customer_email=account["email"],
            customer_id=account.get("customer_id"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return saved


@router.get("/api/customer/bookings/{booking_id}")
async def get_my_booking(
    booking_id: str,
    account: dict = Depends(get_current_customer),
):
    booking = await get_booking(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if str(booking.get("email", "")).lower() != account["email"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return booking


@router.get("/api/customer/bookings/{booking_id}/track-link")
async def get_my_booking_track_link(
    booking_id: str,
    account: dict = Depends(get_current_customer),
):
    """Signed live-track URL for the passenger (map + ETA)."""
    booking = await get_booking(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if str(booking.get("email", "")).lower() != account["email"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    from travel_platform.telemetry.passenger_track_links import (
        build_passenger_track_link,
        enrich_booking_passenger_track,
        resolve_booking_tenant_id,
        resolve_booking_trip_id,
    )

    trip_id = resolve_booking_trip_id(booking)
    if not trip_id:
        raise HTTPException(status_code=400, detail="Booking has no trip")

    enriched = enrich_booking_passenger_track(dict(booking), force=True)
    link = build_passenger_track_link(
        trip_id=trip_id,
        tenant_id=resolve_booking_tenant_id(enriched),
    )
    if not link:
        raise HTTPException(status_code=503, detail="Track link unavailable")

    await upsert_booking(
        enriched,
        customer_email=account["email"],
        customer_id=account.get("customer_id"),
    )
    return {
        "trip_id": link["trip_id"],
        "tenant_id": link["tenant_id"],
        "token": link["token"],
        "path": link["path"],
        "url": link["url"],
        "expires_hours": link["expires_hours"],
    }


@router.get("/api/customer/bookings/{booking_id}/fiscal")
async def get_my_booking_fiscal(
    booking_id: str,
    account: dict = Depends(get_current_customer),
):
    """Fresh fiscal MARK / receipt status from Postgres (for wallet polling)."""
    cached = await get_booking(booking_id)
    if cached and str(cached.get("email", "")).lower() != account["email"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    from app.services.customer_booking_fiscal_service import CustomerBookingFiscalService

    try:
        fiscal = await CustomerBookingFiscalService().fetch_for_customer(
            booking_key=booking_id,
            customer_email=account["email"],
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Fiscal lookup failed: {exc}") from exc

    if cached:
        merged = {**cached, **fiscal}
        await upsert_booking(
            merged,
            customer_email=account["email"],
            customer_id=account.get("customer_id"),
        )
    return fiscal


@router.get("/api/bookings")
async def list_bookings_admin():
    """Όλες οι κρατήσεις — Control Panel (demo, ίδιο pattern με localStorage)."""
    items = await list_all_bookings()
    return {"items": items, "total": len(items)}
