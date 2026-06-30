"""Μετρικές & σύγκριση ιστορικών διαδρομών."""

from __future__ import annotations

import math
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from travel_platform.telemetry.trip_route_service import fetch_trip_route

EARTH_RADIUS_M = 6_371_000


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(min(1.0, a)))


def path_length_km(points: list[dict[str, Any]]) -> float:
    if len(points) < 2:
        return 0.0
    total_m = 0.0
    for i in range(1, len(points)):
        total_m += haversine_m(
            points[i - 1]["lat"],
            points[i - 1]["lng"],
            points[i]["lat"],
            points[i]["lng"],
        )
    return total_m / 1000.0


def route_duration_minutes(points: list[dict[str, Any]]) -> float | None:
    if len(points) < 2:
        return None
    try:
        t0 = datetime.fromisoformat(points[0]["recorded_at"].replace("Z", "+00:00"))
        t1 = datetime.fromisoformat(points[-1]["recorded_at"].replace("Z", "+00:00"))
        return max(0.0, (t1 - t0).total_seconds() / 60.0)
    except (ValueError, TypeError):
        return None


def average_speed_kmh(points: list[dict[str, Any]]) -> float:
    speeds = [float(p.get("speed_kmh") or 0) for p in points if p.get("speed_kmh") is not None]
    if not speeds:
        return 0.0
    return sum(speeds) / len(speeds)


def cross_track_deviation_m(
    source: list[dict[str, Any]],
    target: list[dict[str, Any]],
    *,
    sample_every: int = 5,
) -> dict[str, float]:
    """Μέση & μέγιστη απόσταση σημείων source από την target polyline (nearest point)."""
    if not source or not target:
        return {"mean_m": 0.0, "max_m": 0.0}

    sample = source[:: max(1, sample_every)]
    deviations: list[float] = []
    for pt in sample:
        nearest = min(
            haversine_m(pt["lat"], pt["lng"], other["lat"], other["lng"]) for other in target
        )
        deviations.append(nearest)

    return {
        "mean_m": sum(deviations) / len(deviations),
        "max_m": max(deviations),
    }


def summarize_route(points: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "point_count": len(points),
        "path_length_km": round(path_length_km(points), 2),
        "duration_min": round(route_duration_minutes(points) or 0, 1),
        "avg_speed_kmh": round(average_speed_kmh(points), 1),
        "from_time": points[0]["recorded_at"] if points else None,
        "to_time": points[-1]["recorded_at"] if points else None,
    }


def compare_routes(route_a: dict[str, Any], route_b: dict[str, Any]) -> dict[str, Any]:
    pts_a = route_a.get("points") or []
    pts_b = route_b.get("points") or []
    dev_a_to_b = cross_track_deviation_m(pts_a, pts_b)
    dev_b_to_a = cross_track_deviation_m(pts_b, pts_a)
    summary_a = summarize_route(pts_a)
    summary_b = summarize_route(pts_b)

    length_delta = summary_a["path_length_km"] - summary_b["path_length_km"]
    duration_delta = summary_a["duration_min"] - summary_b["duration_min"]
    speed_delta = summary_a["avg_speed_kmh"] - summary_b["avg_speed_kmh"]

    return {
        "trip_a": route_a.get("trip_id"),
        "trip_b": route_b.get("trip_id"),
        "tenant_id": route_a.get("tenant_id") or route_b.get("tenant_id"),
        "route_a": {**route_a, "summary": summary_a},
        "route_b": {**route_b, "summary": summary_b},
        "metrics": {
            "a_to_b_mean_deviation_m": round(dev_a_to_b["mean_m"], 1),
            "a_to_b_max_deviation_m": round(dev_a_to_b["max_m"], 1),
            "b_to_a_mean_deviation_m": round(dev_b_to_a["mean_m"], 1),
            "b_to_a_max_deviation_m": round(dev_b_to_a["max_m"], 1),
            "symmetric_mean_deviation_m": round((dev_a_to_b["mean_m"] + dev_b_to_a["mean_m"]) / 2, 1),
            "path_length_delta_km": round(length_delta, 2),
            "duration_delta_min": round(duration_delta, 1),
            "avg_speed_delta_kmh": round(speed_delta, 1),
        },
    }


async def fetch_and_compare_trips(
    session: AsyncSession,
    *,
    tenant_id: UUID,
    trip_a: int,
    trip_b: int,
    limit: int = 5000,
) -> dict[str, Any]:
    route_a = await fetch_trip_route(session, tenant_id=tenant_id, trip_id=trip_a, limit=limit)
    route_b = await fetch_trip_route(session, tenant_id=tenant_id, trip_id=trip_b, limit=limit)

    if route_a.get("error") or route_b.get("error"):
        return {
            "trip_a": trip_a,
            "trip_b": trip_b,
            "error": "database_unavailable",
            "metrics": None,
            "route_a": route_a,
            "route_b": route_b,
        }

    if not route_a.get("points") or not route_b.get("points"):
        return {
            "trip_a": trip_a,
            "trip_b": trip_b,
            "error": "missing_points",
            "metrics": None,
            "route_a": route_a,
            "route_b": route_b,
        }

    return compare_routes(route_a, route_b)
