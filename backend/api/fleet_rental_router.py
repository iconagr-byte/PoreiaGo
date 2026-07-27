"""Admin Fleet Rental API — vehicles, availability, bookings, inspections."""

from __future__ import annotations

import os
import re
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from travel_platform.rental import rental_store as store

try:
    from app.core.auth_deps import get_current_tenant_id, get_token_payload
except ImportError:

    async def get_token_payload() -> dict:
        raise HTTPException(status_code=503, detail="SaaS auth not available")

    async def get_current_tenant_id() -> UUID:
        raise HTTPException(status_code=503, detail="SaaS auth not available")


router = APIRouter(prefix="/api/admin/platform/fleet-rental", tags=["Fleet Rental"])

_ADMIN_ROLES = {"tenant_admin", "dispatcher", "superadmin"}
_DATA_ROOT = Path(os.getenv("POREIAGO_DATA_DIR") or Path(__file__).resolve().parents[1] / "data")
_RENTAL_PHOTO_DIR = _DATA_ROOT / "uploads" / "rental_damage"
_MAX_PHOTO_BYTES = 4 * 1024 * 1024


async def _require_admin(payload: dict = Depends(get_token_payload)) -> dict:
    roles = set(payload.get("roles") or [])
    if not roles & _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Απαιτείται ρόλος διαχειριστή")
    return payload


def _tid(tenant_id: UUID) -> str:
    return str(tenant_id)


class VehicleBody(BaseModel):
    plate_number: str = Field(min_length=2, max_length=32)
    category: str = Field(min_length=2, max_length=32)
    model: str = Field(min_length=1, max_length=120)
    seating_capacity: int = Field(default=5, ge=2, le=80)
    current_status: str = "AVAILABLE"
    current_mileage: int = Field(default=0, ge=0)
    daily_rate_eur: float = Field(default=0, ge=0)
    one_way_surcharge_eur: float = Field(default=0, ge=0)
    with_driver_daily_eur: float = Field(default=0, ge=0)
    gps_device_id: str | None = None
    photo_url: str | None = None
    photo_urls: list[str] = Field(default_factory=list)
    description: str | None = Field(default=None, max_length=2000)
    notes: str | None = None
    branch_id: str | None = None
    branch_name: str | None = None


class BookingBody(BaseModel):
    vehicle_id: str
    client_name: str = Field(min_length=1, max_length=160)
    client_email: str | None = None
    client_phone: str | None = None
    client_afm: str | None = None
    client_id: str | None = None
    channel: str = "DESK"
    start_time: str
    end_time: str
    pickup_location: str = Field(min_length=1, max_length=240)
    dropoff_location: str | None = None
    total_cost: float | None = None
    driver_mode: str = "SELF_DRIVE"
    assigned_driver_id: str | None = None
    notes: str | None = None


class BookingStatusBody(BaseModel):
    rental_status: str


class IssueReceiptBody(BaseModel):
    kind: str = "aade_receipt"
    amount: float | None = None


class BankDepositConfirmBody(BaseModel):
    confirmed_amount: float | None = None
    reference_code: str | None = None
    note: str | None = None


class DamageDepositBody(BaseModel):
    action: str = Field(description="release | capture | hold")


class IdVerificationBody(BaseModel):
    id_verification_status: str = Field(description="pending | verified | rejected")


class VerifyQrBody(BaseModel):
    code: str = Field(min_length=1, max_length=240)


class InspectionBody(BaseModel):
    rental_booking_id: str
    inspection_type: str
    fuel_level: float = Field(default=100, ge=0, le=100)
    mileage: int = Field(default=0, ge=0)
    damage_notes: str | None = None
    photo_urls: list[str] = Field(default_factory=list)
    signature_url: str | None = None
    inspector_name: str | None = None


@router.get("/summary")
async def rental_summary(
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    return store.dashboard_summary(_tid(tenant_id))


@router.get("/vehicles")
async def list_vehicles(
    category: str | None = None,
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    return {"vehicles": store.list_vehicles(_tid(tenant_id), category=category)}


@router.post("/vehicles")
async def create_vehicle(
    body: VehicleBody,
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    try:
        row = store.upsert_vehicle(_tid(tenant_id), body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return row


@router.patch("/vehicles/{vehicle_id}")
async def patch_vehicle(
    vehicle_id: str,
    body: VehicleBody,
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    try:
        row = store.upsert_vehicle(_tid(tenant_id), body.model_dump(), vehicle_id=vehicle_id)
    except ValueError as exc:
        msg = str(exc)
        code = 404 if "δεν βρέθηκε" in msg else 400
        raise HTTPException(status_code=code, detail=msg) from exc
    return row


@router.delete("/vehicles/{vehicle_id}", status_code=204)
async def remove_vehicle(
    vehicle_id: str,
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    try:
        ok = store.delete_vehicle(_tid(tenant_id), vehicle_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not ok:
        raise HTTPException(status_code=404, detail="Το όχημα δεν βρέθηκε")
    return None


@router.get("/availability")
async def availability(
    start_time: str = Query(...),
    end_time: str = Query(...),
    category: str | None = None,
    min_seats: int | None = Query(default=None, ge=1, le=80),
    pickup_location: str | None = None,
    dropoff_location: str | None = None,
    driver_mode: str | None = None,
    branch: str | None = None,
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    try:
        rows = store.check_availability(
            _tid(tenant_id),
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
    return {"vehicles": rows, "count": len(rows)}


@router.get("/bookings")
async def list_bookings(
    vehicle_id: str | None = None,
    status: str | None = None,
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    return {
        "bookings": store.list_bookings(_tid(tenant_id), vehicle_id=vehicle_id, status=status),
    }


@router.get("/clients")
async def list_rental_clients(
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    """Unique rental customers (desk + Wallet) for the Ενοικιάσεις → Πελάτες tab."""
    clients = store.list_clients(_tid(tenant_id))
    return {"clients": clients, "total": len(clients)}


@router.post("/bookings")
async def create_booking(
    body: BookingBody,
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    try:
        row = store.create_booking(_tid(tenant_id), body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return row


@router.patch("/bookings/{booking_id}/status")
async def patch_booking_status(
    booking_id: str,
    body: BookingStatusBody,
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    try:
        row = store.update_booking_status(_tid(tenant_id), booking_id, body.rental_status)
    except ValueError as exc:
        msg = str(exc)
        code = 404 if "δεν βρέθηκε" in msg else 400
        raise HTTPException(status_code=code, detail=msg) from exc
    return row


@router.post("/bookings/{booking_id}/issue-receipt")
async def issue_booking_receipt(
    booking_id: str,
    body: IssueReceiptBody | None = None,
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    """Issue fiscal receipt — tries AADE/myDATA first; LOCAL-* on failure.

    AADE_MODE=stub returns MARK-STUB marks from the gateway.
    """
    from travel_platform.rental.rental_fiscal import issue_receipt_for_booking

    payload = body or IssueReceiptBody()
    try:
        row = issue_receipt_for_booking(
            _tid(tenant_id),
            booking_id,
            kind=payload.kind or "aade_receipt",
            amount=payload.amount,
        )
    except ValueError as exc:
        msg = str(exc)
        code = 404 if "δεν βρέθηκε" in msg else 400
        raise HTTPException(status_code=code, detail=msg) from exc
    return row


@router.post("/bookings/{booking_id}/confirm-bank-deposit")
async def confirm_rental_bank_deposit(
    booking_id: str,
    body: BankDepositConfirmBody | None = None,
    tenant_id: UUID = Depends(get_current_tenant_id),
    payload: dict = Depends(_require_admin),
):
    """Admin confirm bank transfer for a pending rental booking."""
    data = body or BankDepositConfirmBody()
    try:
        row = store.confirm_bank_deposit_for_rental(
            _tid(tenant_id),
            booking_id,
            confirmed_amount=data.confirmed_amount,
            reference_code=data.reference_code,
            note=data.note,
            actor_id=str(payload.get("sub") or payload.get("user_id") or "") or None,
        )
    except ValueError as exc:
        msg = str(exc)
        code = 404 if "δεν βρέθηκε" in msg else 400
        raise HTTPException(status_code=code, detail=msg) from exc
    return row


@router.post("/bookings/{booking_id}/damage-deposit")
async def rental_damage_deposit_action(
    booking_id: str,
    body: DamageDepositBody,
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    try:
        row = store.set_damage_deposit_status(
            _tid(tenant_id),
            booking_id,
            action=body.action,
        )
    except ValueError as exc:
        msg = str(exc)
        code = 404 if "δεν βρέθηκε" in msg else 400
        raise HTTPException(status_code=code, detail=msg) from exc
    return row


@router.post("/reminders/scan")
async def admin_scan_rental_reminders(
    within_hours: float = Query(default=24, ge=1, le=168),
    _: dict = Depends(_require_admin),
):
    from travel_platform.notifications.rental_customer_push import scan_and_notify_upcoming_rentals

    return await scan_and_notify_upcoming_rentals(within_hours=within_hours)


@router.patch("/bookings/{booking_id}/id-verification")
async def patch_booking_id_verification(
    booking_id: str,
    body: IdVerificationBody,
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    """Desk review of customer ID / driving license photos."""
    try:
        row = store.update_id_verification(
            _tid(tenant_id),
            booking_id,
            body.id_verification_status,
        )
    except ValueError as exc:
        msg = str(exc)
        code = 404 if "δεν βρέθηκε" in msg else 400
        raise HTTPException(status_code=code, detail=msg) from exc
    return row


@router.post("/verify-qr")
async def verify_rental_qr(
    body: VerifyQrBody,
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    """Desk scan of Rent Wallet pass (`RENT:{booking_id}`) — verify only."""
    try:
        return store.verify_rental_qr(_tid(tenant_id), body.code)
    except ValueError as exc:
        msg = str(exc)
        code = 404 if "δεν βρέθηκε" in msg else 400
        raise HTTPException(status_code=code, detail=msg) from exc


@router.get("/bookings/{booking_id}")
async def get_booking(
    booking_id: str,
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    row = store.get_booking(_tid(tenant_id), booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Η κράτηση δεν βρέθηκε")
    return row


@router.get("/calendar")
async def rental_calendar(
    days: int = Query(default=30, ge=7, le=120),
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    return {"blocks": store.calendar_blocks(_tid(tenant_id), days=days)}


@router.get("/live-overlays")
async def rental_live_overlays(
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    """Active rentals for live-map GPS overlay (match by plate / gps_device_id)."""
    overlays = store.active_rental_overlays(_tid(tenant_id))
    return {"overlays": overlays, "count": len(overlays)}


@router.get("/inspections")
async def list_inspections(
    booking_id: str | None = None,
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    return {"inspections": store.list_inspections(_tid(tenant_id), booking_id=booking_id)}


@router.post("/inspections")
async def create_inspection(
    body: InspectionBody,
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    try:
        row = store.create_inspection(_tid(tenant_id), body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return row


@router.post("/inspections/photo-upload")
async def upload_inspection_photo(
    file: UploadFile = File(...),
    _: dict = Depends(_require_admin),
):
    """Damage selfie / check-in photo — returns public URL for photo_urls."""
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
    safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "", Path(file.filename or "damage").stem)[:40] or "damage"
    filename = f"{safe_stem}-{uuid.uuid4().hex[:10]}{optimized.ext}"

    _RENTAL_PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    out_path = _RENTAL_PHOTO_DIR / filename
    out_path.write_bytes(optimized.content)
    url = f"/api/site/rental-photos/{filename}"
    return {
        "ok": True,
        "url": url,
        "filename": filename,
        "bytes": len(optimized.content),
        "content_type": optimized.content_type,
    }


class SafetySettingsBody(BaseModel):
    office_phone: str | None = None
    roadside_phone_24_7: str | None = None
    roadside_label: str | None = None
    emergency_sms: str | None = None
    cdw_franchise_eur: float | None = Field(default=None, ge=0)
    scdw_franchise_eur: float | None = Field(default=None, ge=0)
    scdw_daily_eur: float | None = Field(default=None, ge=0)


@router.get("/safety-settings")
async def get_rental_safety_settings(_: dict = Depends(_require_admin)):
    from travel_platform.rental.rental_safety_settings import resolve_safety_contacts

    return resolve_safety_contacts()


@router.patch("/safety-settings")
async def patch_rental_safety_settings(
    body: SafetySettingsBody,
    _: dict = Depends(_require_admin),
):
    from travel_platform.rental.rental_safety_settings import (
        resolve_safety_contacts,
        update_safety_settings,
    )

    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    update_safety_settings(patch)
    return resolve_safety_contacts()


class RentModuleBody(BaseModel):
    rent_enabled: bool | None = None
    rent_addon_monthly_eur: float | None = Field(default=None, ge=0)
    note: str | None = None


@router.get("/module")
async def get_rent_module(_: dict = Depends(_require_admin)):
    """Rent SaaS add-on entitlement (separate from bus/core plan)."""
    from travel_platform.rental.rental_module_entitlement import read_rent_module

    return read_rent_module()


@router.patch("/module")
async def patch_rent_module(
    body: RentModuleBody,
    _: dict = Depends(_require_admin),
):
    from travel_platform.rental.rental_module_entitlement import (
        read_rent_module,
        update_rent_module,
    )

    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    update_rent_module(patch)
    return read_rent_module()
