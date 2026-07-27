"""Customer PWA fleet rental — catalog, availability, booking, contract, cancel."""

from __future__ import annotations

import os
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field

from api.customer_auth import get_current_customer
from travel_platform.rental import rental_store as store
from travel_platform.settings.drivers_store import DEMO_TENANT_ID

router = APIRouter(prefix="/api/customer/rentals", tags=["Customer Rentals"])

_DATA_ROOT = Path(os.getenv("POREIAGO_DATA_DIR") or Path(__file__).resolve().parents[1] / "data")
_RENTAL_PHOTO_DIR = _DATA_ROOT / "uploads" / "rental_damage"
_MAX_PHOTO_BYTES = 4 * 1024 * 1024


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
    contract_accepted: bool = False
    contract_signature_url: str | None = None
    contract_signer_name: str | None = None
    contract_version: str | None = None


def _public_booking(row: dict) -> dict:
    eligible = store.free_cancel_eligible(row)
    hours = None
    try:
        hours = round(store.hours_until_start(row.get("start_time") or ""), 1)
    except Exception:
        hours = None
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
        "contract_accepted": bool(row.get("contract_accepted")),
        "contract_version": row.get("contract_version"),
        "contract_accepted_at": row.get("contract_accepted_at"),
        "contract_signature_url": row.get("contract_signature_url"),
        "contract_signer_name": row.get("contract_signer_name"),
        "free_cancel_eligible": eligible,
        "free_cancel_hours": store.FREE_CANCEL_HOURS,
        "hours_until_start": hours,
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


@router.post("/signature-upload")
async def upload_rental_contract_signature(
    file: UploadFile = File(...),
    _: dict = Depends(get_current_customer),
):
    """Customer contract e-signature PNG — same storage as inspection signatures."""
    from travel_platform.media.image_optimize import optimize_driver_photo

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Επιτρέπονται μόνο εικόνες (PNG/JPG)")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Άδειο αρχείο")
    if len(content) > _MAX_PHOTO_BYTES:
        raise HTTPException(status_code=400, detail="Η εικόνα είναι πολύ μεγάλη (μέγ. 4 MB)")

    optimized = optimize_driver_photo(content, max_side=1200, quality=88)
    if optimized.ext == ".bin":
        raise HTTPException(status_code=400, detail="Μη έγκυρη εικόνα")

    safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "", Path(file.filename or "signature").stem)[:40] or "signature"
    filename = f"contract-{safe_stem}-{uuid.uuid4().hex[:10]}{optimized.ext}"
    _RENTAL_PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    (_RENTAL_PHOTO_DIR / filename).write_bytes(optimized.content)
    return {
        "ok": True,
        "url": f"/api/site/rental-photos/{filename}",
        "filename": filename,
        "bytes": len(optimized.content),
        "content_type": optimized.content_type,
    }


@router.get("/contract")
async def rental_contract_terms(_: dict = Depends(get_current_customer)):
    """Static Greek rental contract summary for the PWA accept step."""
    return {
        "version": store.CONTRACT_VERSION,
        "title": "Σύμβαση μίσθωσης οχήματος",
        "free_cancel_hours": store.FREE_CANCEL_HOURS,
        "clauses": [
            "Ο μισθωτής δηλώνει ότι κατέχει έγκυρο δίπλωμα οδήγησης και αναλαμβάνει την ευθύνη χρήσης του οχήματος.",
            "Το όχημα παραδίδεται καθαρό, με καύσιμο όπως συμφωνήθηκε, και επιστρέφεται στην ίδια κατάσταση.",
            "Ζημιές, πρόστιμα και παραβάσεις ΚΟΚ κατά τη διάρκεια της μίσθωσης βαρύνουν τον μισθωτή.",
            "Απαγορεύεται η υπεκμίσθωση, η μεταφορά επιβατών έναντι αμοιβής και η οδήγηση υπό επήρεια.",
            f"Δωρεάν ακύρωση έως {store.FREE_CANCEL_HOURS} ώρες πριν την παραλαβή. Μετά ισχύει πολιτική γραφείου.",
            "Η κράτηση επιβεβαιώνεται με την αποδοχή των όρων και την ηλεκτρονική υπογραφή του μισθωτή.",
        ],
    }


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
        "contract_accepted": body.contract_accepted,
        "contract_signature_url": body.contract_signature_url,
        "contract_signer_name": body.contract_signer_name
        or (account.get("name") or account["email"].split("@")[0]).strip(),
        "contract_version": body.contract_version or store.CONTRACT_VERSION,
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
