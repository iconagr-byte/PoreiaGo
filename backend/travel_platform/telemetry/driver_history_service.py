"""Compose full driver history — activity log + GPS km from trip_coordinates."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from travel_platform.settings.driver_activity_store import (
    activity_summary,
    list_driver_events,
    pair_driver_shifts,
)
from travel_platform.settings.drivers_store import get_driver

logger = logging.getLogger(__name__)


async def fetch_driver_gps_km(
    session: AsyncSession,
    *,
    tenant_id: str,
    driver_id: str,
    from_time: datetime | None = None,
    to_time: datetime | None = None,
) -> dict[str, Any]:
    """Distance + trip breakdown for one driver from PostGIS trip_coordinates."""
    effective_from = from_time or (datetime.now(timezone.utc) - timedelta(days=365))
    params: dict[str, Any] = {
        "tenant_id": str(tenant_id),
        "driver_id": str(driver_id),
        "from_time": effective_from,
        "to_time": to_time,
    }

    distance_sql = """
        SELECT COALESCE(SUM(trip_km), 0) AS total_km
        FROM (
            SELECT
                ST_Length(
                    ST_MakeLine(geom::geometry ORDER BY recorded_at)::geography
                ) / 1000.0 AS trip_km
            FROM trip_coordinates
            WHERE tenant_id = CAST(:tenant_id AS uuid)
              AND driver_id = CAST(:driver_id AS uuid)
              AND trip_id IS NOT NULL
              AND recorded_at >= :from_time
              AND (:to_time IS NULL OR recorded_at <= :to_time)
            GROUP BY trip_id
        ) distances
    """

    trips_sql = """
        SELECT
            trip_id,
            ROUND(
                (ST_Length(
                    ST_MakeLine(geom::geometry ORDER BY recorded_at)::geography
                ) / 1000.0)::numeric,
                2
            ) AS distance_km,
            COUNT(*)::int AS point_count,
            MIN(recorded_at) AS first_at,
            MAX(recorded_at) AS last_at
        FROM trip_coordinates
        WHERE tenant_id = CAST(:tenant_id AS uuid)
          AND driver_id = CAST(:driver_id AS uuid)
          AND trip_id IS NOT NULL
          AND recorded_at >= :from_time
          AND (:to_time IS NULL OR recorded_at <= :to_time)
        GROUP BY trip_id
        ORDER BY last_at DESC NULLS LAST
        LIMIT 50
    """

    try:
        distance_row = (await session.execute(text(distance_sql), params)).mappings().one()
        trip_rows = (await session.execute(text(trips_sql), params)).mappings().all()
    except Exception as exc:
        logger.warning("driver GPS km query failed: %s", exc)
        return {
            "total_km": 0.0,
            "trips": [],
            "error": "database_unavailable",
            "from_time": effective_from.isoformat(),
            "to_time": to_time.isoformat() if to_time else None,
        }

    def _iso(value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value)

    trips = [
        {
            "trip_id": int(row["trip_id"]),
            "distance_km": float(row["distance_km"] or 0),
            "point_count": int(row["point_count"]),
            "first_at": _iso(row.get("first_at")),
            "last_at": _iso(row.get("last_at")),
        }
        for row in trip_rows
    ]
    return {
        "total_km": round(float(distance_row["total_km"] or 0), 2),
        "trips": trips,
        "error": None,
        "from_time": effective_from.isoformat(),
        "to_time": to_time.isoformat() if to_time else None,
    }


async def compute_shift_km(
    session: AsyncSession | None,
    *,
    tenant_id: str,
    driver_id: str,
    from_time: datetime | None,
    to_time: datetime | None = None,
) -> float | None:
    if session is None or not tenant_id or not driver_id or from_time is None:
        return None
    try:
        UUID(str(tenant_id))
        UUID(str(driver_id))
    except (TypeError, ValueError):
        return None
    payload = await fetch_driver_gps_km(
        session,
        tenant_id=tenant_id,
        driver_id=driver_id,
        from_time=from_time,
        to_time=to_time or datetime.now(timezone.utc),
    )
    if payload.get("error"):
        return None
    return float(payload.get("total_km") or 0)


async def build_driver_history(
    session: AsyncSession | None,
    *,
    driver_id: str,
    tenant_id: str | None = None,
    limit: int = 100,
) -> dict[str, Any] | None:
    driver = get_driver(driver_id)
    if not driver:
        return None

    tid = str(tenant_id or "").strip()
    summary = activity_summary(driver_id)
    logins = list_driver_events(
        driver_id,
        limit=limit,
        types=frozenset({"login", "login_master_qr"}),
    )
    shifts = pair_driver_shifts(driver_id, limit=limit)
    events = list_driver_events(driver_id, limit=limit)

    gps: dict[str, Any] = {
        "total_km": 0.0,
        "trips": [],
        "error": None if session and tid else "skipped",
        "from_time": None,
        "to_time": None,
    }
    if session and tid:
        try:
            UUID(tid)
            UUID(str(driver_id))
            gps = await fetch_driver_gps_km(
                session,
                tenant_id=tid,
                driver_id=str(driver_id),
            )
        except (TypeError, ValueError):
            gps["error"] = "invalid_ids"
        except Exception as exc:
            logger.warning("build_driver_history gps failed: %s", exc)
            gps["error"] = "database_unavailable"

    # Prefer live GPS total when available; else shift-tracked + profile seed.
    tracked_km = float(summary.get("shift_km_total") or 0)
    gps_km = float(gps.get("total_km") or 0)
    profile_km = float(driver.total_km or 0)
    display_km = gps_km if gps_km > 0 else (tracked_km if tracked_km > 0 else profile_km)

    timeline: list[dict[str, Any]] = []
    for ev in events:
        timeline.append(
            {
                "id": ev.get("id"),
                "at": ev.get("at"),
                "kind": ev.get("type"),
                "trip_id": ev.get("trip_id"),
                "method": ev.get("method"),
                "shift_id": ev.get("shift_id"),
                "km": ev.get("km"),
                "duration_min": ev.get("duration_min"),
            }
        )

    return {
        "driver_id": driver.id,
        "driver_name": driver.name,
        "summary": {
            **summary,
            "profile_total_km": profile_km,
            "gps_total_km": gps_km,
            "display_total_km": round(display_km, 2),
            "trips_completed": int(driver.trips_completed or 0),
            "gps_error": gps.get("error"),
        },
        "logins": logins,
        "shifts": shifts,
        "km_by_trip": gps.get("trips") or [],
        "timeline": timeline,
    }
