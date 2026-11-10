"""Flush live Redis GPS trails into trip_coordinates (route history)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from travel_platform.telemetry.coordinate_buffer import BufferedCoordinate, push_coordinate
from travel_platform.telemetry.live_fleet_trail_redis import drain_trail

logger = logging.getLogger(__name__)


def _parse_recorded_at(value: Any) -> datetime:
    if isinstance(value, datetime):
        dt = value
    elif value:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            dt = datetime.now(timezone.utc)
    else:
        dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


async def persist_vehicle_trail_to_history(
    tenant_id: str,
    vehicle_id: str,
    *,
    trip_id: int | None = None,
    driver_id: str | None = None,
) -> int:
    """Drain the live trail ring and enqueue every point for PostGIS history."""
    tid = str(tenant_id or "").strip()
    vid = str(vehicle_id or "").strip()
    if not tid or not vid:
        return 0

    points = await drain_trail(tid, vid)
    if not points:
        return 0

    queued = 0
    for p in points:
        try:
            lat = float(p["lat"])
            lng = float(p["lng"])
        except (KeyError, TypeError, ValueError):
            continue
        point_trip = p.get("trip_id")
        try:
            point_trip_id = int(point_trip) if point_trip is not None else trip_id
        except (TypeError, ValueError):
            point_trip_id = trip_id
        push_coordinate(
            BufferedCoordinate(
                tenant_id=tid,
                trip_id=point_trip_id,
                driver_id=str(p.get("driver_id") or driver_id or "") or None,
                vehicle_id=vid,
                lat=lat,
                lng=lng,
                speed_kmh=float(p.get("s") or 0),
                heading_deg=float(p["h"]) if p.get("h") is not None else None,
                recorded_at=_parse_recorded_at(p.get("t")),
                raw={
                    "source": "live_trail_flush",
                    "vehicle_id": vid,
                    "driver_id": p.get("driver_id") or driver_id,
                    "trip_id": point_trip_id,
                },
            ),
        )
        queued += 1

    # Best-effort immediate flush so history survives process restart.
    try:
        from travel_platform.telemetry.coordinate_flush_worker import flush_coordinates_batch

        await flush_coordinates_batch()
    except Exception:
        logger.exception("trail history flush_coordinates_batch failed vehicle=%s", vid)

    logger.info(
        "Persisted live trail to history tenant=%s vehicle=%s points=%s",
        tid,
        vid,
        queued,
    )
    return queued


async def persist_trails_for_vehicles(
    tenant_id: str,
    vehicle_ids: list[str],
    *,
    trip_id: int | None = None,
    driver_id: str | None = None,
) -> int:
    total = 0
    for vid in vehicle_ids or []:
        try:
            total += await persist_vehicle_trail_to_history(
                tenant_id,
                vid,
                trip_id=trip_id,
                driver_id=driver_id,
            )
        except Exception:
            logger.exception("persist trail failed vehicle=%s", vid)
    return total
