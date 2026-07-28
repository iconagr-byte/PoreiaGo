"""
WebSocket endpoints — passenger ETA, admin alerts, driver GPS ingress, fleet egress.

Admin egress/alerts require a SaaS admin JWT (?token=). Tenant is taken from the
JWT only — path/query tenant_id cannot grant access to another office.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from uuid import UUID

import jwt
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from travel_platform.operations.master_qr_local import _secret as local_secret
from travel_platform.telemetry.eta_resolve import DEMO_TENANT, resolve_eta_snapshot
from travel_platform.telemetry.eta_serializers import snapshot_to_payload
from travel_platform.telemetry.fleet_ingress import ingest_driver_location
from travel_platform.telemetry.fleet_ws_hub import ensure_redis_bridge, get_fleet_egress_hub
from travel_platform.telemetry.ws_hub import get_alerts_ws_hub, get_eta_ws_hub

logger = logging.getLogger(__name__)

router = APIRouter(tags=["telemetry-ws"])

JWT_ALGORITHM = "HS256"
_ADMIN_WS_ROLES = frozenset({"tenant_admin", "dispatcher", "superadmin", "auditor"})


def _jwt_secrets() -> list[str]:
    """Match driver_portal._jwt_secret() — env secrets first, then local fallback."""
    ordered = [
        os.getenv("MASTER_QR_SECRET"),
        os.getenv("TICKET_JWT_SECRET"),
        os.getenv("AUTH_JWT_SECRET"),
        local_secret(),
    ]
    seen: set[str] = set()
    out: list[str] = []
    for secret in ordered:
        if not secret or secret in seen:
            continue
        seen.add(secret)
        out.append(secret)
    return out


def _admin_jwt_secrets() -> list[str]:
    ordered = [
        os.getenv("AUTH_JWT_SECRET"),
        os.getenv("TICKET_JWT_SECRET"),
        local_secret(),
    ]
    try:
        from app.core.config import get_settings
        from app.core.security import get_jwt_verification_key

        settings = get_settings()
        key = get_jwt_verification_key(settings)
        if key:
            ordered.insert(0, key if isinstance(key, str) else key.decode("utf-8", errors="ignore"))
    except Exception:
        pass
    seen: set[str] = set()
    out: list[str] = []
    for secret in ordered:
        if not secret or secret in seen:
            continue
        seen.add(secret)
        out.append(str(secret))
    return out


def _decode_driver_token(token: str) -> dict:
    raw = token.strip()
    last_error: Exception | None = None
    for secret in _jwt_secrets():
        try:
            payload = jwt.decode(raw, secret, algorithms=[JWT_ALGORITHM])
            break
        except jwt.PyJWTError as exc:
            last_error = exc
            payload = None
    else:
        raise last_error or jwt.InvalidTokenError("Invalid driver token")
    if "driver" not in (payload.get("roles") or []):
        raise jwt.InvalidTokenError("Not a driver session")
    return payload


def _decode_admin_ws_token(token: str | None) -> dict:
    """Validate admin Bearer/query token for live-map / alerts WebSockets."""
    if os.getenv("ADMIN_AUTH_DISABLED", "").lower() in ("1", "true", "yes"):
        return {
            "tenant_id": os.getenv("DEFAULT_TENANT_ID") or str(DEMO_TENANT),
            "roles": ["tenant_admin", "superadmin"],
            "sub": "dev-admin",
        }
    raw = (token or "").strip()
    if not raw:
        raise jwt.InvalidTokenError("Missing admin token")
    last_error: Exception | None = None
    payload = None
    algo = os.getenv("AUTH_JWT_ALGORITHM", "HS256")
    for secret in _admin_jwt_secrets():
        try:
            payload = jwt.decode(raw, secret, algorithms=[algo])
            break
        except jwt.PyJWTError as exc:
            last_error = exc
            payload = None
    else:
        raise last_error or jwt.InvalidTokenError("Invalid admin token")
    roles = set(payload.get("roles") or [])
    if not roles & _ADMIN_WS_ROLES:
        raise jwt.InvalidTokenError("Admin access required")
    if not payload.get("tenant_id"):
        raise jwt.InvalidTokenError("tenant_id required")
    return payload


async def _reject_ws(websocket: WebSocket, code: int, detail: str) -> None:
    await websocket.accept()
    await websocket.send_text(json.dumps({"type": "error", "detail": detail}))
    await websocket.close(code=code)


@router.websocket("/ws/passenger/eta/{trip_id}")
async def passenger_eta_ws(
    websocket: WebSocket,
    trip_id: int,
    tenant_id: UUID | None = Query(default=None),
    token: str | None = Query(default=None),
):
    """
    Passenger ETA feed. Prefer signed track token when provided.
    Client-supplied tenant_id alone is ignored in production unless
    PASSENGER_ETA_ALLOW_TENANT_QUERY=1 (dev only).
    """
    tid = DEMO_TENANT
    allow_query = os.getenv("PASSENGER_ETA_ALLOW_TENANT_QUERY", "").lower() in ("1", "true", "yes")
    env = os.getenv("ENVIRONMENT", "development").lower()
    if token:
        try:
            # Track tokens may embed tenant_id — reuse admin/driver secret decode loosely.
            payload = None
            for secret in _jwt_secrets():
                try:
                    payload = jwt.decode(token.strip(), secret, algorithms=[JWT_ALGORITHM])
                    break
                except jwt.PyJWTError:
                    continue
            if payload and payload.get("tenant_id"):
                tid = UUID(str(payload["tenant_id"]))
            elif tenant_id and (allow_query or env in ("development", "dev", "local")):
                tid = tenant_id
        except Exception:
            await _reject_ws(websocket, 4401, "invalid_token")
            return
    elif tenant_id and (allow_query or env in ("development", "dev", "local")):
        tid = tenant_id
    elif env not in ("development", "dev", "local"):
        await _reject_ws(websocket, 4401, "track_token_required")
        return

    hub = get_eta_ws_hub()
    await hub.connect(trip_id, websocket)

    snap = await resolve_eta_snapshot(trip_id, tid)
    if snap:
        await websocket.send_text(json.dumps(snapshot_to_payload(snap)))

    try:
        while True:
            msg = await websocket.receive_text()
            if msg.strip().lower() == "ping":
                await websocket.send_text('{"type":"pong"}')
    except WebSocketDisconnect:
        hub.disconnect(trip_id, websocket)


@router.websocket("/ws/admin/telemetry/alerts")
async def admin_telemetry_alerts_ws(
    websocket: WebSocket,
    token: str | None = Query(default=None),
    tenant_id: UUID | None = Query(default=None),
):
    try:
        payload = _decode_admin_ws_token(token)
    except jwt.PyJWTError:
        await _reject_ws(websocket, 4401, "unauthorized")
        return

    jwt_tid = str(payload["tenant_id"])
    # Ignore client-supplied tenant_id unless it matches the JWT (legacy query).
    if tenant_id is not None and str(tenant_id) != jwt_tid:
        await _reject_ws(websocket, 4403, "tenant_mismatch")
        return

    tid = jwt_tid
    hub = get_alerts_ws_hub()
    await hub.connect(tid, websocket)

    from travel_platform.telemetry.alerts import TelemetryAlertBus

    recent = TelemetryAlertBus.list_recent(tid, limit=30)
    await websocket.send_text(json.dumps({"type": "alerts_snapshot", "alerts": recent}))

    try:
        while True:
            msg = await websocket.receive_text()
            if msg.strip().lower() == "ping":
                await websocket.send_text('{"type":"pong"}')
    except WebSocketDisconnect:
        hub.disconnect(tid, websocket)


@router.websocket("/ws/telemetry/ingress")
async def driver_telemetry_ingress_ws(
    websocket: WebSocket,
    token: str | None = Query(default=None),
):
    """
    Driver PWA — authenticated via Master QR JWT (?token=) or first JSON auth message.
    Payload: {lat, lng, speed, heading, driver_id, tenant_id, timestamp, bus_plate?, driver_name?}
    """
    from travel_platform.telemetry.driver_shift_notifications import notify_driver_shift
    from travel_platform.telemetry.driver_shift_tracker import on_driver_connected, on_driver_disconnected

    session: dict | None = None
    connection_id = id(websocket)
    online_notified = False

    async def _maybe_notify_online(sess: dict) -> None:
        nonlocal online_notified
        if online_notified or not sess:
            return
        if on_driver_connected(sess, connection_id):
            online_notified = True
            asyncio.create_task(notify_driver_shift("online", sess))

    # Accept first so proxies/browsers complete the Upgrade; then auth.
    await websocket.accept()

    if token:
        try:
            session = _decode_driver_token(token)
        except jwt.PyJWTError:
            await websocket.send_text(json.dumps({"type": "error", "detail": "invalid_token"}))
            await websocket.close(code=4401)
            return

    if session:
        await websocket.send_text(json.dumps({"type": "ready", "trip_id": session.get("trip_id")}))
        await _maybe_notify_online(session)

    try:
        while True:
            raw = await websocket.receive_text()
            if raw.strip().lower() == "ping":
                await websocket.send_text('{"type":"pong"}')
                continue
            try:
                body = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "detail": "invalid_json"}))
                continue

            if body.get("type") == "auth" and body.get("token"):
                try:
                    session = _decode_driver_token(str(body["token"]))
                    await websocket.send_text(json.dumps({"type": "authenticated"}))
                    await _maybe_notify_online(session)
                except jwt.PyJWTError:
                    await websocket.send_text(json.dumps({"type": "error", "detail": "invalid_token"}))
                continue

            if not session:
                await websocket.send_text(json.dumps({"type": "error", "detail": "auth_required"}))
                continue

            try:
                result = await ingest_driver_location(body, session=session)
                if result.get("rate_limited"):
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "rate_limited",
                                "retry_after_sec": result.get("retry_after_sec"),
                                "tenant_id": result.get("tenant_id"),
                            },
                        ),
                    )
                else:
                    await websocket.send_text(json.dumps({"type": "ack", **result}))
            except Exception as exc:
                logger.warning("Driver telemetry ingest failed: %s", exc)
                await websocket.send_text(json.dumps({"type": "error", "detail": str(exc)[:200]}))
    except WebSocketDisconnect:
        if session:
            from travel_platform.telemetry.driver_gps_heartbeat import clear_driver_gps

            clear_driver_gps(session)
            if on_driver_disconnected(session, connection_id):
                asyncio.create_task(notify_driver_shift("offline", session))
        return


@router.websocket("/ws/telemetry/egress/{tenant_id}")
async def admin_fleet_egress_ws(
    websocket: WebSocket,
    tenant_id: UUID,
    token: str | None = Query(default=None),
):
    """Admin live map — streams fleet_location events. Tenant from JWT only."""
    try:
        payload = _decode_admin_ws_token(token)
    except jwt.PyJWTError:
        await _reject_ws(websocket, 4401, "unauthorized")
        return

    jwt_tid = str(payload["tenant_id"])
    roles = set(payload.get("roles") or [])
    # Office admins always bind to JWT tenant (path cannot spoof another office).
    # Superadmin may open any tenant's egress stream.
    if "superadmin" in roles:
        tid = str(tenant_id)
        tenant_uuid = tenant_id
    else:
        if str(tenant_id) != jwt_tid:
            await _reject_ws(websocket, 4403, "tenant_mismatch")
            return
        tid = jwt_tid
        tenant_uuid = UUID(jwt_tid)

    hub = get_fleet_egress_hub()
    await ensure_redis_bridge(tid)
    await hub.connect(tid, websocket)

    from travel_platform.telemetry.processor import get_live_fleet

    live = get_live_fleet()
    snapshot = []
    from travel_platform.telemetry.trip_title_resolve import resolve_trip_title

    for vehicle in await live.list_active_for_admin_async(tenant_uuid):
        meta = await live.vehicle_meta_async(tenant_uuid, vehicle.vehicle_id)
        if not meta:
            meta = live._vehicles.get(vehicle.vehicle_id, {})
        trip_title = await resolve_trip_title(vehicle.trip_id, preferred=meta.get("trip_title"))
        snapshot.append(
            {
                "type": "fleet_snapshot",
                "vehicle_id": vehicle.vehicle_id,
                "vehicle_code": vehicle.vehicle_code,
                "bus_plate": meta.get("bus_plate", vehicle.vehicle_code),
                "driver_name": meta.get("driver_name", "—"),
                "driver_id": meta.get("driver_id"),
                "trip_id": vehicle.trip_id,
                "trip_title": trip_title or None,
                "lat": vehicle.lat,
                "lng": vehicle.lng,
                "speed": vehicle.speed_kmh,
                "heading": meta.get("heading_deg"),
                "timestamp": vehicle.updated_at.isoformat(),
            },
        )
    await websocket.send_text(json.dumps({"type": "fleet_snapshot", "vehicles": snapshot}))

    try:
        while True:
            msg = await websocket.receive_text()
            if msg.strip().lower() == "ping":
                await websocket.send_text('{"type":"pong"}')
    except WebSocketDisconnect:
        hub.disconnect(tid, websocket)
