"""Telemetry pipeline — normalize, geofence, idle, live state."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from travel_platform.telemetry.alerts import TelemetryAlertBus
from travel_platform.telemetry.corridor_geofence import CorridorGeofenceService
from travel_platform.telemetry.domain import NormalizedTelemetry, TelemetryUpdate
from travel_platform.telemetry.driving_behavior import DrivingBehaviorService
from travel_platform.telemetry.geofence import GeofenceService
from travel_platform.telemetry.idling import IdlingAnalyticsService
from travel_platform.telemetry.live_fleet import LiveFleetService

logger = logging.getLogger(__name__)

_idling = IdlingAnalyticsService()
_geofence = GeofenceService()
_corridor = CorridorGeofenceService()
_driving = DrivingBehaviorService()
_live = LiveFleetService()


async def process_telemetry_payload(payload: dict) -> NormalizedTelemetry:
    update = _parse_payload(payload)
    vehicle_id = _live.upsert_vehicle_registry(
        update.tenant_id,
        update.vehicle_code,
        update.trip_id,
    )

    meta = _live._vehicles.get(str(vehicle_id), {})
    raw = update.raw or {}
    if raw.get("driver_name"):
        meta["driver_name"] = raw.get("driver_name")
    if raw.get("bus_plate") or raw.get("vehicle_code"):
        meta["bus_plate"] = raw.get("bus_plate") or raw.get("vehicle_code")
    if raw.get("heading_deg") is not None:
        meta["heading_deg"] = raw.get("heading_deg")
    if raw.get("driver_id"):
        meta["driver_id"] = raw.get("driver_id")
    if meta:
        _live._vehicles[str(vehicle_id)] = {**_live._vehicles.get(str(vehicle_id), {}), **meta}

    stop = _geofence.check_arrival(update.tenant_id, vehicle_id, update)
    deviation = _corridor.evaluate(update.tenant_id, vehicle_id, update)
    route_deviation = False
    if deviation:
        route_deviation = True
        TelemetryAlertBus.push_route_deviation(deviation)

    driver_id = None
    raw = update.raw or {}
    if raw.get("driver_id"):
        try:
            driver_id = UUID(str(raw["driver_id"]))
        except ValueError:
            pass
    driving_evt = _driving.process(driver_id, vehicle_id, update)
    driving_event = False
    if driving_evt:
        driving_event = True
        TelemetryAlertBus.push_driving_event(
            tenant_id=str(update.tenant_id),
            vehicle_id=str(vehicle_id),
            trip_id=update.trip_id,
            event=driving_evt,
        )

    idle_alert = _idling.process_point(vehicle_id, update)
    if idle_alert:
        logger.warning("IDLE ALERT: %s", idle_alert.message)

    idle_sec = _idling.trip_idle_seconds(vehicle_id)
    _live.apply_update(vehicle_id, update, idle_seconds=idle_sec)

    try:
        from travel_platform.telemetry.live_fleet_redis import save_live_vehicle

        meta = _live._vehicles.get(str(vehicle_id), {})
        if meta:
            await save_live_vehicle(meta)
    except Exception:
        logger.debug("live fleet Redis save skipped", exc_info=True)

    return NormalizedTelemetry(
        update=update,
        vehicle_id=vehicle_id,
        matched_stop_id=stop.id if stop else None,
        stop_arrival_triggered=stop is not None,
        route_deviation=route_deviation,
        driving_event=driving_event,
    )


def _parse_payload(payload: dict) -> TelemetryUpdate:
    tenant_id = UUID(str(payload["tenant_id"]))
    recorded = payload.get("recorded_at")
    if isinstance(recorded, str):
        recorded_at = datetime.fromisoformat(recorded.replace("Z", "+00:00"))
    else:
        recorded_at = datetime.now(timezone.utc)

    engine_raw = payload.get("engine_status", payload.get("engine_on", "off"))
    if isinstance(engine_raw, bool):
        engine_on = engine_raw
    else:
        engine_on = str(engine_raw).lower() in ("on", "idle", "running", "1", "true")

    return TelemetryUpdate(
        vehicle_code=str(payload.get("vehicle_code") or payload.get("bus_plate") or "UNKNOWN"),
        tenant_id=tenant_id,
        trip_id=payload.get("trip_id"),
        latitude=float(payload.get("latitude", payload.get("lat"))),
        longitude=float(payload.get("longitude", payload.get("lng"))),
        speed_kmh=float(payload.get("speed_kmh", payload.get("speed", 0))),
        engine_on=engine_on,
        fuel_level_pct=payload.get("fuel_level_pct"),
        recorded_at=recorded_at,
        raw=dict(payload),
    )


def get_live_fleet() -> LiveFleetService:
    return _live


def get_idling() -> IdlingAnalyticsService:
    return _idling
