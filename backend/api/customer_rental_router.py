"""Customer PWA fleet rental — catalog, availability, booking + payment."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from api.customer_auth import get_current_customer
from travel_platform.rental import rental_store as store
from travel_platform.settings.drivers_store import DEMO_TENANT_ID

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/customer/rentals", tags=["Customer Rentals"])

_DATA_ROOT = Path(os.getenv("POREIAGO_DATA_DIR") or Path(__file__).resolve().parents[1] / "data")
_RENTAL_ID_DIR = _DATA_ROOT / "uploads" / "rental_id"
_MAX_DOC_BYTES = 4 * 1024 * 1024
_ID_KINDS = frozenset({"id_card", "driving_license"})


async def _tenant_id(request: Request, account: dict | None = None) -> str:
    """Office scope for Wallet rentals — JWT seal + Host; never spoof via Origin."""
    from api.customer_wallet_seal import resolve_sealed_wallet_tenant

    jwt_tid = None
    if account:
        jwt_tid = account.get("tenant_id")
    try:
        return await resolve_sealed_wallet_tenant(request, jwt_tid=jwt_tid)
    except HTTPException:
        # Preserve prior demo fallback for local rent catalog without JWT.
        import os

        env = os.getenv("ENVIRONMENT", "development").lower()
        if account is None and (
            env in ("development", "dev", "local")
            or os.getenv("ALLOW_DEMO_RENT_FALLBACK", "").lower() in ("1", "true", "yes")
        ):
            return DEMO_TENANT_ID
        raise


async def _require_rent_module(request: Request, account: dict | None = None) -> str:
    """Resolve tenant and block Rent APIs when the office has no active Rent contract."""
    tid = await _tenant_id(request, account)

    import os

    env = os.getenv("ENVIRONMENT", "development").lower()
    if tid == DEMO_TENANT_ID and env in ("development", "dev", "local"):
        return tid

    try:
        from app.core.database import AsyncSessionLocal
        from app.models.tenant import Tenant
        from app.services.tenant_modules import (
            is_poreiago_platform_office,
            modules_for_tenant,
        )
        from sqlalchemy import select

        async with AsyncSessionLocal() as session:
            row = await session.execute(select(Tenant).where(Tenant.id == UUID(str(tid))))
            tenant = row.scalar_one_or_none()
            if not tenant:
                raise HTTPException(
                    status_code=404,
                    detail="Οι ενοικιάσεις δεν είναι ενεργές για αυτό το γραφείο.",
                )
            slug = str(tenant.slug or tenant.subdomain or "").strip().lower()
            if slug:
                try:
                    request.state.tenant_slug = slug
                except Exception:
                    pass
            store.ensure_starter_rent_fleet(tid, slug=slug or None)
            if is_poreiago_platform_office(tenant):
                return tid
            mods = modules_for_tenant(tenant)
            if not mods.get("rent_enabled"):
                raise HTTPException(
                    status_code=404,
                    detail="Οι ενοικιάσεις δεν είναι ενεργές για αυτό το γραφείο.",
                )
    except HTTPException:
        raise
    except Exception:
        logger.exception("rent module guard failed for tenant_id=%s", tid)
        raise HTTPException(
            status_code=404,
            detail="Οι ενοικιάσεις δεν είναι ενεργές για αυτό το γραφείο.",
        ) from None

    return tid

class CustomerBookingExtras(BaseModel):
    extra_insurance: bool = False
    scdw: bool = False
    child_seat: bool = False
    gps_pack: bool = False
    airport_pickup: bool = False
    young_driver: bool = False


class CustomerBookingBody(BaseModel):
    vehicle_id: str
    start_time: str
    end_time: str
    pickup_location: str = Field(min_length=1, max_length=240)
    dropoff_location: str | None = None
    driver_mode: str = "SELF_DRIVE"
    client_phone: str | None = None
    client_afm: str | None = None
    notes: str | None = None
    extras: list[str] = Field(default_factory=list)
    marketing_email: bool = False
    marketing_sms: bool = False
    payment_method: str | None = None
    payment_plan: str | None = None
    deposit_percent: int | None = None
    amount_paid: float | None = None
    balance_due: float | None = None
    payment_status: str | None = None
    total_cost: float | None = None


class GuestRentalLookupBody(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    reference: str | None = Field(default=None, max_length=120)
    booking_code: str | None = Field(default=None, max_length=120)
    code: str | None = Field(default=None, max_length=120)


class ModifyBookingBody(BaseModel):
    start_time: str
    end_time: str
    pickup_location: str | None = None
    dropoff_location: str | None = None


class ReviewBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


class PickupChecklistBody(BaseModel):
    tires_ok: bool = False
    lights_ok: bool = False
    fluids_ok: bool = False
    documents_ok: bool = False
    spare_wheel_ok: bool = False
    damages_noted: bool = False


class CustomerInspectionBody(BaseModel):
    # Soft Wallet /public/demo-check-in always means pickup; default keeps older clients working.
    inspection_type: str = "PICKUP_CHECK"
    fuel_level: float = Field(default=100, ge=0, le=100)
    mileage: int = Field(default=0, ge=0)
    damage_notes: str | None = None
    photo_urls: list[str] = Field(default_factory=list)
    signature_url: str | None = None
    checklist: PickupChecklistBody | None = None


class SosBody(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)
    note: str | None = Field(default=None, max_length=500)


class LocationBody(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)


def _guest_booking_view(row: dict) -> dict:
    """Masked booking payload for guest surname check-in lookup/confirm."""
    base = _public_booking(row)
    name = str(row.get("client_name") or "").strip()
    if name:
        parts = name.split()
        masked = " ".join(
            (p[0] + "…" if len(p) > 1 else p) for p in parts[:2]
        )
        base["client_name_masked"] = masked
    else:
        base["client_name_masked"] = "—"
    return base


def _public_booking(row: dict) -> dict:
    eligible = store.free_cancel_eligible(row)
    hours = None
    try:
        hours = round(store.hours_until_start(row.get("start_time") or ""), 1)
    except Exception:
        hours = None
    return {
        "id": row["id"],
        "reference_code": store._booking_reference_code(row),
        "vehicle_id": row.get("vehicle_id"),
        "client_id": row.get("client_id"),
        "client_afm": row.get("client_afm"),
        "vehicle_plate": row.get("vehicle_plate"),
        "vehicle_model": row.get("vehicle_model"),
        "vehicle_category": row.get("vehicle_category"),
        "start_time": row.get("start_time"),
        "end_time": row.get("end_time"),
        "pickup_location": row.get("pickup_location"),
        "dropoff_location": row.get("dropoff_location"),
        "total_cost": row.get("total_cost"),
        "pricing": row.get("pricing"),
        "extras": list(row.get("extras") or []),
        "rental_status": row.get("rental_status"),
        "driver_mode": row.get("driver_mode"),
        "channel": row.get("channel"),
        "marketing_email": bool(row.get("marketing_email")),
        "marketing_sms": bool(row.get("marketing_sms")),
        "payment_method": row.get("payment_method"),
        "payment_plan": row.get("payment_plan"),
        "deposit_percent": row.get("deposit_percent"),
        "amount_paid": row.get("amount_paid"),
        "balance_due": row.get("balance_due"),
        "payment_status": row.get("payment_status"),
        "created_at": row.get("created_at"),
        "modified_at": row.get("modified_at"),
        "online_checkin_ready": bool(row.get("online_checkin_ready")),
        "online_checkin_at": row.get("online_checkin_at"),
        "free_cancel_eligible": bool(eligible),
        "hours_until_start": hours,
    }


def _public_vehicle_row(r: dict) -> dict:
    return {
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


@router.get("/catalog")
async def rental_catalog(
    request: Request,
    category: str | None = None,
    account: dict = Depends(get_current_customer),
):
    tid = await _require_rent_module(request, account)
    slug = str(getattr(request.state, "tenant_slug", None) or "").strip().lower() or None
    vehicles = store.public_catalog(tid, category=category, slug=slug)
    return {"vehicles": vehicles, "count": len(vehicles), "tenant_id": tid}


@router.post("/public/lookup")
async def rental_public_lookup(request: Request, body: GuestRentalLookupBody):
    """Guest rental booking lookup by email + RB-… reference (no auth)."""
    email = str(body.email or "").strip().lower()
    reference = str(body.reference or body.booking_code or body.code or "").strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Απαιτείται έγκυρο email κράτησης")
    if not reference or len(reference) < 4:
        raise HTTPException(status_code=400, detail="Απαιτείται κωδικός αναφοράς (π.χ. RB-…)")
    row = store.lookup_booking_for_guest(
        await _require_rent_module(request),
        email=email,
        reference=reference,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Δεν βρέθηκε κράτηση ενοικίασης με αυτά τα στοιχεία")
    return {"ok": True, "booking": _public_booking(row)}


@router.post("/public/lookup")
async def rental_public_lookup(request: Request, body: GuestRentalLookupBody):
    """Guest rental booking lookup by email + RB-… reference (no auth)."""
    email = str(body.email or "").strip().lower()
    reference = str(body.reference or body.booking_code or body.code or "").strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Απαιτείται έγκυρο email κράτησης")
    if not reference or len(reference) < 4:
        raise HTTPException(status_code=400, detail="Απαιτείται κωδικός αναφοράς (π.χ. RB-…)")
    row = store.lookup_booking_for_guest(
        await _tenant_id(request),
        email=email,
        reference=reference,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Δεν βρέθηκε κράτηση ενοικίασης με αυτά τα στοιχεία")
    return {"ok": True, "booking": _public_booking(row)}


@router.get("/public/catalog")
async def rental_public_catalog(
    request: Request,
    category: str | None = None,
):
    """Public-only vehicle cards (guest preview, no auth).

    Booking/availability still requires customer auth.
    """
    tid = await _require_rent_module(request)
    slug = str(getattr(request.state, "tenant_slug", None) or "").strip().lower() or None
    vehicles = store.public_catalog(tid, category=category, slug=slug)
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


@router.get("/public/extras")
async def rental_public_extras(request: Request):
    """Office-bookable extras catalog (tenant from Host)."""
    _ = await _require_rent_module(request)
    items = [
        {
            "id": key,
            "title": spec["title"],
            "eur_per_day": spec["eur_per_day"],
        }
        for key, spec in store.EXTRAS_CATALOG.items()
    ]
    return {"extras": items, "count": len(items)}


async def _availability_payload(
    request: Request,
    *,
    start_time: str,
    end_time: str,
    category: str | None,
    min_seats: int | None,
    pickup_location: str | None,
    dropoff_location: str | None,
    driver_mode: str | None,
    account: dict | None = None,
) -> dict:
    try:
        tid = await _require_rent_module(request, account)
        rows = store.check_availability(
            tid,
            start_time=start_time,
            end_time=end_time,
            category=category,
            min_seats=min_seats,
            pickup_location=pickup_location,
            dropoff_location=dropoff_location,
            driver_mode=driver_mode,
            branch=branch,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    public = [_public_vehicle_row(r) for r in rows]
    return {"vehicles": public, "count": len(public), "tenant_id": tid}


@router.get("/public/availability")
async def rental_public_availability(
    request: Request,
    start_time: str = Query(...),
    end_time: str = Query(...),
    category: str | None = None,
    min_seats: int | None = Query(default=None, ge=1, le=80),
    pickup_location: str | None = None,
    dropoff_location: str | None = None,
    driver_mode: str | None = None,
):
    """Guest availability for office fleet (no auth) — dates from search bar."""
    return await _availability_payload(
        request,
        start_time=start_time,
        end_time=end_time,
        category=category,
        min_seats=min_seats,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        driver_mode=driver_mode,
    )


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
    account: dict = Depends(get_current_customer),
):
    return await _availability_payload(
        request,
        start_time=start_time,
        end_time=end_time,
        category=category,
        min_seats=min_seats,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        driver_mode=driver_mode,
        account=account,
    )


class GuestCheckinBody(BaseModel):
    surname: str = Field(min_length=2, max_length=120)
    reference_code: str = Field(min_length=4, max_length=40)


@router.post("/public/check-in/lookup")
async def guest_rental_checkin_lookup(body: GuestCheckinBody, request: Request):
    """Guest online check-in lookup — surname + RN- code, office tenant from Host."""
    row = store.guest_lookup_booking(
        await _tenant_id(request),
        surname=body.surname,
        reference_code=body.reference_code,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Δεν βρέθηκε κράτηση με αυτά τα στοιχεία")
    return {"booking": _guest_booking_view(row)}


@router.post("/public/check-in")
async def guest_rental_checkin(body: GuestCheckinBody, request: Request):
    """Confirm online check-in for a rental booking (desk sees ready flag)."""
    try:
        row = store.guest_online_checkin(
            await _tenant_id(request),
            surname=body.surname,
            reference_code=body.reference_code,
        )
    except ValueError as exc:
        msg = str(exc)
        if "δεν βρέθηκε" in msg.lower():
            raise HTTPException(status_code=404, detail=msg) from exc
        raise HTTPException(status_code=400, detail=msg) from exc
    return {"ok": True, "booking": _guest_booking_view(row)}


@router.post("/public/demo-check-in")
async def demo_office_checkin(body: CustomerInspectionBody, request: Request):
    """
    Soft native Wallet check-in → office demo booking (Δοκιμαστικός Πελάτης).
    Host resolves tenant; creates PICKUP_CHECK so desk Κρατήσεις updates.
    """
    try:
        row = store.demo_office_online_checkin(
            await _tenant_id(request),
            {
                "fuel_level": body.fuel_level,
                "mileage": body.mileage,
                "damage_notes": body.damage_notes,
                "photo_urls": body.photo_urls,
                "signature_url": body.signature_url,
                "checklist": body.checklist.model_dump() if body.checklist else None,
                "inspector_name": "Online Check-in (Wallet)",
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "booking": _guest_booking_view(row)}


@router.post("/bookings/{booking_id}/check-in")
async def customer_rental_checkin(
    booking_id: str,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    """Wallet member check-in for an owned rental booking."""
    tid = await _require_rent_module(request, account)
    try:
        row = store.customer_online_checkin(
            tid,
            booking_id=booking_id,
            email=account["email"],
        )
    except ValueError as exc:
        msg = str(exc)
        if "δεν βρέθηκε" in msg.lower():
            raise HTTPException(status_code=404, detail=msg) from exc
        raise HTTPException(status_code=400, detail=msg) from exc
    return {"ok": True, "booking": _public_booking(row)}


@router.get("/bookings")
async def my_rental_bookings(
    request: Request,
    account: dict = Depends(get_current_customer),
):
    tid = await _require_rent_module(request, account)
    rows = store.list_bookings_for_email(tid, account["email"])
    return {"bookings": [_public_booking(b) for b in rows], "total": len(rows), "tenant_id": tid}


@router.post("/bookings")
async def book_rental(
    body: CustomerBookingBody,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    tid = await _require_rent_module(request, account)
    payload = {
        "vehicle_id": body.vehicle_id,
        "client_name": (account.get("name") or account["email"].split("@")[0]).strip(),
        "client_email": account["email"],
        "client_phone": body.client_phone or account.get("phone") or None,
        "client_afm": body.client_afm,
        "client_id": account.get("customer_id"),
        "start_time": body.start_time,
        "end_time": body.end_time,
        "pickup_location": body.pickup_location.strip(),
        "dropoff_location": (body.dropoff_location or body.pickup_location).strip(),
        "driver_mode": body.driver_mode,
        "notes": body.notes,
        "extras": list(body.extras or []),
        "channel": "WALLET",
        "marketing_email": bool(body.marketing_email),
        "marketing_sms": bool(body.marketing_sms),
        "payment_method": body.payment_method or "card",
        "payment_plan": body.payment_plan,
        "deposit_percent": body.deposit_percent,
        # Never accept client settlement / payment_status / total for wallet channel.
    }
    try:
        row = store.create_booking(tid, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        from travel_platform.notifications.rental_booking_push import notify_rental_booking_to_office

        await notify_rental_booking_to_office(row)
    except Exception:
        pass

    try:
        from travel_platform.notifications.rental_customer_notify import (
            notify_rental_customer_on_create,
        )

        await notify_rental_customer_on_create(row)
    except Exception:
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
            await _require_rent_module(request, account),
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
    try:
        from travel_platform.notifications.rental_customer_notify import (
            notify_rental_customer_status,
        )

        await notify_rental_customer_status(row)
    except Exception:
        pass
    return _public_booking(row)


@router.get("/bookings/{booking_id}/contract", response_class=HTMLResponse)
async def rental_booking_contract(
    booking_id: str,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    tid = await _tenant_id(request)
    row = store.get_booking(tid, booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Η κράτηση δεν βρέθηκε")
    owner = str(row.get("client_email") or "").strip().lower()
    if owner != str(account.get("email") or "").strip().lower():
        raise HTTPException(status_code=403, detail="Δεν έχετε δικαίωμα σε αυτή την κράτηση")
    return HTMLResponse(content=_contract_html(row))


@router.post("/bookings/{booking_id}/remind")
async def remind_my_rental(
    booking_id: str,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    tid = await _tenant_id(request)
    row = store.get_booking(tid, booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Η κράτηση δεν βρέθηκε")
    owner = str(row.get("client_email") or "").strip().lower()
    if owner != str(account.get("email") or "").strip().lower():
        raise HTTPException(status_code=403, detail="Δεν έχετε δικαίωμα σε αυτή την κράτηση")
    try:
        from travel_platform.notifications.rental_customer_push import maybe_remind_if_soon

        result = await maybe_remind_if_soon(row, within_hours=48)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return result


@router.post("/reminders/scan")
async def scan_rental_reminders(
    within_hours: float = Query(default=24, ge=1, le=168),
    _: dict = Depends(get_current_customer),
):
    """Scan upcoming CONFIRMED rentals and push reminders (customer/internal)."""
    from travel_platform.notifications.rental_customer_push import scan_and_notify_upcoming_rentals

    return await scan_and_notify_upcoming_rentals(within_hours=within_hours)


@router.post("/bookings/{booking_id}/payment-intent")
async def rental_payment_intent(
    booking_id: str,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    tid = await _tenant_id(request)
    row = store.get_booking(tid, booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Η κράτηση δεν βρέθηκε")
    owner = str(row.get("client_email") or "").strip().lower()
    if owner != str(account.get("email") or "").strip().lower():
        raise HTTPException(status_code=403, detail="Δεν έχετε δικαίωμα σε αυτή την κράτηση")
    from travel_platform.rental.rental_stripe import create_rental_payment_intent

    return create_rental_payment_intent(row, tenant_id=tid)


@router.post("/bookings/{booking_id}/confirm-payment")
async def rental_confirm_payment(
    booking_id: str,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    """Mark rental paid/partial from Stripe PaymentIntent.retrieve (metadata rental_booking_id)."""
    tid = await _tenant_id(request)
    row = store.get_booking(tid, booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Η κράτηση δεν βρέθηκε")
    owner = str(row.get("client_email") or "").strip().lower()
    if owner != str(account.get("email") or "").strip().lower():
        raise HTTPException(status_code=403, detail="Δεν έχετε δικαίωμα σε αυτή την κράτηση")
    try:
        updated = store.confirm_payment_from_intent(tid, booking_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _public_booking(updated)


@router.post("/bookings/{booking_id}/review")
async def rental_submit_review(
    booking_id: str,
    body: ReviewBody,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    try:
        row = store.create_review(
            await _tenant_id(request),
            booking_id,
            email=account["email"],
            rating=body.rating,
            comment=body.comment,
        )
    except ValueError as exc:
        msg = str(exc)
        code = 404 if "δεν βρέθηκε" in msg else 400
        raise HTTPException(status_code=code, detail=msg) from exc
    return row


@router.get("/branches")
async def rental_branches(
    request: Request,
    _: dict = Depends(get_current_customer),
):
    branches = store.list_branches(await _tenant_id(request))
    return {"branches": branches, "count": len(branches)}


@router.post("/bookings/{booking_id}/inspections")
async def customer_create_inspection(
    booking_id: str,
    body: CustomerInspectionBody,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    tid = await _tenant_id(request)
    row = store.get_booking(tid, booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Η κράτηση δεν βρέθηκε")
    owner = str(row.get("client_email") or "").strip().lower()
    if owner != str(account.get("email") or "").strip().lower():
        raise HTTPException(status_code=403, detail="Δεν έχετε δικαίωμα σε αυτή την κράτηση")
    itype = str(body.inspection_type or "").strip().upper()
    if itype not in ("PICKUP_CHECK", "RETURN_CHECK"):
        raise HTTPException(status_code=400, detail="Μη έγκυρος τύπος επιθεώρησης")
    status = str(row.get("rental_status") or "").upper()
    if itype == "PICKUP_CHECK" and status != "CONFIRMED":
        raise HTTPException(status_code=400, detail="Check-in μόνο για επιβεβαιωμένες κρατήσεις")
    if itype == "RETURN_CHECK" and status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Check-out μόνο για ενεργές κρατήσεις")
    try:
        insp = store.create_inspection(
            tid,
            {
                "rental_booking_id": booking_id,
                "inspection_type": itype,
                "fuel_level": body.fuel_level,
                "mileage": body.mileage,
                "damage_notes": body.damage_notes,
                "photo_urls": body.photo_urls,
                "signature_url": body.signature_url,
                "inspector_name": (account.get("name") or account["email"].split("@")[0]).strip(),
                "checklist": body.checklist.model_dump() if body.checklist else None,
                "require_pickup_checklist": itype == "PICKUP_CHECK",
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return insp


@router.post("/bookings/{booking_id}/sos")
async def rental_booking_sos(
    booking_id: str,
    body: SosBody,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    tid = await _tenant_id(request)
    try:
        row = store.record_booking_sos(
            tid,
            booking_id,
            email=account["email"],
            lat=body.lat,
            lng=body.lng,
            accuracy=body.accuracy,
            note=body.note,
        )
    except ValueError as exc:
        msg = str(exc)
        if "δεν βρέθηκε" in msg:
            raise HTTPException(status_code=404, detail=msg) from exc
        if "δικαίωμα" in msg:
            raise HTTPException(status_code=403, detail=msg) from exc
        raise HTTPException(status_code=400, detail=msg) from exc

    sos = row.get("last_sos") or {}
    try:
        from travel_platform.notifications.rental_sos_push import notify_rental_sos_to_office

        await notify_rental_sos_to_office(row, sos)
    except Exception:
        pass

    try:
        from travel_platform.telemetry.fleet_pubsub import publish_fleet_alert

        await publish_fleet_alert(
            {
                "alert_type": "RENTAL_SOS",
                "severity": "critical",
                "tenant_id": tid,
                "booking_id": booking_id,
                "lat": body.lat,
                "lng": body.lng,
                "message": body.note or "SOS από πελάτη ενοικίασης",
                "client_name": row.get("client_name"),
                "vehicle_plate": row.get("vehicle_plate"),
            }
        )
    except Exception:
        pass

    return {"ok": True, "last_sos": sos, "booking": _public_booking(row)}


@router.post("/bookings/{booking_id}/location")
async def rental_booking_location(
    booking_id: str,
    body: LocationBody,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    tid = await _tenant_id(request)
    try:
        row = store.update_booking_live_location(
            tid,
            booking_id,
            email=account["email"],
            lat=body.lat,
            lng=body.lng,
            accuracy=body.accuracy,
            require_owner=True,
        )
    except ValueError as exc:
        msg = str(exc)
        if "δεν βρέθηκε" in msg:
            raise HTTPException(status_code=404, detail=msg) from exc
        if "δικαίωμα" in msg:
            raise HTTPException(status_code=403, detail=msg) from exc
        raise HTTPException(status_code=400, detail=msg) from exc
    return {"ok": True, "last_share_location": row.get("last_share_location")}


@router.post("/bookings/{booking_id}/share-link")
async def rental_booking_share_link(
    booking_id: str,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    tid = await _tenant_id(request)
    row = store.get_booking(tid, booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Η κράτηση δεν βρέθηκε")
    owner = str(row.get("client_email") or "").strip().lower()
    if owner != str(account.get("email") or "").strip().lower():
        raise HTTPException(status_code=403, detail="Δεν έχετε δικαίωμα σε αυτή την κράτηση")

    from travel_platform.telemetry.passenger_track_links import public_frontend_base
    from travel_platform.telemetry.rental_share_token import (
        DEFAULT_TTL_HOURS,
        create_rental_share_token,
        rental_share_expires_at,
    )

    token = create_rental_share_token(booking_id=booking_id, tenant_id=tid)
    expires_at = rental_share_expires_at(DEFAULT_TTL_HOURS)
    path = f"/track/rental/{booking_id}?token={token}"
    url = f"{public_frontend_base()}{path}"
    return {
        "url": url,
        "path": path,
        "token": token,
        "expires_at": expires_at,
        "expires_hours": DEFAULT_TTL_HOURS,
    }


def _share_summary(booking: dict) -> dict:
    loc = booking.get("last_share_location") or booking.get("last_sos")
    return {
        "booking_id": booking.get("id"),
        "vehicle_model": booking.get("vehicle_model"),
        "vehicle_plate": booking.get("vehicle_plate"),
        "rental_status": booking.get("rental_status"),
        "start_time": booking.get("start_time"),
        "end_time": booking.get("end_time"),
        "pickup_location": booking.get("pickup_location"),
        "dropoff_location": booking.get("dropoff_location"),
        "client_name": booking.get("client_name"),
        "last_known_location": loc,
        "last_sos": booking.get("last_sos"),
        "last_share_location": booking.get("last_share_location"),
    }


@router.get("/share/{token}")
async def rental_share_public(token: str):
    import jwt

    from travel_platform.telemetry.rental_share_token import verify_rental_share_token

    try:
        payload = verify_rental_share_token(token)
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=410, detail="Ο σύνδεσμος κοινοποίησης έληξε") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=403, detail="Μη έγκυρος σύνδεσμος") from exc

    tid = str(payload.get("tenant_id"))
    bid = str(payload.get("booking_id"))
    row = store.get_booking(tid, bid)
    if not row:
        raise HTTPException(status_code=404, detail="Η κράτηση δεν βρέθηκε")
    return _share_summary(row)


@router.post("/share/{token}/location")
async def rental_share_update_location(token: str, body: LocationBody):
    import jwt

    from travel_platform.telemetry.rental_share_token import verify_rental_share_token

    try:
        payload = verify_rental_share_token(token)
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=410, detail="Ο σύνδεσμος κοινοποίησης έληξε") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=403, detail="Μη έγκυρος σύνδεσμος") from exc

    tid = str(payload.get("tenant_id"))
    bid = str(payload.get("booking_id"))
    try:
        row = store.update_booking_live_location(
            tid,
            bid,
            lat=body.lat,
            lng=body.lng,
            accuracy=body.accuracy,
            require_owner=False,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "last_share_location": row.get("last_share_location")}
