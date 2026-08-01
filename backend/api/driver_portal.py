"""
Driver portal API — username/password login + Master QR exchange + session-scoped manifest.
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from ticketing.boarding_service import get_boarding_manifest
from travel_platform.operations.master_qr_local import DEFAULT_TENANT, _secret as local_secret
from travel_platform.operations.master_qr_bridge import resolve_platform_tenant_id
from travel_platform.settings.drivers_store import (
    DEMO_TENANT_ID,
    authenticate_driver,
    get_driver,
)
from travel_platform.settings.login_audit_store import record_login_from_request
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
    trip_title: str | None = None
    destination: str | None = None
    meeting_point: str | None = None


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
    trip_title: str | None = None
    destination: str | None = None
    meeting_point: str | None = None


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


def _trip_context(trip_id: int) -> dict:
    from travel_platform.operations.trip_ops_store import get_trip_ops
    from travel_platform.telemetry.trip_title_resolve import resolve_trip_title_sync

    ops = get_trip_ops(trip_id) or {}
    title = str(ops.get("title") or "").strip() or resolve_trip_title_sync(trip_id)
    return {
        "trip_title": title,
        "destination": str(ops.get("destination") or "").strip() or None,
        "meeting_point": str(ops.get("meeting_point") or "").strip() or None,
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
    profile = _profile_fields(driver_id)
    vehicle_code = profile.get("vehicle_plate") or profile.get("vehicle_code") or f"BUS-{trip_id}"
    driver_jwt = jwt.encode(
        {
            "sub": driver_id or "master-qr-driver",
            "tenant_id": tid,
            "trip_id": trip_id,
            "roles": ["driver"],
            "scope": "manifest:read driver:scan",
            "exp": exp,
            "driver_id": driver_id,
            "driver_name": profile.get("driver_name"),
            "vehicle_code": vehicle_code,
            "bus_plate": vehicle_code,
        },
        _jwt_secret(),
        algorithm=JWT_ALGORITHM,
    )
    ctx = _trip_context(trip_id)
    return DriverSessionResponse(
        access_token=driver_jwt,
        trip_id=trip_id,
        tenant_id=tid,
        driver_id=driver_id,
        expires_at=exp,
        schedule=_build_daily_schedule(trip_id),
        **profile,
        **ctx,
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


_POREIAGO_OFFICE_CACHE: tuple[float, str | None] | None = None
_POREIAGO_OFFICE_CACHE_TTL_SEC = 300.0


async def _resolve_poreiago_office_tenant_id() -> str | None:
    """PoreiaGo platform office UUID (www.poreiago.com is the office Host, not «no tenant»)."""
    global _POREIAGO_OFFICE_CACHE
    now = time.time()
    if _POREIAGO_OFFICE_CACHE and now - _POREIAGO_OFFICE_CACHE[0] < _POREIAGO_OFFICE_CACHE_TTL_SEC:
        return _POREIAGO_OFFICE_CACHE[1]

    tid: str | None = None
    try:
        from sqlalchemy import or_, select

        from app.core.database import AsyncSessionLocal
        from app.models.tenant import Tenant
        from app.services.tenant_modules import is_poreiago_platform_office

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Tenant)
                .where(
                    or_(
                        Tenant.slug.in_(
                            (
                                "poreiago",
                                "platform",
                                "demo",
                                "admin-poreiago",
                                "poreiago-saas",
                                "poreiago-platform",
                                "achillio",  # historic PoreiaGo seed slug
                            )
                        ),
                        Tenant.subdomain.in_(
                            (
                                "poreiago",
                                "platform",
                                "demo",
                                "admin-poreiago",
                                "poreiago-saas",
                                "poreiago-platform",
                                "achillio",
                            )
                        ),
                        Tenant.custom_domain.ilike("%poreiago.com%"),
                        Tenant.legal_name.ilike("%poreiago%"),
                    )
                )
                .limit(20)
            )
            rows = list(result.scalars().all())
            from app.services.tenant_modules import is_achillio_travel_office

            preferred = None
            for tenant in rows:
                if is_achillio_travel_office(tenant):
                    continue
                if not is_poreiago_platform_office(tenant):
                    continue
                slug = str(getattr(tenant, "slug", "") or "").strip().lower()
                candidate = str(tenant.id)
                if slug in ("poreiago", "poreiago-platform", "admin-poreiago", "poreiago-saas"):
                    preferred = candidate
                    break
                if preferred is None:
                    preferred = candidate
            tid = preferred
    except Exception:
        tid = None

    _POREIAGO_OFFICE_CACHE = (now, tid)
    return tid


async def _login_office_tenant(request: Request) -> str | None:
    """Host / middleware office for this /driver login.

    Custom office domains resolve via Host. ``www.poreiago.com`` is the PoreiaGo
    platform office itself — not an unscoped API host — so map it to that tenant.
    Bare unknown hosts (e.g. testserver, raw IP) stay None so login cannot
    first-match across offices.
    """
    tid = getattr(request.state, "tenant_id", None)
    if tid:
        return str(tid)
    try:
        from api.request_tenant import public_tenant_id

        resolved = await public_tenant_id(request, allow_demo_fallback=False)
        if resolved:
            return resolved
    except Exception:
        pass

    try:
        from middleware.domain_tenant import _is_platform_host, _request_host

        host = _request_host(request)
        if host and _is_platform_host(host):
            poreiago_tid = await _resolve_poreiago_office_tenant_id()
            if poreiago_tid:
                request.state.tenant_id = poreiago_tid
                return poreiago_tid
    except Exception:
        pass
    return None


@router.post("/session/login", response_model=DriverSessionResponse)
async def login_with_password(request: Request, body: DriverLoginBody):
    """
    Primary PWA login — username (email / license / plate) + password.

    Locked to the Host office: the same credentials must not open a session
    that paints GPS onto a different γραφείο.
    """
    username = (body.username or "").strip()
    office_tid = await _login_office_tenant(request)

    if office_tid:
        # SEAL: authenticate only against this office's tenant_id — never DEMO claim.
        driver = authenticate_driver(
            body.username,
            body.password,
            tenant_id=office_tid,
            allow_demo_legacy=False,
        )
        if not driver:
            record_login_from_request(
                request,
                actor_type="driver",
                identity=username,
                success=False,
                method="password",
                detail="Λάθος όνομα χρήστη ή κωδικός — ή ο οδηγός ανήκει σε άλλο γραφείο",
                tenant_id=office_tid,
            )
            raise HTTPException(
                status_code=401,
                detail="Λάθος όνομα χρήστη ή κωδικός — ή ο οδηγός ανήκει σε άλλο γραφείο",
            )
        tenant_id = office_tid
    else:
        # Unknown / unscoped Host — refuse so the same email cannot open
        # another office's session by first-match.
        record_login_from_request(
            request,
            actor_type="driver",
            identity=username,
            success=False,
            method="password",
            detail="Συνδεθείτε από το domain του γραφείου σας",
        )
        raise HTTPException(
            status_code=401,
            detail="Συνδεθείτε από το domain του γραφείου σας (π.χ. www.poreiago.com)",
        )

    trip_id = _resolve_trip_for_driver(driver.id, tenant_id)
    record_login_from_request(
        request,
        actor_type="driver",
        identity=driver.email or driver.license_no or username,
        success=True,
        actor_id=driver.id,
        actor_name=driver.name,
        method="password",
        tenant_id=str(tenant_id) if tenant_id else None,
        detail=driver.license_plate or driver.vehicle_code,
    )
    return _issue_driver_session(
        driver_id=driver.id,
        tenant_id=tenant_id,
        trip_id=trip_id,
    )


@router.post("/session/master-qr", response_model=DriverSessionResponse)
async def exchange_master_qr(request: Request, body: MasterQrExchangeBody):
    """Scan bus dashboard QR → day session (secondary login path)."""
    from travel_platform.operations.boarding_office_sync import sync_trip_passengers_to_ticketing
    from travel_platform.operations.master_qr_bridge import (
        coerce_driver_tenant_id,
        exchange_master_qr_hybrid,
        preview_master_qr_payload,
        resolve_platform_tenant_id,
    )

    hybrid = await exchange_master_qr_hybrid(body.qr_raw)
    if hybrid:
        trip_id = int(hybrid["trip_id"])
        driver_id = hybrid.get("driver_id")
        platform_tid = await resolve_platform_tenant_id()
        qr_tid = str(hybrid.get("tenant_id") or "").strip()
        # Keep real office UUIDs; only remap empty/demo QR onto platform.
        tenant_id = coerce_driver_tenant_id(qr_tid, platform_tenant_id=platform_tid)
        # If the QR names a driver, session must stay on that driver's office —
        # never let a PoreiaGo driver paint Achillio (or the reverse).
        if driver_id and driver_id != "master-qr-driver":
            bound = get_driver(str(driver_id))
            if bound:
                home = str(getattr(bound, "tenant_id", None) or DEMO_TENANT_ID)
                if home and home != DEMO_TENANT_ID:
                    tenant_id = home
                elif tenant_id == DEMO_TENANT_ID and platform_tid:
                    tenant_id = platform_tid
        # Load office travelers into SQLite so scan validates against real bookings.
        try:
            await sync_trip_passengers_to_ticketing(trip_id, tenant_id=tenant_id)
        except Exception:
            pass
        driver = get_driver(driver_id) if driver_id and driver_id != "master-qr-driver" else None
        record_login_from_request(
            request,
            actor_type="driver",
            identity=(driver.email if driver else None)
            or (driver.license_no if driver else None)
            or str(driver_id or "master-qr"),
            success=True,
            actor_id=str(driver_id) if driver_id else None,
            actor_name=(driver.name if driver else None) or "Master QR",
            method="master_qr",
            tenant_id=str(tenant_id) if tenant_id else None,
            detail=f"trip:{trip_id}",
        )
        return _issue_driver_session(
            driver_id=driver_id,
            tenant_id=tenant_id,
            trip_id=trip_id,
            expires_at=int(hybrid["expires_at"]) if hybrid.get("expires_at") else None,
        )

    preview = preview_master_qr_payload(body.qr_raw)
    if not preview or preview.get("typ") != "master_qr":
        record_login_from_request(
            request,
            actor_type="driver",
            identity="master-qr",
            success=False,
            method="master_qr",
            detail="Not a Master QR code",
        )
        raise HTTPException(status_code=400, detail="Not a Master QR code")
    record_login_from_request(
        request,
        actor_type="driver",
        identity="master-qr",
        success=False,
        method="master_qr",
        detail="Invalid or expired Master QR",
    )
    raise HTTPException(status_code=401, detail="Invalid or expired Master QR")


@router.get("/me", response_model=DriverMeResponse)
async def driver_me(session_payload: dict = Depends(require_driver_session)):
    driver_id = session_payload.get("sub") or session_payload.get("driver_id")
    if driver_id in (None, "master-qr-driver"):
        driver_id = session_payload.get("driver_id")
    profile = _profile_fields(driver_id if driver_id and driver_id != "master-qr-driver" else None)
    driver = get_driver(driver_id) if driver_id and driver_id != "master-qr-driver" else None
    trip_id = int(session_payload.get("trip_id") or 0) or None
    ctx = _trip_context(trip_id) if trip_id else {}
    return DriverMeResponse(
        driver_id=driver_id if driver_id != "master-qr-driver" else None,
        email=driver.email if driver else None,
        trip_id=trip_id,
        tenant_id=str(session_payload.get("tenant_id") or ""),
        **profile,
        **ctx,
    )


@router.get("/trip")
async def driver_trip(session_payload: dict = Depends(require_driver_session)):
    """Full excursion context for the bound Master QR / shift trip."""
    from travel_platform.operations.boarding_office_sync import sync_trip_passengers_to_ticketing
    from travel_platform.operations.trip_ops_store import get_trip_ops

    trip_id = int(session_payload.get("trip_id", 0))
    if not trip_id:
        raise HTTPException(status_code=403, detail="No trip bound to session")
    tenant_id = str(session_payload.get("tenant_id") or "")
    try:
        await sync_trip_passengers_to_ticketing(trip_id, tenant_id=tenant_id or None)
    except Exception:
        pass
    ops = get_trip_ops(trip_id) or {}
    ctx = _trip_context(trip_id)
    schedule = _build_daily_schedule(trip_id)
    return {
        "trip_id": trip_id,
        "trip_title": ctx.get("trip_title"),
        "destination": ctx.get("destination") or ops.get("destination"),
        "meeting_point": ctx.get("meeting_point") or ops.get("meeting_point"),
        "departure_time": ops.get("departure_time"),
        "arrival_time": ops.get("arrival_time"),
        "total_seats": ops.get("total_seats"),
        "stops": schedule,
        "schedule": schedule,
    }


@router.get("/manifest")
async def driver_manifest(
    session_payload: dict = Depends(require_driver_session),
):
    """Boarding manifest only for trip_id embedded in session token."""
    from travel_platform.operations.boarding_office_sync import sync_trip_passengers_to_ticketing

    trip_id = int(session_payload.get("trip_id", 0))
    if not trip_id:
        raise HTTPException(status_code=403, detail="No trip bound to session")
    try:
        await sync_trip_passengers_to_ticketing(
            trip_id,
            tenant_id=str(session_payload.get("tenant_id") or "") or None,
        )
    except Exception:
        pass
    return await get_boarding_manifest(trip_id)


@router.get("/schedule")
async def driver_schedule(session_payload: dict = Depends(require_driver_session)):
    trip_id = int(session_payload.get("trip_id", 0))
    ctx = _trip_context(trip_id) if trip_id else {}
    return {
        "trip_id": trip_id,
        "trip_title": ctx.get("trip_title"),
        "destination": ctx.get("destination"),
        "meeting_point": ctx.get("meeting_point"),
        "stops": _build_daily_schedule(trip_id),
    }


def _build_daily_schedule(trip_id: int) -> list[dict]:
    """Real excursion timeline from synced trip ops (stops / hybrid / destination)."""
    from travel_platform.operations.trip_ops_store import build_schedule_from_ops, get_trip_ops

    ops = get_trip_ops(trip_id)
    stops = build_schedule_from_ops(trip_id, ops)
    if stops:
        return stops
    # Soft fallback — never invent a fake Athens→Meteora route for a real trip id.
    ctx_title = (ops or {}).get("title") if ops else None
    label = ctx_title or f"Εκδρομή #{trip_id}"
    return [
        {
            "time": "—",
            "stop": label,
            "status": "current",
            "trip_id": trip_id,
        }
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


@router.post("/telemetry/shift/start")
async def driver_shift_start(session_payload: dict = Depends(require_driver_session)):
    """
    Explicit start-of-shift from the driver PWA.

    Always notifies the admin platform (alert + Web Push) when the driver taps
    «Έναρξη βάρδιας», independent of WebSocket/GPS timing.
    """
    from travel_platform.operations.master_qr_bridge import (
        coerce_driver_tenant_id,
        resolve_platform_tenant_id,
    )
    from travel_platform.telemetry.driver_shift_notifications import notify_driver_shift
    from travel_platform.telemetry.driver_shift_tracker import on_driver_connected

    platform_tid = await resolve_platform_tenant_id()
    tenant_id = coerce_driver_tenant_id(
        str(session_payload.get("tenant_id") or ""),
        platform_tenant_id=platform_tid,
    )
    session_payload = {**session_payload, "tenant_id": tenant_id}

    # Reserve connection so the first GPS ping does not send a second "online" push.
    connection_id = hash(
        f"shift-start:{session_payload.get('sub')}:{session_payload.get('trip_id')}",
    )
    was_offline = on_driver_connected(session_payload, connection_id)

    notify_result: dict = {"skipped": True}
    try:
        notify_result = await notify_driver_shift(
            "online",
            session_payload,
            body={"reason": "shift_start"},
        )
    except Exception as exc:
        notify_result = {"skipped": True, "reason": str(exc)[:120]}

    return {
        "ok": True,
        "was_offline": was_offline,
        "notify": notify_result,
    }


@router.post("/telemetry/shift/end")
async def driver_shift_end(session_payload: dict = Depends(require_driver_session)):
    """
    Explicit end-of-shift from the driver PWA.

    Notifies the admin platform (alert + Web Push) and removes the driver from
    the live fleet map immediately — even when GPS was sent over HTTP only.
    """
    from travel_platform.operations.master_qr_bridge import (
        coerce_driver_tenant_id,
        resolve_platform_tenant_id,
    )
    from travel_platform.telemetry.driver_shift_notifications import notify_driver_shift
    from travel_platform.telemetry.driver_shift_tracker import force_driver_offline
    from travel_platform.telemetry.fleet_ws_hub import get_fleet_egress_hub
    from travel_platform.telemetry.processor import get_live_fleet

    from travel_platform.operations.master_qr_local import DEFAULT_TENANT

    platform_tid = await resolve_platform_tenant_id()
    raw_tenant = str(session_payload.get("tenant_id") or "").strip()
    tenant_id = coerce_driver_tenant_id(
        raw_tenant,
        platform_tenant_id=platform_tid,
    )
    session_payload = {**session_payload, "tenant_id": tenant_id}
    driver_id = str(session_payload.get("sub") or session_payload.get("driver_id") or "")
    trip_id = session_payload.get("trip_id")

    was_online = force_driver_offline(session_payload)

    # Also wipe demo + obsolete seed-slug mirrors so merged admin maps go dark.
    extra_tenants = {DEFAULT_TENANT, platform_tid, raw_tenant}
    try:
        import os

        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.models.tenant import Tenant

        seed_slug = (os.getenv("DEFAULT_TENANT_SLUG") or "achillio").strip().lower()
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Tenant).where(Tenant.slug == seed_slug).limit(1))
            seed = result.scalar_one_or_none()
            if seed:
                extra_tenants.add(str(seed.id))
    except Exception:
        pass
    extra_tenants.discard(tenant_id)
    extra_tenants.discard("")

    try:
        from travel_platform.telemetry.driver_gps_heartbeat import clear_driver_gps

        clear_driver_gps(session_payload)
    except Exception:
        pass

    removed: list[str] = []
    if tenant_id and driver_id:
        try:
            removed = await get_live_fleet().remove_driver_vehicles(
                tenant_id,
                driver_id,
                extra_tenant_ids=list(extra_tenants),
            )
        except Exception:
            import logging

            logging.getLogger(__name__).exception(
                "remove_driver_vehicles failed tenant=%s driver=%s",
                tenant_id,
                driver_id,
            )
            removed = []

    # Broadcast offline FIRST — office map must drop the pin before trail/push work.
    offline_payload = {
        "type": "fleet_driver_offline",
        "tenant_id": tenant_id,
        "driver_id": driver_id,
        "trip_id": trip_id,
        "reason": "shift_end",
        "removed_vehicle_ids": removed,
    }
    broadcast_tenants = {tid for tid in [tenant_id, *extra_tenants] if tid}
    for tid in broadcast_tenants:
        try:
            await get_fleet_egress_hub().broadcast(tid, {**offline_payload, "tenant_id": tid})
        except Exception:
            pass

    # Persist GPS path after map offline signal (must not delay pin clear).
    trail_points = 0
    if tenant_id and removed:
        try:
            from travel_platform.telemetry.trail_history_flush import persist_trails_for_vehicles

            def _safe_int(value):
                if value in (None, "", "0"):
                    return None
                try:
                    return int(value)
                except (TypeError, ValueError):
                    return None

            trail_points = await persist_trails_for_vehicles(
                tenant_id,
                removed,
                trip_id=_safe_int(trip_id),
                driver_id=driver_id,
            )
        except Exception:
            trail_points = 0

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
        "trail_points_saved": trail_points,
        "notify": notify_result,
    }
