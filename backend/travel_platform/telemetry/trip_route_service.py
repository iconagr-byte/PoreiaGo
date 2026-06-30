"""Ανάκτηση ιστορικών GPS σημείων από trip_coordinates (PostGIS)."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

MAX_ROUTE_POINTS = 10_000


async def fetch_trip_route(
    session: AsyncSession,
    *,
    tenant_id: UUID,
    trip_id: int,
    from_time: datetime | None = None,
    to_time: datetime | None = None,
    driver_id: UUID | None = None,
    limit: int = 5000,
) -> dict[str, Any]:
    """Επιστρέφει διατεταγμένα σημεία διαδρομής για playback."""
    cap = min(max(1, limit), MAX_ROUTE_POINTS)
    params: dict[str, Any] = {
        "tenant_id": str(tenant_id),
        "trip_id": trip_id,
        "from_time": from_time,
        "to_time": to_time,
        "driver_id": str(driver_id) if driver_id else None,
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
          AND (:driver_id IS NULL OR driver_id = CAST(:driver_id AS uuid))
        ORDER BY recorded_at ASC
        LIMIT :limit
    """

    try:
        result = await session.execute(text(sql), params)
        rows = result.mappings().all()
    except Exception as exc:
        logger.warning("trip_coordinates query failed: %s", exc)
        return {
            "trip_id": trip_id,
            "tenant_id": str(tenant_id),
            "point_count": 0,
            "points": [],
            "error": "database_unavailable",
        }

    points = [_row_to_point(row) for row in rows]
    return {
        "trip_id": trip_id,
        "tenant_id": str(tenant_id),
        "point_count": len(points),
        "from_time": points[0]["recorded_at"] if points else None,
        "to_time": points[-1]["recorded_at"] if points else None,
        "points": points,
    }


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
    }
