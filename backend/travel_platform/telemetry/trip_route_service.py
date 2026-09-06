"""Ανάκτηση ιστορικών GPS σημείων από trip_coordinates (PostGIS) + live buffer."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

MAX_ROUTE_POINTS = 10_000


def _is_uuid(value: str | None) -> bool:
    if not value:
        return False
    try:
        UUID(str(value))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


async def fetch_trip_route(
    session: AsyncSession,
    *,
    tenant_id: UUID,
    trip_id: int,
    from_time: datetime | None = None,
    to_time: datetime | None = None,
    driver_id: UUID | str | None = None,
    limit: int = 5000,
) -> dict[str, Any]:
    """Επιστρέφει διατεταγμένα σημεία διαδρομής για playback.

    Combines PostGIS history with in-memory points still waiting to flush so
    Route History can show GPS as soon as the driver app sends it (live map path).
    """
    cap = min(max(1, limit), MAX_ROUTE_POINTS)
    driver_key = str(driver_id).strip() if driver_id else None
    driver_uuid = driver_key if _is_uuid(driver_key) else None
    params: dict[str, Any] = {
        "tenant_id": str(tenant_id),
        "trip_id": trip_id,
        "from_time": from_time,
        "to_time": to_time,
        "driver_uuid": driver_uuid,
        "driver_key": driver_key,
        "limit": cap,
    }

    sql = """
        SELECT
            id,
            trip_id,
            driver_id,
            vehicle_id,
            recorded_at,
            speed_kmh,
            heading_deg,
            ST_Y(geom::geometry) AS lat,
            ST_X(geom::geometry) AS lng
        FROM trip_coordinates
        WHERE tenant_id = CAST(:tenant_id AS uuid)
          AND trip_id = :trip_id
          AND (:from_time IS NULL OR recorded_at >= :from_time)
          AND (:to_time IS NULL OR recorded_at <= :to_time)
          AND (
            :driver_key IS NULL
            OR (:driver_uuid IS NOT NULL AND driver_id = CAST(:driver_uuid AS uuid))
            OR raw_payload->>'driver_id' = :driver_key
          )
        ORDER BY recorded_at ASC
        LIMIT :limit
    """

    points: list[dict[str, Any]] = []
    db_error = None
    try:
        result = await session.execute(text(sql), params)
        rows = result.mappings().all()
        points = [_row_to_point(row) for row in rows]
    except Exception as exc:
        logger.warning("trip_coordinates query failed: %s", exc)
        db_error = "database_unavailable"

    # Near-real-time: include GPS still in the live ingest buffer (pre-flush).
    try:
        from travel_platform.telemetry.coordinate_buffer import peek_matching

        pending = peek_matching(
            tenant_id=str(tenant_id),
            trip_id=trip_id,
            driver_id=driver_key,
            from_time=from_time,
            to_time=to_time,
            limit=cap,
        )
        if pending:
            existing_keys = {
                (p["recorded_at"], round(p["lat"], 6), round(p["lng"], 6)) for p in points
            }
            for idx, row in enumerate(pending):
                recorded = row.recorded_at
                recorded_at = recorded.isoformat() if isinstance(recorded, datetime) else str(recorded)
                key = (recorded_at, round(row.lat, 6), round(row.lng, 6))
                if key in existing_keys:
                    continue
                points.append(
                    {
                        "id": -(idx + 1),
                        "trip_id": row.trip_id,
                        "driver_id": str(row.driver_id) if row.driver_id else None,
                        "vehicle_id": str(row.vehicle_id) if row.vehicle_id else None,
                        "lat": float(row.lat),
                        "lng": float(row.lng),
                        "speed_kmh": float(row.speed_kmh or 0),
                        "heading_deg": float(row.heading_deg) if row.heading_deg is not None else None,
                        "recorded_at": recorded_at,
                        "source": "live_buffer",
                    },
                )
                existing_keys.add(key)
            points.sort(key=lambda p: p.get("recorded_at") or "")
            if len(points) > cap:
                points = points[-cap:]
    except Exception as exc:
        logger.debug("live buffer merge skipped: %s", exc)

    # Active-shift Redis trail (authoritative path while the bus is live).
    try:
        from travel_platform.telemetry.live_fleet_trail_redis import load_trails_for_tenant
        from travel_platform.telemetry.processor import get_live_fleet

        live = get_live_fleet()
        vehicles = await live.list_active_for_admin_async(tenant_id)
        vehicle_ids: list[str] = []
        for v in vehicles:
            vid = str(getattr(v, "vehicle_id", "") or "")
            if not vid:
                continue
            if getattr(v, "trip_id", None) == trip_id:
                vehicle_ids.append(vid)
                continue
            if driver_key:
                meta = await live.vehicle_meta_async(tenant_id, v.vehicle_id) or {}
                if str(meta.get("driver_id") or "") == driver_key:
                    vehicle_ids.append(vid)
        vehicle_ids = list(dict.fromkeys(vehicle_ids))

        if vehicle_ids:
            trails = await load_trails_for_tenant(str(tenant_id), vehicle_ids)
            existing_keys = {
                (p.get("recorded_at"), round(p["lat"], 6), round(p["lng"], 6)) for p in points
            }
            added = 0
            for vid, trail in trails.items():
                for p in trail:
                    recorded_at = str(p.get("t") or "")
                    try:
                        lat, lng = float(p["lat"]), float(p["lng"])
                    except (KeyError, TypeError, ValueError):
                        continue
                    key = (recorded_at, round(lat, 6), round(lng, 6))
                    if key in existing_keys:
                        continue
                    if from_time or to_time:
                        try:
                            ts = datetime.fromisoformat(recorded_at.replace("Z", "+00:00"))
                            if from_time is not None and ts < from_time:
                                continue
                            if to_time is not None and ts > to_time:
                                continue
                        except Exception:
                            pass
                    added += 1
                    points.append(
                        {
                            "id": -(10_000 + added),
                            "trip_id": trip_id,
                            "driver_id": driver_key,
                            "vehicle_id": vid,
                            "lat": lat,
                            "lng": lng,
                            "speed_kmh": float(p.get("s") or 0),
                            "heading_deg": float(p["h"]) if p.get("h") is not None else None,
                            "recorded_at": recorded_at or None,
                            "source": "live_trail",
                        },
                    )
                    existing_keys.add(key)
            points.sort(key=lambda p: p.get("recorded_at") or "")
            if len(points) > cap:
                points = points[-cap:]
    except Exception as exc:
        logger.debug("live trail merge skipped: %s", exc)

    payload: dict[str, Any] = {
        "trip_id": trip_id,
        "tenant_id": str(tenant_id),
        "point_count": len(points),
        "from_time": points[0]["recorded_at"] if points else None,
        "to_time": points[-1]["recorded_at"] if points else None,
        "points": points,
    }
    if db_error and not points:
        payload["error"] = db_error
    return payload


def _row_to_point(row: Any) -> dict[str, Any]:
    recorded = row["recorded_at"]
    if isinstance(recorded, datetime):
        recorded_at = recorded.isoformat()
    else:
        recorded_at = str(recorded)
    heading = row.get("heading_deg") if hasattr(row, "get") else row["heading_deg"]
    return {
        "id": int(row["id"]),
        "trip_id": row.get("trip_id") if hasattr(row, "get") else row["trip_id"],
        "driver_id": str(row["driver_id"]) if row.get("driver_id") else None,
        "vehicle_id": str(row["vehicle_id"]) if row.get("vehicle_id") else None,
        "lat": float(row["lat"]),
        "lng": float(row["lng"]),
        "speed_kmh": float(row.get("speed_kmh") or 0),
        "heading_deg": float(heading) if heading is not None else None,
        "recorded_at": recorded_at,
        "source": "postgis",
    }
