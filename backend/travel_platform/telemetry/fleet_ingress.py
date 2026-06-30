"""Driver smartphone GPS ingress — normalize, publish, buffer, process."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from travel_platform.telemetry.coordinate_buffer import BufferedCoordinate, push_coordinate
from travel_platform.telemetry.fleet_pubsub import publish_fleet_location
from travel_platform.telemetry.fleet_ws_hub import get_fleet_egress_hub
from travel_platform.telemetry.processor import process_telemetry_payload

logger = logging.getLogger(__name__)


def driver_payload_to_telemetry(
    body: dict[str, Any],
    *,
    session: dict[str, Any],
) -> dict[str, Any]:
    """Map driver PWA JSON to internal telemetry ingest shape."""
    lat = float(body.get("lat") or body.get("latitude"))
    lng = float(body.get("lng") or body.get("longitude"))
    speed = float(body.get("speed") or body.get("speed_kmh") or 0)
    heading = body.get("heading") or body.get("heading_deg")
    ts = body.get("timestamp") or body.get("recorded_at")
    tenant_id = str(body.get("tenant_id") or session.get("tenant_id"))
    driver_id = str(body.get("driver_id") or session.get("driver_id") or session.get("sub") or "driver")
    trip_id = body.get("trip_id") or session.get("trip_id")
    vehicle_code = str(
        body.get("bus_plate")
        or body.get("vehicle_code")
        or session.get("vehicle_code")
        or f"BUS-{trip_id or 'X'}",
    )
    driver_name = str(body.get("driver_name") or session.get("driver_name") or "Driver")

    if isinstance(ts, (int, float)):
        recorded_at = datetime.fromtimestamp(float(ts) / 1000 if ts > 1e12 else ts, tz=timezone.utc).isoformat()
    elif isinstance(ts, str):
        recorded_at = ts
    else:
        recorded_at = datetime.now(timezone.utc).isoformat()

    return {
        "tenant_id": tenant_id,
        "trip_id": int(trip_id) if trip_id is not None else None,
        "vehicle_code": vehicle_code,
        "latitude": lat,
        "longitude": lng,
        "speed_kmh": speed,
        "heading_deg": float(heading) if heading is not None else None,
        "engine_on": speed > 3,
        "recorded_at": recorded_at,
        "driver_id": driver_id,
        "driver_name": driver_name,
        "bus_plate": vehicle_code,
        "source": "driver_pwa",
    }


async def ingest_driver_location(body: dict[str, Any], *, session: dict[str, Any]) -> dict[str, Any]:
    tenant_id = str(body.get("tenant_id") or session.get("tenant_id") or "")

    from travel_platform.telemetry.ingress_rate_limit import check_driver_gps_rate_limit
    from travel_platform.telemetry.settings_store import get_telemetry_settings

    settings = get_telemetry_settings(tenant_id or None)
    rate = check_driver_gps_rate_limit(
        tenant_id=tenant_id,
        session=session,
        body=body,
        max_per_minute=settings.driver_gps_max_per_minute,
    )
    if not rate.allowed:
        try:
            from travel_platform.telemetry.fleet_metrics import record_gps_rate_limited

            record_gps_rate_limited(tenant_id)
        except Exception:
            pass
        return {
            "ok": False,
            "rate_limited": True,
            "retry_after_sec": rate.retry_after_sec,
            "tenant_id": tenant_id,
        }

    payload = driver_payload_to_telemetry(body, session=session)
    tenant_id = str(payload["tenant_id"])

    await process_telemetry_payload(payload)

    vehicle_id = None
    try:
        from travel_platform.telemetry.processor import get_live_fleet

        fleet = get_live_fleet()
        for vid, meta in fleet._vehicles.items():
            if meta.get("tenant_id") == tenant_id and meta.get("vehicle_code") == payload["vehicle_code"]:
                vehicle_id = vid
                break
    except Exception:
        pass

    egress = {
        "type": "fleet_location",
        "tenant_id": tenant_id,
        "trip_id": payload.get("trip_id"),
        "driver_id": payload.get("driver_id"),
        "driver_name": payload.get("driver_name"),
        "bus_plate": payload.get("bus_plate"),
        "vehicle_code": payload.get("vehicle_code"),
        "vehicle_id": vehicle_id,
        "lat": payload["latitude"],
        "lng": payload["longitude"],
        "speed": payload["speed_kmh"],
        "heading": payload.get("heading_deg"),
        "timestamp": payload["recorded_at"],
    }

    await publish_fleet_location(tenant_id, egress)
    await get_fleet_egress_hub().broadcast(tenant_id, egress)

    from travel_platform.telemetry.fleet_location_webhook import maybe_dispatch_fleet_location_webhook

    maybe_dispatch_fleet_location_webhook(tenant_id, egress)

    recorded = payload["recorded_at"]
    if isinstance(recorded, str):
        recorded_dt = datetime.fromisoformat(recorded.replace("Z", "+00:00"))
    else:
        recorded_dt = datetime.now(timezone.utc)

    push_coordinate(
        BufferedCoordinate(
            tenant_id=tenant_id,
            trip_id=payload.get("trip_id"),
            driver_id=str(payload.get("driver_id")) if payload.get("driver_id") else None,
            vehicle_id=vehicle_id,
            lat=float(payload["latitude"]),
            lng=float(payload["longitude"]),
            speed_kmh=float(payload["speed_kmh"]),
            heading_deg=payload.get("heading_deg"),
            recorded_at=recorded_dt,
            raw=payload,
        ),
    )

    from travel_platform.telemetry.fleet_metrics import record_gps_ingress

    record_gps_ingress(tenant_id)

    from travel_platform.telemetry.driver_gps_heartbeat import touch_driver_gps

    was_stale = touch_driver_gps(
        session,
        vehicle_id=vehicle_id,
        recorded_at=payload["recorded_at"],
    )
    if was_stale:
        import asyncio

        from travel_platform.telemetry.driver_shift_notifications import notify_driver_shift

        asyncio.create_task(
            notify_driver_shift("online", session, body={"reason": "gps_resume"}),
        )

    trip_id = payload.get("trip_id")
    if trip_id is not None:
        try:
            from uuid import UUID

            from travel_platform.telemetry.eta_intelligence import get_eta_service

            eta_svc = get_eta_service()
            snap = await eta_svc.compute_eta(
                tenant_id=UUID(tenant_id),
                trip_id=int(trip_id),
                origin_lat=float(payload["latitude"]),
                origin_lng=float(payload["longitude"]),
            )
            if snap:
                eta_svc._cache[(tenant_id, int(trip_id))] = snap
        except Exception:
            pass

    return {"ok": True, "tenant_id": tenant_id}
