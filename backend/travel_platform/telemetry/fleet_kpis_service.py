"""Fleet KPIs — aggregates από trip_coordinates, live fleet & alerts."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from travel_platform.telemetry.alerts import TelemetryAlertBus
from travel_platform.telemetry.processor import get_live_fleet

logger = logging.getLogger(__name__)

DEFAULT_DAYS = 30
SLOW_SPEED_KMH = 8.0


def _parse_ts(value: str | datetime | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        ts = value
    else:
        try:
            ts = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return None
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts


def count_alerts_since(
    tenant_id: str,
    *,
    from_time: datetime,
    to_time: datetime | None = None,
    limit: int = 300,
) -> dict[str, Any]:
    """Μετράει alerts από in-memory bus (τελευταία N)."""
    by_type: dict[str, int] = defaultdict(int)
    total = 0
    for row in TelemetryAlertBus.list_recent(tenant_id, limit=limit):
        created = _parse_ts(row.get("created_at"))
        if created is None:
            continue
        if created < from_time:
            continue
        if to_time and created > to_time:
            continue
        alert_type = str(row.get("alert_type") or "UNKNOWN")
        by_type[alert_type] += 1
        total += 1
    return {"total": total, "by_type": dict(by_type)}


def _empty_payload(
    tenant_id: UUID,
    *,
    from_time: datetime,
    to_time: datetime | None,
    days: int,
    error: str | None = None,
) -> dict[str, Any]:
    live = get_live_fleet()
    active = len(live.list_active(tenant_id))
    alerts = count_alerts_since(str(tenant_id), from_time=from_time, to_time=to_time)
    return {
        "tenant_id": str(tenant_id),
        "from_time": from_time.isoformat(),
        "to_time": to_time.isoformat() if to_time else None,
        "days": days,
        "summary": {
            "active_drivers_now": active,
            "gps_points": 0,
            "trips_tracked": 0,
            "drivers_with_gps": 0,
            "total_distance_km": 0.0,
            "avg_speed_kmh": 0.0,
            "slow_motion_pct": 0.0,
            "alerts_total": alerts["total"],
            "alerts_route_deviation": alerts["by_type"].get("ROUTE_DEVIATION", 0),
            "alerts_driver_online": alerts["by_type"].get("DRIVER_ONLINE", 0),
            "alerts_driver_offline": alerts["by_type"].get("DRIVER_OFFLINE", 0),
        },
        "daily": [],
        "top_trips": [],
        "alerts_by_type": alerts["by_type"],
        "error": error,
    }


async def fetch_fleet_kpis(
    session: AsyncSession,
    *,
    tenant_id: UUID,
    from_time: datetime | None = None,
    to_time: datetime | None = None,
    days: int = DEFAULT_DAYS,
) -> dict[str, Any]:
    effective_days = max(0, min(int(days), 365))
    effective_from = from_time
    if effective_from is None and effective_days > 0:
        effective_from = datetime.now(timezone.utc) - timedelta(days=effective_days)
    if effective_from is None:
        effective_from = datetime.now(timezone.utc) - timedelta(days=DEFAULT_DAYS)

    params: dict[str, Any] = {
        "tenant_id": str(tenant_id),
        "from_time": effective_from,
        "to_time": to_time,
        "slow_speed": SLOW_SPEED_KMH,
    }

    summary_sql = """
        SELECT
            COUNT(*)::int AS gps_points,
            COUNT(DISTINCT trip_id) FILTER (WHERE trip_id IS NOT NULL)::int AS trips_tracked,
            COUNT(DISTINCT driver_id) FILTER (WHERE driver_id IS NOT NULL)::int AS drivers_with_gps,
            COALESCE(ROUND(AVG(speed_kmh)::numeric, 1), 0) AS avg_speed_kmh,
            COALESCE(
                ROUND(
                    100.0 * SUM(CASE WHEN speed_kmh < :slow_speed THEN 1 ELSE 0 END)
                    / NULLIF(COUNT(*), 0),
                    1
                ),
                0
            ) AS slow_motion_pct
        FROM trip_coordinates
        WHERE tenant_id = CAST(:tenant_id AS uuid)
          AND recorded_at >= :from_time
          AND (:to_time IS NULL OR recorded_at <= :to_time)
    """

    distance_sql = """
        SELECT COALESCE(SUM(trip_km), 0) AS total_km
        FROM (
            SELECT
                ST_Length(
                    ST_MakeLine(geom::geometry ORDER BY recorded_at)::geography
                ) / 1000.0 AS trip_km
            FROM trip_coordinates
            WHERE tenant_id = CAST(:tenant_id AS uuid)
              AND trip_id IS NOT NULL
              AND recorded_at >= :from_time
              AND (:to_time IS NULL OR recorded_at <= :to_time)
            GROUP BY trip_id
        ) distances
    """

    daily_sql = """
        SELECT
            (date_trunc('day', recorded_at AT TIME ZONE 'UTC'))::date AS day,
            COUNT(*)::int AS gps_points,
            COUNT(DISTINCT driver_id) FILTER (WHERE driver_id IS NOT NULL)::int AS drivers,
            COUNT(DISTINCT trip_id) FILTER (WHERE trip_id IS NOT NULL)::int AS trips
        FROM trip_coordinates
        WHERE tenant_id = CAST(:tenant_id AS uuid)
          AND recorded_at >= :from_time
          AND (:to_time IS NULL OR recorded_at <= :to_time)
        GROUP BY 1
        ORDER BY 1
    """

    top_trips_sql = """
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
          AND trip_id IS NOT NULL
          AND recorded_at >= :from_time
          AND (:to_time IS NULL OR recorded_at <= :to_time)
        GROUP BY trip_id
        ORDER BY distance_km DESC NULLS LAST
        LIMIT 10
    """

    try:
        summary_row = (await session.execute(text(summary_sql), params)).mappings().one()
        distance_row = (await session.execute(text(distance_sql), params)).mappings().one()
        daily_rows = (await session.execute(text(daily_sql), params)).mappings().all()
        top_rows = (await session.execute(text(top_trips_sql), params)).mappings().all()
    except Exception as exc:
        logger.warning("fleet KPIs query failed: %s", exc)
        return _empty_payload(
            tenant_id,
            from_time=effective_from,
            to_time=to_time,
            days=effective_days,
            error="database_unavailable",
        )

    live = get_live_fleet()
    active = len(live.list_active(tenant_id))
    alerts = count_alerts_since(str(tenant_id), from_time=effective_from, to_time=to_time)

    def _iso(value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value)

    daily = [
        {
            "day": str(row["day"]),
            "gps_points": int(row["gps_points"]),
            "drivers": int(row["drivers"]),
            "trips": int(row["trips"]),
        }
        for row in daily_rows
    ]
    top_trips = [
        {
            "trip_id": int(row["trip_id"]),
            "distance_km": float(row["distance_km"] or 0),
            "point_count": int(row["point_count"]),
            "first_at": _iso(row.get("first_at")),
            "last_at": _iso(row.get("last_at")),
        }
        for row in top_rows
    ]

    return {
        "tenant_id": str(tenant_id),
        "from_time": effective_from.isoformat(),
        "to_time": to_time.isoformat() if to_time else None,
        "days": effective_days,
        "summary": {
            "active_drivers_now": active,
            "gps_points": int(summary_row["gps_points"]),
            "trips_tracked": int(summary_row["trips_tracked"]),
            "drivers_with_gps": int(summary_row["drivers_with_gps"]),
            "total_distance_km": round(float(distance_row["total_km"] or 0), 2),
            "avg_speed_kmh": float(summary_row["avg_speed_kmh"] or 0),
            "slow_motion_pct": float(summary_row["slow_motion_pct"] or 0),
            "alerts_total": alerts["total"],
            "alerts_route_deviation": alerts["by_type"].get("ROUTE_DEVIATION", 0),
            "alerts_driver_online": alerts["by_type"].get("DRIVER_ONLINE", 0),
            "alerts_driver_offline": alerts["by_type"].get("DRIVER_OFFLINE", 0),
        },
        "daily": daily,
        "top_trips": top_trips,
        "alerts_by_type": alerts["by_type"],
        "error": None,
    }
