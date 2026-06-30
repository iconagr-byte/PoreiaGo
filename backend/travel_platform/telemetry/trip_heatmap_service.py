"""Heatmap aggregation από trip_coordinates (PostGIS)."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

DEFAULT_CELL_SIZE = 0.01
DEFAULT_DAYS = 7
MAX_CELLS = 500
MIN_WEIGHT = 2


def aggregate_points_to_grid(
    points: list[dict[str, float]],
    *,
    cell_size: float = DEFAULT_CELL_SIZE,
    min_weight: int = MIN_WEIGHT,
    max_cells: int = MAX_CELLS,
) -> list[dict[str, Any]]:
    """Pure-Python grid — για tests και offline fallback."""
    if cell_size <= 0:
        return []
    grid: dict[tuple[int, int], list[tuple[float, float]]] = defaultdict(list)
    for pt in points:
        lat = float(pt["lat"])
        lng = float(pt["lng"])
        cell = (int(lat / cell_size), int(lng / cell_size))
        grid[cell].append((lat, lng))

    rows: list[dict[str, Any]] = []
    for (_clat, _clng), coords in grid.items():
        if len(coords) < min_weight:
            continue
        lat = sum(c[0] for c in coords) / len(coords)
        lng = sum(c[1] for c in coords) / len(coords)
        rows.append({"lat": round(lat, 6), "lng": round(lng, 6), "weight": len(coords)})

    rows.sort(key=lambda r: r["weight"], reverse=True)
    return rows[:max_cells]


async def fetch_trip_heatmap(
    session: AsyncSession,
    *,
    tenant_id: UUID,
    trip_id: int | None = None,
    driver_id: UUID | None = None,
    from_time: datetime | None = None,
    to_time: datetime | None = None,
    cell_size: float = DEFAULT_CELL_SIZE,
    min_weight: int = MIN_WEIGHT,
    max_cells: int = MAX_CELLS,
    slow_only: bool = False,
    slow_speed_kmh: float = 8.0,
    default_days: int = DEFAULT_DAYS,
) -> dict[str, Any]:
    """Grid heatmap από ιστορικά GPS σημεία."""
    cap = min(max(1, max_cells), 2000)
    min_w = max(1, min_weight)
    cell = max(0.001, min(cell_size, 0.1))

    effective_from = from_time
    if effective_from is None and default_days > 0:
        effective_from = datetime.now(timezone.utc) - timedelta(days=default_days)

    params: dict[str, Any] = {
        "tenant_id": str(tenant_id),
        "trip_id": trip_id,
        "driver_id": str(driver_id) if driver_id else None,
        "from_time": effective_from,
        "to_time": to_time,
        "cell_size": cell,
        "min_weight": min_w,
        "max_cells": cap,
        "slow_only": slow_only,
        "slow_speed": slow_speed_kmh,
    }

    sql = """
        SELECT
            FLOOR(ST_Y(geom::geometry) / :cell_size) AS cell_lat,
            FLOOR(ST_X(geom::geometry) / :cell_size) AS cell_lng,
            COUNT(*)::int AS weight,
            AVG(ST_Y(geom::geometry)) AS lat,
            AVG(ST_X(geom::geometry)) AS lng
        FROM trip_coordinates
        WHERE tenant_id = CAST(:tenant_id AS uuid)
          AND (:trip_id IS NULL OR trip_id = :trip_id)
          AND (:driver_id IS NULL OR driver_id = CAST(:driver_id AS uuid))
          AND (:from_time IS NULL OR recorded_at >= :from_time)
          AND (:to_time IS NULL OR recorded_at <= :to_time)
          AND (:slow_only = false OR speed_kmh < :slow_speed)
        GROUP BY cell_lat, cell_lng
        HAVING COUNT(*) >= :min_weight
        ORDER BY weight DESC
        LIMIT :max_cells
    """

    try:
        result = await session.execute(text(sql), params)
        rows = result.mappings().all()
    except Exception as exc:
        logger.warning("trip_coordinates heatmap query failed: %s", exc)
        return {
            "points": [],
            "cell_size": cell,
            "source": "trip_coordinates",
            "error": "database_unavailable",
            "from_time": effective_from.isoformat() if effective_from else None,
            "to_time": to_time.isoformat() if to_time else None,
        }

    points = [
        {
            "lat": round(float(row["lat"]), 6),
            "lng": round(float(row["lng"]), 6),
            "weight": int(row["weight"]),
        }
        for row in rows
    ]
    return {
        "points": points,
        "cell_size": cell,
        "source": "trip_coordinates",
        "point_count": sum(p["weight"] for p in points),
        "cell_count": len(points),
        "from_time": effective_from.isoformat() if effective_from else None,
        "to_time": to_time.isoformat() if to_time else None,
        "slow_only": slow_only,
        "error": None,
    }
