"""Customer PWA fleet rental — catalog, availability, instant booking."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from api.customer_auth import get_current_customer
from travel_platform.rental import rental_store as store
from travel_platform.settings.drivers_store import DEMO_TENANT_ID

router = APIRouter(prefix="/api/customer/rentals", tags=["Customer Rentals"])


async def _tenant_id(request: Request) -> str:
    """Office scope for Wallet rentals — Host/middleware first, Origin fallback."""
    tid = getattr(request.state, "tenant_id", None)
    if tid:
        return str(tid)

    hosts: list[str] = []
    for header in ("x-forwarded-host", "host", "origin", "referer"):
        raw = (request.headers.get(header) or "").strip()
        if not raw:
            continue
        value = raw.split(",")[0].strip()
        if "://" in value:
            try:
                from urllib.parse import urlparse

                value = urlparse(value).hostname or ""
            except Exception:
                value = ""
        value = value.split(":")[0].strip().lower()
        if value and value not in hosts:
            hosts.append(value)

    try:
        from middleware.domain_tenant import _is_platform_host, _resolve_host_cached

        for host in hosts:
            if not host or _is_platform_host(host):
                continue
            resolved = await _resolve_host_cached(host)
            if resolved:
                request.state.tenant_id = resolved.tenant_id
                return str(resolved.tenant_id)
    except Exception:
        pass

    return DEMO_TENANT_ID


class CustomerBookingBody(BaseModel):
    vehicle_id: str
    start_time: str
    end_time: str
    pickup_location: str = Field(min_length=1, max_length=240)
    dropoff_location: str | None = None
    driver_mode: str = "SELF_DRIVE"
    client_phone: str | None = None
    notes: str | None = None


def _public_booking(row: dict) -> dict:
    return {
        "id": row["id"],
        "vehicle_id": row.get("vehicle_id"),
        "client_id": row.get("client_id"),
        "vehicle_plate": row.get("vehicle_plate"),
        "vehicle_model": row.get("vehicle_model"),
        "vehicle_category": row.get("vehicle_category"),
        "start_time": row.get("start_time"),
        "end_time": row.get("end_time"),
        "pickup_location": row.get("pickup_location"),
        "dropoff_location": row.get("dropoff_location"),
        "total_cost": row.get("total_cost"),
        "pricing": row.get("pricing"),
        "rental_status": row.get("rental_status"),
        "driver_mode": row.get("driver_mode"),
        "channel": row.get("channel"),
        "created_at": row.get("created_at"),
    }


@router.get("/catalog")
async def rental_catalog(
    request: Request,
    category: str | None = None,
    _: dict = Depends(get_current_customer),
):
    vehicles = store.public_catalog(await _tenant_id(request), category=category)
    return {"vehicles": vehicles, "count": len(vehicles)}


@router.get("/public/catalog")
async def rental_public_catalog(
    request: Request,
    category: str | None = None,
):
    """Public-only vehicle cards (guest preview, no auth).

    Booking/availability still requires customer auth.
    """
    vehicles = store.public_catalog(await _tenant_id(request), category=category)
    public = []
    for v in vehicles:
        public.append(
            {
                "id": v["id"],
                "category": v.get("category"),
                "model": v.get("model"),
                "seating_capacity": v.get("seating_capacity"),
                "daily_rate_eur": v.get("daily_rate_eur"),
                "one_way_surcharge_eur": v.get("one_way_surcharge_eur"),
                "with_driver_daily_eur": v.get("with_driver_daily_eur"),
                "photo_url": v.get("photo_url") or ((v.get("photo_urls") or [None])[0]),
                "photo_urls": list(v.get("photo_urls") or ([] if not v.get("photo_url") else [v.get("photo_url")])),
                "description": v.get("description"),
            }
        )
    return {"vehicles": public, "count": len(public)}


@router.get("/availability")
async def rental_availability(
    request: Request,
    start_time: str = Query(...),
    end_time: str = Query(...),
    category: str | None = None,
    min_seats: int | None = Query(default=None, ge=1, le=80),
    pickup_location: str | None = None,
    dropoff_location: str | None = None,
    driver_mode: str | None = None,
    _: dict = Depends(get_current_customer),
):
    try:
        rows = store.check_availability(
            await _tenant_id(request),
            start_time=start_time,
            end_time=end_time,
            category=category,
            min_seats=min_seats,
            pickup_location=pickup_location,
            dropoff_location=dropoff_location,
            driver_mode=driver_mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    # Strip internal notes from customer responses.
    public = []
    for r in rows:
        public.append(
            {
                "id": r["id"],
                "plate_number": r.get("plate_number"),
                "category": r.get("category"),
                "model": r.get("model"),
                "seating_capacity": r.get("seating_capacity"),
                "daily_rate_eur": r.get("daily_rate_eur"),
                "one_way_surcharge_eur": r.get("one_way_surcharge_eur"),
                "with_driver_daily_eur": r.get("with_driver_daily_eur"),
                "photo_url": r.get("photo_url") or ((r.get("photo_urls") or [None])[0]),
                "photo_urls": list(
                    r.get("photo_urls") or ([] if not r.get("photo_url") else [r.get("photo_url")])
                ),
                "description": r.get("description"),
                "suggested_days": r.get("suggested_days"),
                "base_total": r.get("base_total"),
                "driver_surcharge": r.get("driver_surcharge"),
                "one_way_surcharge": r.get("one_way_surcharge"),
                "suggested_total": r.get("suggested_total"),
                "is_one_way": r.get("is_one_way"),
                "driver_mode": r.get("driver_mode"),
            }
        )
    return {"vehicles": public, "count": len(public)}


@router.get("/bookings")
async def my_rental_bookings(
    request: Request,
    account: dict = Depends(get_current_customer),
):
    rows = store.list_bookings_for_email(await _tenant_id(request), account["email"])
    return {"bookings": [_public_booking(b) for b in rows], "total": len(rows)}


@router.post("/bookings")
async def book_rental(
    body: CustomerBookingBody,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    payload = {
        "vehicle_id": body.vehicle_id,
        "client_name": (account.get("name") or account["email"].split("@")[0]).strip(),
        "client_email": account["email"],
        "client_phone": body.client_phone or account.get("phone") or None,
        "client_id": account.get("customer_id"),
        "start_time": body.start_time,
        "end_time": body.end_time,
        "pickup_location": body.pickup_location.strip(),
        "dropoff_location": (body.dropoff_location or body.pickup_location).strip(),
        "driver_mode": body.driver_mode,
        "notes": body.notes,
        "channel": "WALLET",
    }
    try:
        row = store.create_booking(await _tenant_id(request), payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        from travel_platform.notifications.rental_booking_push import notify_rental_booking_to_office

        await notify_rental_booking_to_office(row)
    except Exception:
        # Booking must succeed even if office push fails.
        pass

    return _public_booking(row)


@router.post("/bookings/{booking_id}/cancel")
async def cancel_my_rental(
    booking_id: str,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    try:
        row = store.cancel_booking_for_customer(
            await _tenant_id(request),
            booking_id,
            email=account["email"],
        )
    except ValueError as exc:
        msg = str(exc)
        if "δεν βρέθηκε" in msg:
            raise HTTPException(status_code=404, detail=msg) from exc
        if "δικαίωμα" in msg:
            raise HTTPException(status_code=403, detail=msg) from exc
        raise HTTPException(status_code=400, detail=msg) from exc
    return _public_booking(row)
