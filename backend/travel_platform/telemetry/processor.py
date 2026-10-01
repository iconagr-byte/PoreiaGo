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
    raw = update.raw or {}

    # Bind active office excursion (plate/driver + time window) when GPS has no trip_id.
    if update.trip_id is None:
        try:
            from travel_platform.telemetry.active_excursion_resolve import resolve_active_excursion

            hit = resolve_active_excursion(
                str(update.tenant_id),
                vehicle_code=update.vehicle_code,
                bus_plate=raw.get("bus_plate"),
                driver_id=raw.get("driver_id"),
            )
            if hit:
                raw = {
                    **raw,
                    "trip_title": hit["title"],
                    "trip_id": hit["trip_id"],
                }
                update = TelemetryUpdate(
                    vehicle_code=update.vehicle_code,
                    tenant_id=update.tenant_id,
                    trip_id=int(hit["trip_id"]),
                    latitude=update.latitude,
                    longitude=update.longitude,
                    speed_kmh=update.speed_kmh,
                    engine_on=update.engine_on,
                    fuel_level_pct=update.fuel_level_pct,
                    recorded_at=update.recorded_at,
                    raw=raw,
                )
        except Exception:
            logger.debug("active excursion resolve skipped", exc_info=True)

    vehicle_id = _live.upsert_vehicle_registry(
        update.tenant_id,
        update.vehicle_code,
        update.trip_id,
    )

    meta = _live._vehicles.get(str(vehicle_id), {})
    if raw.get("driver_name"):
        meta["driver_name"] = raw.get("driver_name")
    if raw.get("bus_plate") or raw.get("vehicle_code"):
        meta["bus_plate"] = raw.get("bus_plate") or raw.get("vehicle_code")
    if raw.get("heading_deg") is not None:
        meta["heading_deg"] = raw.get("heading_deg")
    if raw.get("source"):
        meta["source"] = str(raw.get("source"))
    if raw.get("imei"):
        meta["imei"] = str(raw.get("imei"))
    # Teltonika must not inherit phone driver_id (shift-end would wipe the pin).
    source_l = str(raw.get("source") or meta.get("source") or "").strip().lower()
    is_tracker = source_l.startswith("teltonika") or source_l in {
        "tracker",
        "test_ping",
        "teltonika_test_ping",
    }
    if is_tracker:
        if raw.get("driver_id"):
            meta["driver_id"] = raw.get("driver_id")
        else:
            meta.pop("driver_id", None)
    elif raw.get("driver_id"):
        meta["driver_id"] = raw.get("driver_id")
    preferred_title = raw.get("trip_title") or raw.get("tripTitle") or raw.get("excursion_name")
    if preferred_title:
        meta["trip_title"] = str(preferred_title).strip()
    elif update.trip_id is not None and not meta.get("trip_title"):
        from travel_platform.telemetry.trip_title_resolve import resolve_trip_title

        meta["trip_title"] = await resolve_trip_title(update.trip_id)
    if update.trip_id is not None:
        meta["trip_id"] = update.trip_id
    # First emission clock for this live session (shown on map / history).
    if not meta.get("tracking_started_at"):
        meta["tracking_started_at"] = update.recorded_at.isoformat()
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

    # Durable history + live trail for every GPS source (driver PWA + Teltonika).
    try:
        from travel_platform.telemetry.coordinate_buffer import BufferedCoordinate, push_coordinate

        push_coordinate(
            BufferedCoordinate(
                tenant_id=str(update.tenant_id),
                trip_id=update.trip_id,
                driver_id=str(raw.get("driver_id")) if raw.get("driver_id") else None,
                vehicle_id=str(vehicle_id),
                lat=float(update.latitude),
                lng=float(update.longitude),
                speed_kmh=float(update.speed_kmh or 0),
                heading_deg=raw.get("heading_deg")
                if raw.get("heading_deg") is not None
                else None,
                recorded_at=update.recorded_at,
                raw={
                    **{k: v for k, v in raw.items() if k not in {"accel_x", "accel_y", "accel_z"}},
                    "vehicle_id": str(vehicle_id),
                    "tracking_started_at": meta.get("tracking_started_at"),
                },
            ),
        )
    except Exception:
        logger.exception("history coordinate enqueue failed vehicle=%s", vehicle_id)

    try:
        from travel_platform.telemetry.live_fleet_trail_redis import append_trail_point

        await append_trail_point(
            str(update.tenant_id),
            str(vehicle_id),
            lat=float(update.latitude),
            lng=float(update.longitude),
            speed_kmh=float(update.speed_kmh or 0),
            heading_deg=raw.get("heading_deg"),
            recorded_at=update.recorded_at,
            trip_id=update.trip_id,
            driver_id=str(raw.get("driver_id")) if raw.get("driver_id") else None,
        )
    except Exception:
        logger.exception("live trail append failed vehicle=%s", vehicle_id)

    try:
        from travel_platform.telemetry.live_fleet_redis import save_live_vehicle

        meta = _live._vehicles.get(str(vehicle_id), {})
        if meta:
            ok = await save_live_vehicle(meta)
            if not ok:
                logger.warning(
                    "live fleet Redis save returned false tenant=%s vehicle=%s",
                    update.tenant_id,
                    vehicle_id,
                )
    except Exception:
        logger.warning("live fleet Redis save failed", exc_info=True)

    # Driver PWA already publishes fleet_location from fleet_ingress. Tracker
    # (Teltonika) path needs its own egress so the map badge updates live.
    source = str(raw.get("source") or "").lower()
    if source.startswith("teltonika") or source in {"test_ping", "tracker"}:
        # Drop leftover phone pins for this plate (multi-worker Redis duplicates).
        try:
            await _live.purge_phone_siblings_for_plate(
                str(update.tenant_id),
                update.vehicle_code,
                keep_vehicle_id=str(vehicle_id),
            )
        except Exception:
            logger.debug("teltonika phone-sibling purge skipped", exc_info=True)
        try:
            from travel_platform.telemetry.fleet_pubsub import publish_fleet_location
            from travel_platform.telemetry.fleet_ws_hub import get_fleet_egress_hub

            meta = _live._vehicles.get(str(vehicle_id), {}) or {}
            egress = {
                "type": "fleet_location",
                "tenant_id": str(update.tenant_id),
                "trip_id": update.trip_id or meta.get("trip_id"),
                "trip_title": meta.get("trip_title"),
                "driver_id": meta.get("driver_id") or raw.get("driver_id"),
                "driver_name": meta.get("driver_name") or raw.get("driver_name"),
                "bus_plate": meta.get("bus_plate") or update.vehicle_code,
                "vehicle_code": update.vehicle_code,
                "vehicle_id": str(vehicle_id),
                "lat": float(update.latitude),
                "lng": float(update.longitude),
                "speed": float(update.speed_kmh or 0),
                "heading": raw.get("heading_deg") if raw.get("heading_deg") is not None else meta.get("heading_deg"),
                "timestamp": update.recorded_at.isoformat(),
                "source": raw.get("source") or meta.get("source") or "teltonika",
                "imei": raw.get("imei") or meta.get("imei"),
            }
            await publish_fleet_location(str(update.tenant_id), egress)
            await get_fleet_egress_hub().broadcast(str(update.tenant_id), egress)
        except Exception:
            logger.debug("teltonika fleet_location egress skipped", exc_info=True)

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
