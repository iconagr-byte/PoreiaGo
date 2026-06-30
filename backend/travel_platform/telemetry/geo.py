"""Geospatial helpers — haversine distance (no PostGIS required for geofence checks)."""

from __future__ import annotations

import math

EARTH_RADIUS_M = 6_371_000


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def inside_geofence(
    lat: float,
    lng: float,
    center_lat: float,
    center_lng: float,
    radius_m: float = 50,
) -> bool:
    return haversine_m(lat, lng, center_lat, center_lng) <= radius_m


def point_to_segment_distance_m(
    lat: float,
    lng: float,
    a_lat: float,
    a_lng: float,
    b_lat: float,
    b_lng: float,
) -> float:
    """Shortest distance from point P to segment AB (planar approx + haversine)."""
    ax, ay = a_lng, a_lat
    bx, by = b_lng, b_lat
    px, py = lng, lat
    abx, aby = bx - ax, by - ay
    apx, apy = px - ax, py - ay
    ab2 = abx * abx + aby * aby
    if ab2 < 1e-12:
        return haversine_m(lat, lng, a_lat, a_lng)
    t = max(0.0, min(1.0, (apx * abx + apy * aby) / ab2))
    proj_lng = ax + t * abx
    proj_lat = ay + t * aby
    return haversine_m(lat, lng, proj_lat, proj_lng)


def point_to_polyline_distance_m(
    lat: float,
    lng: float,
    points: list[tuple[float, float]],
) -> float:
    """Min distance from point to polyline (list of lat, lng)."""
    if len(points) < 2:
        if points:
            return haversine_m(lat, lng, points[0][0], points[0][1])
        return 0.0
    best = float("inf")
    for i in range(len(points) - 1):
        a_lat, a_lng = points[i]
        b_lat, b_lng = points[i + 1]
        d = point_to_segment_distance_m(lat, lng, a_lat, a_lng, b_lat, b_lng)
        best = min(best, d)
    return best
