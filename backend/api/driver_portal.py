"""
Driver portal API — username/password login + Master QR exchange + session-scoped manifest.
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from ticketing.boarding_service import get_boarding_manifest
from travel_platform.operations.master_qr_local import DEFAULT_TENANT, _secret as local_secret
from travel_platform.operations.master_qr_bridge import resolve_platform_tenant_id
from travel_platform.settings.drivers_store import authenticate_driver, get_driver
from travel_platform.telemetry.live_fleet import LiveFleetService
from travel_platform.telemetry.processor import get_idling, get_live_fleet

router = APIRouter(prefix="/api/driver", tags=["driver-portal"])

JWT_SECRET = os.getenv("MASTER_QR_SECRET") or os.getenv("TICKET_JWT_SECRET") or os.getenv("AUTH_JWT_SECRET", "")
JWT_ALGORITHM = "HS256"


class MasterQrExchangeBody(BaseModel):
    qr_raw: str


class DriverLoginBody(BaseModel):
    username: str = Field(..., min_length=2)
    password: str = Field(..., min_length=1)


class DriverSessionResponse(BaseModel):
    access_token: str
    trip_id: int
    tenant_id: str
    driver_id: str | None
    expires_at: int
    schedule: list[dict]
    driver_name: str | None = None
    photo_url: str | None = None
    vehicle_plate: str | None = None
    vehicle_code: str | None = None
    vehicle_image_url: str | None = None


class DriverMeResponse(BaseModel):
    driver_id: str | None
    driver_name: str | None = None
    photo_url: str | None = None
    email: str | None = None
    vehicle_plate: str | None = None
    vehicle_code: str | None = None
    vehicle_image_url: str | None = None
    trip_id: int | None = None
    tenant_id: str | None = None


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


def _jwt_secret() -> str:
    return JWT_SECRET or local_secret()


def _decode_master_qr(raw: str) -> dict:
    from travel_platform.operations.master_qr_normalize import normalize_master_qr_input

    token = normalize_master_qr_input(raw).strip()
    if token.startswith("mq1."):
        token = token[4:]
    try:
        return jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail="Invalid Master QR") from e


async def require_driver_session(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Driver session required")
    token = authorization[7:].strip()
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail="Session expired") from e
    if "driver" not in (payload.get("roles") or []):
        raise HTTPException(status_code=403, detail="Not a driver session")
    return payload


def _normalize_plate(value: str | None) -> str:
    return (value or "").strip().upper().replace(" ", "")


def _vehicle_profile_for_driver(driver) -> dict:
    if not driver:
        return {
            "vehicle_plate": None,
            "vehicle_code": None,
            "vehicle_image_url": None,
        }
    plate = driver.license_plate or driver.vehicle_code
    code = driver.vehicle_code
    image = "/images/hero-bus-achillio.png"
    try:
        from travel_platform.fleet.service_service import service_service

        needle = _normalize_plate(plate) or _normalize_plate(code)
        for v in service_service.list_vehicles():
            if _normalize_plate(v.get("plate_number")) == needle:
                image = v.get("public_image_url") or image
                plate = v.get("plate_number") or plate
                break
    except Exception:
        pass
    return {
        "vehicle_plate": plate,
        "vehicle_code": code,
        "vehicle_image_url": image,
    }


def _profile_fields(driver_id: str | None) -> dict:
    driver = get_driver(driver_id) if driver_id else None
    vehicle = _vehicle_profile_for_driver(driver)
    return {
        "driver_name": driver.name if driver else None,
        "photo_url": getattr(driver, "photo_url", None) if driver else None,
        **vehicle,
    }


def _issue_driver_session(
    *,
    driver_id: str | None,
    tenant_id: str,
    trip_id: int,
    expires_at: int | None = None,
) -> DriverSessionResponse:
    exp = expires_at or int(time.time()) + 24 * 3600
    tid = tenant_id or DEFAULT_TENANT
    driver_jwt = jwt.encode(
        {
            "sub": driver_id or "master-qr-driver",
            "tenant_id": tid,
            "trip_id": trip_id,
            "roles": ["driver"],
            "scope": "manifest:read driver:scan",
            "exp": exp,
        },
        _jwt_secret(),
        algorithm=JWT_ALGORITHM,
    )
    profile = _profile_fields(driver_id)
    return DriverSessionResponse(
        access_token=driver_jwt,
        trip_id=trip_id,
        tenant_id=tid,
        driver_id=driver_id,
        expires_at=exp,
        schedule=_build_daily_schedule(trip_id),
        **profile,
    )


def _resolve_trip_for_driver(driver_id: str | None, tenant_id: str | None = None) -> int:
    """Prefer live fleet assignment; otherwise default demo trip."""
    if not driver_id:
        return 1
    try:
        live: LiveFleetService = get_live_fleet()
        tid = UUID(tenant_id or DEFAULT_TENANT)
        for v in live.list_active(tid):
            raw = getattr(v, "__dict__", {}) or {}
            if str(raw.get("driver_id") or "") == str(driver_id) and v.trip_id:
                return int(v.trip_id)
    except Exception:
        pass
    return 1


@router.post("/session/login", response_model=DriverSessionResponse)
async def login_with_password(body: DriverLoginBody):
    """Primary PWA login — username (email / license / plate) + password."""
    driver = authenticate_driver(body.username, body.password)
    if not driver:
        raise HTTPException(status_code=401, detail="Λάθος όνομα χρήστη ή κωδικός")
    # Must match the SaaS tenant the admin live map filters by (not the local demo UUID).
    tenant_id = await resolve_platform_tenant_id()
    trip_id = _resolve_trip_for_driver(driver.id, tenant_id)
    return _issue_driver_session(
        driver_id=driver.id,
        tenant_id=tenant_id,
        trip_id=trip_id,
    )


@router.post("/session/master-qr", response_model=DriverSessionResponse)
async def exchange_master_qr(body: MasterQrExchangeBody):
    """Scan bus dashboard QR → day session (secondary login path)."""
    from travel_platform.operations.master_qr_bridge import exchange_master_qr_hybrid, preview_master_qr_payload

    hybrid = await exchange_master_qr_hybrid(body.qr_raw)
    if hybrid:
        trip_id = int(hybrid["trip_id"])
        driver_id = hybrid.get("driver_id")
        profile = _profile_fields(driver_id)
        return DriverSessionResponse(
            access_token=hybrid["access_token"],
            trip_id=trip_id,
            tenant_id=str(hybrid["tenant_id"]),
            driver_id=driver_id,
            expires_at=int(hybrid["expires_at"]),
            schedule=_build_daily_schedule(trip_id),
            **profile,
        )

    preview = preview_master_qr_payload(body.qr_raw)
    if not preview or preview.get("typ") != "master_qr":
        raise HTTPException(status_code=400, detail="Not a Master QR code")
    raise HTTPException(status_code=401, detail="Invalid or expired Master QR")


@router.get("/me", response_model=DriverMeResponse)
async def driver_me(session_payload: dict = Depends(require_driver_session)):
    driver_id = session_payload.get("sub") or session_payload.get("driver_id")
    if driver_id in (None, "master-qr-driver"):
        driver_id = session_payload.get("driver_id")
    profile = _profile_fields(driver_id if driver_id and driver_id != "master-qr-driver" else None)
    driver = get_driver(driver_id) if driver_id and driver_id != "master-qr-driver" else None
    return DriverMeResponse(
        driver_id=driver_id if driver_id != "master-qr-driver" else None,
        email=driver.email if driver else None,
        trip_id=int(session_payload.get("trip_id") or 0) or None,
        tenant_id=str(session_payload.get("tenant_id") or ""),
        **profile,
    )


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


@router.post("/telemetry/location")
async def driver_telemetry_location(
    body: dict,
    session_payload: dict = Depends(require_driver_session),
):
    """
    HTTP fallback for driver PWA GPS when WebSocket upgrade is blocked by a proxy.
    Same ingest path as /ws/telemetry/ingress.
    """
    from travel_platform.telemetry.driver_shift_notifications import notify_driver_shift
    from travel_platform.telemetry.driver_shift_tracker import on_driver_connected
    from travel_platform.telemetry.fleet_ingress import ingest_driver_location

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")

    # Mark shift online on first successful HTTP ping (idempotent per driver/trip).
    connection_id = hash(f"http:{session_payload.get('sub')}:{session_payload.get('trip_id')}")
    if on_driver_connected(session_payload, connection_id):
        try:
            import asyncio

            asyncio.create_task(notify_driver_shift("online", session_payload))
        except Exception:
            pass

    try:
        result = await ingest_driver_location(body, session=session_payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)[:200]) from exc

    if result.get("rate_limited"):
        return {
            "type": "rate_limited",
            "ok": False,
            "retry_after_sec": result.get("retry_after_sec"),
            "tenant_id": result.get("tenant_id"),
        }
    return {"type": "ack", "ok": True, **result}


@router.post("/telemetry/shift/end")
async def driver_shift_end(session_payload: dict = Depends(require_driver_session)):
    """
    Explicit end-of-shift from the driver PWA.

    Notifies the admin platform (alert + Web Push) and removes the driver from
    the live fleet map immediately — even when GPS was sent over HTTP only.
    """
    from travel_platform.telemetry.driver_shift_notifications import notify_driver_shift
    from travel_platform.telemetry.driver_shift_tracker import force_driver_offline
    from travel_platform.telemetry.fleet_ws_hub import get_fleet_egress_hub
    from travel_platform.telemetry.processor import get_live_fleet

    was_online = force_driver_offline(session_payload)
    tenant_id = str(session_payload.get("tenant_id") or "")
    driver_id = str(session_payload.get("sub") or session_payload.get("driver_id") or "")
    trip_id = session_payload.get("trip_id")

    removed: list[str] = []
    if tenant_id and driver_id:
        try:
            removed = await get_live_fleet().remove_driver_vehicles(tenant_id, driver_id)
        except Exception:
            removed = []

    if tenant_id:
        try:
            await get_fleet_egress_hub().broadcast(
                tenant_id,
                {
                    "type": "fleet_driver_offline",
                    "tenant_id": tenant_id,
                    "driver_id": driver_id,
                    "trip_id": trip_id,
                    "reason": "shift_end",
                    "removed_vehicle_ids": removed,
                },
            )
        except Exception:
            pass

    notify_result: dict = {"skipped": True}
    try:
        notify_result = await notify_driver_shift(
            "offline",
            session_payload,
            body={"reason": "shift_end"},
        )
    except Exception as exc:
        notify_result = {"skipped": True, "reason": str(exc)[:120]}

    return {
        "ok": True,
        "was_online": was_online,
        "removed_vehicles": removed,
        "notify": notify_result,
    }
