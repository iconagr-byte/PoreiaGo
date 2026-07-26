"""Admin Fleet Rental API — vehicles, availability, bookings, inspections."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
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
    gps_device_id: str | None = None
    photo_url: str | None = None
    notes: str | None = None


class BookingBody(BaseModel):
    vehicle_id: str
    client_name: str = Field(min_length=1, max_length=160)
    client_email: str | None = None
    client_phone: str | None = None
    client_id: str | None = None
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


@router.get("/calendar")
async def rental_calendar(
    days: int = Query(default=30, ge=7, le=120),
    tenant_id: UUID = Depends(get_current_tenant_id),
    _: dict = Depends(_require_admin),
):
    return {"blocks": store.calendar_blocks(_tid(tenant_id), days=days)}


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
