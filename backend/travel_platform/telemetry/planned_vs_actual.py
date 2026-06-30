"""Προγραμματισμένη vs πραγματική διαδρομή — corridor / stops."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from travel_platform.telemetry.corridor_geofence import CorridorGeofenceService
from travel_platform.telemetry.geo import point_to_polyline_distance_m
from travel_platform.telemetry.trip_route_compare import summarize_route
from travel_platform.telemetry.trip_route_service import fetch_trip_route

logger = logging.getLogger(__name__)


def stops_to_planned_points(stops: list[dict[str, Any]] | None) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for stop in stops or []:
        try:
            lat = float(stop.get("lat") or stop.get("latitude"))
            lng = float(stop.get("lng") or stop.get("longitude"))
        except (TypeError, ValueError):
            continue
        points.append((lat, lng))
    return points


def get_planned_corridor_points(
    tenant_id: UUID,
    trip_id: int,
    *,
    planned_stops: list[dict[str, Any]] | None = None,
) -> tuple[list[dict[str, float]], str, int]:
    """Επιστρέφει (points, source, buffer_m)."""
    from travel_platform.telemetry.settings_store import get_telemetry_settings

    buffer_m = int(get_telemetry_settings(str(tenant_id)).corridor_buffer_m)

    if planned_stops:
        tuples = stops_to_planned_points(planned_stops)
        if len(tuples) >= 2:
            return (
                [{"lat": lat, "lng": lng} for lat, lng in tuples],
                "trip_stops",
                buffer_m,
            )

    zone = CorridorGeofenceService.default_corridor(tenant_id, trip_id)
    if zone and len(zone.points) >= 2:
        return (
            [{"lat": lat, "lng": lng} for lat, lng in zone.points],
            "corridor_geofence",
            zone.buffer_m,
        )

    return [], "none", buffer_m


def compliance_metrics(
    actual_points: list[dict[str, Any]],
    planned_tuples: list[tuple[float, float]],
    *,
    buffer_m: int,
) -> dict[str, Any]:
    if not actual_points or len(planned_tuples) < 2:
        return {
            "on_corridor_pct": 0.0,
            "mean_deviation_m": 0.0,
            "max_deviation_m": 0.0,
            "off_corridor_points": 0,
            "buffer_m": buffer_m,
        }

    on_corridor = 0
    deviations: list[float] = []
    for pt in actual_points:
        dist = point_to_polyline_distance_m(
            float(pt["lat"]),
            float(pt["lng"]),
            planned_tuples,
        )
        deviations.append(dist)
        if dist <= buffer_m:
            on_corridor += 1

    off = len(actual_points) - on_corridor
    return {
        "on_corridor_pct": round(100.0 * on_corridor / len(actual_points), 1),
        "mean_deviation_m": round(sum(deviations) / len(deviations), 1),
        "max_deviation_m": round(max(deviations), 1),
        "off_corridor_points": off,
        "buffer_m": buffer_m,
    }


async def fetch_planned_vs_actual(
    session: AsyncSession,
    *,
    tenant_id: UUID,
    trip_id: int,
    planned_stops: list[dict[str, Any]] | None = None,
    buffer_m: int | None = None,
    limit: int = 5000,
) -> dict[str, Any]:
    planned_pts, planned_source, default_buffer = get_planned_corridor_points(
        tenant_id,
        trip_id,
        planned_stops=planned_stops,
    )
    effective_buffer = int(buffer_m) if buffer_m is not None else default_buffer

    actual_route = await fetch_trip_route(
        session,
        tenant_id=tenant_id,
        trip_id=trip_id,
        limit=limit,
    )
    actual_points = actual_route.get("points") or []

    planned_tuples = [(p["lat"], p["lng"]) for p in planned_pts]
    metrics = compliance_metrics(actual_points, planned_tuples, buffer_m=effective_buffer)
    metrics["compliance_score"] = metrics["on_corridor_pct"]
    metrics["planned_source"] = planned_source

    return {
        "trip_id": trip_id,
        "tenant_id": str(tenant_id),
        "planned": {
            "points": planned_pts,
            "source": planned_source,
            "buffer_m": effective_buffer,
            "point_count": len(planned_pts),
        },
        "actual": {
            **actual_route,
            "summary": summarize_route(actual_points),
        },
        "metrics": metrics,
        "error": None
        if planned_pts and actual_points
        else ("missing_planned" if not planned_pts else "missing_actual"),
    }
