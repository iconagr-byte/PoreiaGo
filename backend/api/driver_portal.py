"""
Driver portal API — public Master QR exchange + session-scoped manifest.
No admin login; trip_id is bound to the signed Master QR token.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from ticketing.boarding_service import get_boarding_manifest
from travel_platform.telemetry.live_fleet import LiveFleetService
from travel_platform.telemetry.processor import get_idling, get_live_fleet

router = APIRouter(prefix="/api/driver", tags=["driver-portal"])

JWT_SECRET = os.getenv("MASTER_QR_SECRET") or os.getenv("TICKET_JWT_SECRET") or os.getenv("AUTH_JWT_SECRET", "")
JWT_ALGORITHM = "HS256"


class MasterQrExchangeBody(BaseModel):
    qr_raw: str


class DriverSessionResponse(BaseModel):
    access_token: str
    trip_id: int
    tenant_id: str
    driver_id: str | None
    expires_at: int
    schedule: list[dict]


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


def _decode_master_qr(raw: str) -> dict:
    from travel_platform.operations.master_qr_normalize import normalize_master_qr_input

    token = normalize_master_qr_input(raw).strip()
    if token.startswith("mq1."):
        token = token[4:]
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail="Invalid Master QR") from e


async def require_driver_session(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Driver session required")
    token = authorization[7:].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail="Session expired") from e
    if "driver" not in (payload.get("roles") or []):
        raise HTTPException(status_code=403, detail="Not a driver session")
    return payload


@router.post("/session/master-qr", response_model=DriverSessionResponse)
async def exchange_master_qr(body: MasterQrExchangeBody):
    """Scan bus dashboard QR → day session (no username/password)."""
    from travel_platform.operations.master_qr_bridge import exchange_master_qr_hybrid, preview_master_qr_payload

    hybrid = await exchange_master_qr_hybrid(body.qr_raw)
    if hybrid:
        trip_id = int(hybrid["trip_id"])
        schedule = _build_daily_schedule(trip_id)
        return DriverSessionResponse(
            access_token=hybrid["access_token"],
            trip_id=trip_id,
            tenant_id=str(hybrid["tenant_id"]),
            driver_id=hybrid.get("driver_id"),
            expires_at=int(hybrid["expires_at"]),
            schedule=schedule,
        )

    preview = preview_master_qr_payload(body.qr_raw)
    if not preview or preview.get("typ") != "master_qr":
        raise HTTPException(status_code=400, detail="Not a Master QR code")
    raise HTTPException(status_code=401, detail="Invalid or expired Master QR")


@router.get("/manifest")
async def driver_manifest(
    session_payload: dict = Depends(require_driver_session),
):
    """Boarding manifest only for trip_id embedded in session token."""
    trip_id = int(session_payload.get("trip_id", 0))
    if not trip_id:
        raise HTTPException(status_code=403, detail="No trip bound to session")
    return await get_boarding_manifest(trip_id)


@router.get("/schedule")
async def driver_schedule(session_payload: dict = Depends(require_driver_session)):
    trip_id = int(session_payload.get("trip_id", 0))
    return {"trip_id": trip_id, "stops": _build_daily_schedule(trip_id)}


def _build_daily_schedule(trip_id: int) -> list[dict]:
    """Placeholder timeline — replace with trips/stops tables."""
    return [
        {
            "time": "08:00",
            "stop": "Αθήνα — Σταθμός Λαρίσης",
            "status": "completed",
            "trip_id": trip_id,
        },
        {
            "time": "10:30",
            "stop": "Λαμία — Κέντρο",
            "status": "current",
            "trip_id": trip_id,
        },
        {
            "time": "13:00",
            "stop": "Μετέωρα — Θέα",
            "status": "upcoming",
            "trip_id": trip_id,
        },
        {
            "time": "18:00",
            "stop": "Επιστροφή Αθήνα",
            "status": "upcoming",
            "trip_id": trip_id,
        },
    ]


@router.get("/telemetry/trip")
async def driver_trip_telemetry(session_payload: dict = Depends(require_driver_session)):
    """Idle time + fuel saved gamification for current trip."""
    trip_id = int(session_payload.get("trip_id", 0))
    tenant_id = UUID(str(session_payload["tenant_id"]))
    idling = get_idling()
    live: LiveFleetService = get_live_fleet()

    vehicle = None
    for v in live.list_active(tenant_id):
        if v.trip_id == trip_id:
            vehicle = v
            break

    idle_seconds = vehicle.idle_seconds_trip if vehicle else idling.trip_idle_seconds(
        live.upsert_vehicle_registry(tenant_id, f"trip-{trip_id}", trip_id)
    )
    liters, cost = idling.calculate_idle_cost(idle_seconds)
    saved = idling.estimated_fuel_saved_liters(idle_seconds)

    return {
        "trip_id": trip_id,
        "idle_seconds": idle_seconds,
        "idle_cost_eur": cost,
        "fuel_wasted_liters": liters,
        "estimated_fuel_saved_liters": saved,
        "is_currently_idling": idle_seconds > 0 and vehicle and vehicle.speed_kmh < 3,
    }
