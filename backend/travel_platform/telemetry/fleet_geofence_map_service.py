"""Corridor & stop geofence layers για admin χάρτη."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from travel_platform.telemetry.corridor_geofence import CorridorGeofenceService
from travel_platform.telemetry.geofence import GeofenceService
from travel_platform.telemetry.processor import get_live_fleet
from travel_platform.telemetry.settings_store import get_telemetry_settings


def _corridor_layer(tenant_id: UUID, trip_id: int) -> dict[str, Any] | None:
    zone = CorridorGeofenceService.default_corridor(tenant_id, trip_id)
    if not zone or len(zone.points) < 2:
        return None
    return {
        "trip_id": trip_id,
        "name": zone.name,
        "buffer_m": zone.buffer_m,
        "points": [{"lat": lat, "lng": lng} for lat, lng in zone.points],
    }


def _stop_layers(tenant_id: UUID, trip_id: int) -> list[dict[str, Any]]:
    settings = get_telemetry_settings(str(tenant_id))
    default_radius = settings.geofence_radius_m
    rows: list[dict[str, Any]] = []
    for stop in GeofenceService.default_stops_for_trip(tenant_id, trip_id):
        rows.append(
            {
                "trip_id": trip_id,
                "stop_id": stop.id,
                "name": stop.name,
                "lat": stop.lat,
                "lng": stop.lng,
                "radius_m": stop.radius_m or default_radius,
            },
        )
    return rows


def fetch_geofence_map_layers(
    tenant_id: UUID,
    *,
    trip_ids: list[int] | None = None,
) -> dict[str, Any]:
    """Επιστρέφει corridor polylines + stop geofence circles για ενεργά δρομολόγια."""
    if trip_ids is None:
        live = get_live_fleet()
        trip_ids = sorted(
            {
                int(v.trip_id)
                for v in live.list_active(tenant_id)
                if v.trip_id is not None
            },
        )

    corridors: list[dict[str, Any]] = []
    stops: list[dict[str, Any]] = []
    for trip_id in trip_ids:
        corridor = _corridor_layer(tenant_id, trip_id)
        if corridor:
            corridors.append(corridor)
        stops.extend(_stop_layers(tenant_id, trip_id))

    settings = get_telemetry_settings(str(tenant_id))
    return {
        "tenant_id": str(tenant_id),
        "trip_ids": trip_ids,
        "corridors": corridors,
        "stops": stops,
        "geofence_radius_m": settings.geofence_radius_m,
        "corridor_buffer_m": settings.corridor_buffer_m,
    }
