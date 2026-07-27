"""Customer PWA fleet rental — catalog, availability, booking, payment, ID, contract, cancel."""

from __future__ import annotations

import os
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from api.customer_auth import get_current_customer
from travel_platform.rental import rental_store as store
from travel_platform.settings.drivers_store import DEMO_TENANT_ID

router = APIRouter(prefix="/api/customer/rentals", tags=["Customer Rentals"])

_DATA_ROOT = Path(os.getenv("POREIAGO_DATA_DIR") or Path(__file__).resolve().parents[1] / "data")
_RENTAL_ID_DIR = _DATA_ROOT / "uploads" / "rental_id"
_MAX_DOC_BYTES = 4 * 1024 * 1024
_ID_KINDS = frozenset({"id_card", "driving_license"})
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


class CustomerBookingExtras(BaseModel):
    extra_insurance: bool = False
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
    extras: CustomerBookingExtras | None = None
    payment_plan: str = "full"
    payment_method: str = "card"
    deposit_percent: int | None = Field(default=None, ge=5, le=90)
    id_document_url: str | None = None
    driving_license_url: str | None = None
    date_of_birth: str | None = None
    license_number: str | None = Field(default=None, max_length=64)
    license_expires_at: str | None = None
    contract_accepted: bool = False
    contract_signature_url: str | None = None
    contract_signer_name: str | None = None
    contract_version: str | None = None


class ModifyBookingBody(BaseModel):
    start_time: str
    end_time: str
    pickup_location: str | None = None
    dropoff_location: str | None = None


class ReviewBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


class CustomerInspectionBody(BaseModel):
    inspection_type: str
    fuel_level: float = Field(default=100, ge=0, le=100)
    mileage: int = Field(default=0, ge=0)
    damage_notes: str | None = None
    photo_urls: list[str] = Field(default_factory=list)
    signature_url: str | None = None


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
        "extras": row.get("extras"),
        "rental_status": row.get("rental_status"),
        "driver_mode": row.get("driver_mode"),
        "channel": row.get("channel"),
        "payment_plan": row.get("payment_plan"),
        "payment_method": row.get("payment_method"),
        "deposit_percent": row.get("deposit_percent"),
        "amount_due_now": row.get("amount_due_now"),
        "amount_paid": row.get("amount_paid"),
        "balance_due": row.get("balance_due"),
        "payment_status": row.get("payment_status"),
        "payment_label": row.get("payment_label"),
        "payment_intent_id": row.get("payment_intent_id"),
        "id_verification_status": row.get("id_verification_status"),
        "has_id_document": bool(row.get("id_document_url")),
        "has_driving_license": bool(row.get("driving_license_url")),
        "date_of_birth": row.get("date_of_birth"),
        "license_number": row.get("license_number"),
        "license_expires_at": row.get("license_expires_at"),
        "contract_accepted": bool(row.get("contract_accepted")),
        "contract_version": row.get("contract_version"),
        "contract_accepted_at": row.get("contract_accepted_at"),
        "contract_signature_url": row.get("contract_signature_url"),
        "contract_signer_name": row.get("contract_signer_name"),
        "free_cancel_eligible": eligible,
        "free_cancel_hours": store.FREE_CANCEL_HOURS,
        "hours_until_start": hours,
        "fiscal_status": row.get("fiscal_status"),
        "fiscal_mark": row.get("fiscal_mark"),
        "fiscal_kind": row.get("fiscal_kind"),
        "fiscal_amount": row.get("fiscal_amount"),
        "fiscal_issued_at": row.get("fiscal_issued_at"),
        "damage_deposit_eur": row.get("damage_deposit_eur"),
        "damage_deposit_status": row.get("damage_deposit_status"),
        "refund_id": row.get("refund_id"),
        "refunded_at": row.get("refunded_at"),
        "branch_id": row.get("branch_id"),
        "branch_name": row.get("branch_name"),
        "has_review": False,
        "created_at": row.get("created_at"),
        "modified_at": row.get("modified_at"),
    }


def _contract_html(booking: dict) -> str:
    def money(v):
        try:
            return f"€{float(v):.2f}"
        except (TypeError, ValueError):
            return "—"

    def when(iso):
        raw = str(iso or "").strip()
        if not raw:
            return "—"
        try:
            from datetime import datetime

            return datetime.fromisoformat(raw.replace("Z", "+00:00")).strftime("%d/%m/%Y %H:%M")
        except Exception:
            return raw

    sig = booking.get("contract_signature_url") or ""
    sig_block = (
        f'<p style="margin-top:24px;"><img src="{sig}" alt="Υπογραφή" '
        'style="max-width:280px;height:auto;border-bottom:1px solid #cbd5e1;"/></p>'
        if sig
        else "<p style='margin-top:24px;color:#94a3b8;'>— χωρίς υπογραφή —</p>"
    )
    fiscal = ""
    if booking.get("fiscal_mark"):
        fiscal = (
            f"<p><strong>Απόδειξη:</strong> {booking.get('fiscal_mark')} "
            f"({booking.get('fiscal_kind') or 'local'}) · {money(booking.get('fiscal_amount'))}</p>"
        )
    afm_bit = f" · ΑΦΜ {booking.get('client_afm')}" if booking.get("client_afm") else ""
    body = f"""
      <p><strong>Κωδικός:</strong> {booking.get('id')}</p>
      <p><strong>Πελάτης:</strong> {booking.get('client_name') or '—'}{afm_bit}</p>
      <p><strong>Email:</strong> {booking.get('client_email') or '—'}</p>
      <p><strong>Όχημα:</strong> {booking.get('vehicle_model') or '—'}
        · {booking.get('vehicle_plate') or '—'}</p>
      <p><strong>Παραλαβή:</strong> {when(booking.get('start_time'))}
        · {booking.get('pickup_location') or '—'}</p>
      <p><strong>Επιστροφή:</strong> {when(booking.get('end_time'))}
        · {booking.get('dropoff_location') or booking.get('pickup_location') or '—'}</p>
      <p><strong>Σύνολο:</strong> {money(booking.get('total_cost'))}
        · {booking.get('payment_label') or booking.get('payment_status') or ''}</p>
      {fiscal}
      <p style="margin-top:20px;font-size:13px;color:#64748b;">
        Έκδοση σύμβασης {booking.get('contract_version') or store.CONTRACT_VERSION}.
        Ο μισθωτής αποδέχεται τους όρους μίσθωσης και αναλαμβάνει την ευθύνη χρήσης του οχήματος.
      </p>
      <p><strong>Υπογράφων:</strong> {booking.get('contract_signer_name') or booking.get('client_name') or '—'}</p>
      {sig_block}
      <p style="margin-top:28px;">
        <button onclick="window.print()" style="padding:10px 18px;border:0;border-radius:10px;
        background:#0a7a6c;color:#fff;font-weight:700;cursor:pointer;">Εκτύπωση</button>
      </p>
    """
    return f"""<!DOCTYPE html>
<html lang="el">
<head><meta charset="utf-8"><title>Σύμβαση μίσθωσης · {booking.get('id')}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f0f7f6;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 28px rgba(11,61,74,.10);">
        <tr>
          <td style="background:linear-gradient(135deg,#0a7a6c,#0b3d4a);padding:24px 28px;color:#fff;">
            <div style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;opacity:.85;">Rent · PoreiaGo</div>
            <h1 style="margin:10px 0 0;font-size:20px;font-family:system-ui,-apple-system,sans-serif;">Σύμβαση μίσθωσης οχήματος</h1>
          </td>
        </tr>
        <tr><td style="padding:28px;color:#334155;font-size:14px;line-height:1.65;font-family:system-ui,-apple-system,sans-serif;">{body}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


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


@router.post("/id-docs/upload")
async def upload_rental_id_doc(
    kind: str = Query(..., description="id_card or driving_license"),
    file: UploadFile = File(...),
    _: dict = Depends(get_current_customer),
):
    """Customer ID / driving license photo for self-drive wallet bookings."""
    from travel_platform.media.image_optimize import optimize_driver_photo

    kind_norm = str(kind or "").strip().lower()
    if kind_norm not in _ID_KINDS:
        raise HTTPException(status_code=400, detail="Μη έγκυρος τύπος εγγράφου")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Επιτρέπονται μόνο εικόνες (JPG, PNG, WebP)")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Άδειο αρχείο")
    if len(content) > _MAX_DOC_BYTES:
        raise HTTPException(status_code=400, detail="Η εικόνα είναι πολύ μεγάλη (μέγ. 4 MB)")

    optimized = optimize_driver_photo(content, max_side=1600, quality=84)
    if optimized.ext == ".bin":
        raise HTTPException(status_code=400, detail="Μη έγκυρη εικόνα")

    prefix = "id" if kind_norm == "id_card" else "license"
    safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "", Path(file.filename or prefix).stem)[:40] or prefix
    filename = f"{prefix}-{safe_stem}-{uuid.uuid4().hex[:10]}{optimized.ext}"

    _RENTAL_ID_DIR.mkdir(parents=True, exist_ok=True)
    out_path = _RENTAL_ID_DIR / filename
    out_path.write_bytes(optimized.content)
    url = f"/api/site/rental-id/{filename}"
    return {
        "ok": True,
        "kind": kind_norm,
        "url": url,
        "filename": filename,
        "bytes": len(optimized.content),
        "content_type": optimized.content_type,
    }


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


@router.post("/photos/upload")
async def upload_customer_rental_photo(
    file: UploadFile = File(...),
    _: dict = Depends(get_current_customer),
):
    """Customer check-in / damage photo — same storage as admin rental-photos."""
    from travel_platform.media.image_optimize import optimize_driver_photo

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Επιτρέπονται μόνο εικόνες (JPG, PNG, WebP)")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Άδειο αρχείο")
    if len(content) > _MAX_PHOTO_BYTES:
        raise HTTPException(status_code=400, detail="Η εικόνα είναι πολύ μεγάλη (μέγ. 4 MB)")

    optimized = optimize_driver_photo(content, max_side=1600, quality=84)
    if optimized.ext == ".bin":
        raise HTTPException(status_code=400, detail="Μη έγκυρη εικόνα")
    safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "", Path(file.filename or "checkin").stem)[:40] or "checkin"
    filename = f"cust-{safe_stem}-{uuid.uuid4().hex[:10]}{optimized.ext}"
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
    branch: str | None = None,
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
            branch=branch,
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
                "branch_id": r.get("branch_id"),
                "branch_name": r.get("branch_name"),
                "min_driver_age": store.min_driver_age_for_category(r.get("category")),
                "suggested_days": r.get("suggested_days"),
                "base_total": r.get("base_total"),
                "driver_surcharge": r.get("driver_surcharge"),
                "one_way_surcharge": r.get("one_way_surcharge"),
                "suggested_total": r.get("suggested_total"),
                "is_one_way": r.get("is_one_way"),
                "is_airport_pickup": r.get("is_airport_pickup"),
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
    extras = body.extras.model_dump() if body.extras else {}
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
        "extras": extras,
        "payment_plan": body.payment_plan,
        "payment_method": body.payment_method,
        "deposit_percent": body.deposit_percent,
        "id_document_url": body.id_document_url,
        "driving_license_url": body.driving_license_url,
        "date_of_birth": body.date_of_birth,
        "license_number": body.license_number,
        "license_expires_at": body.license_expires_at,
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

    try:
        from ticketing.rental_confirmation_email import send_rental_confirmation_email

        await send_rental_confirmation_email(row)
    except Exception:
        pass

    try:
        from travel_platform.notifications.rental_customer_push import maybe_remind_if_soon

        await maybe_remind_if_soon(row, within_hours=48)
    except Exception:
        pass

    return _public_booking(row)


@router.patch("/bookings/{booking_id}")
async def modify_my_rental(
    booking_id: str,
    body: ModifyBookingBody,
    request: Request,
    account: dict = Depends(get_current_customer),
):
    try:
        row = store.modify_booking_for_customer(
            await _tenant_id(request),
            booking_id,
            email=account["email"],
            start_time=body.start_time,
            end_time=body.end_time,
            pickup=body.pickup_location,
            dropoff=body.dropoff_location,
        )
    except ValueError as exc:
        msg = str(exc)
        if "δεν βρέθηκε" in msg:
            raise HTTPException(status_code=404, detail=msg) from exc
        if "δικαίωμα" in msg:
            raise HTTPException(status_code=403, detail=msg) from exc
        raise HTTPException(status_code=400, detail=msg) from exc
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
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return insp
