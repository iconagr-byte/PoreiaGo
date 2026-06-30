"""Public passenger live bus position + ETA."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from travel_platform.telemetry.eta_resolve import resolve_eta_snapshot
from travel_platform.telemetry.eta_serializers import format_eta_display
from travel_platform.telemetry.processor import get_live_fleet


async def fetch_passenger_track(*, trip_id: int, tenant_id: UUID) -> dict[str, Any] | None:
    live = get_live_fleet()
    vehicle_state = None
    vehicle_meta: dict[str, Any] = {}

    for vehicle in live.list_active(tenant_id):
        if vehicle.trip_id != trip_id:
            continue
        vehicle_state = vehicle
        vehicle_meta = live._vehicles.get(vehicle.vehicle_id, {})
        break

    snap = await resolve_eta_snapshot(trip_id, tenant_id)
    if vehicle_state is None and snap is None:
        return None

    lat = vehicle_state.lat if vehicle_state else (snap.vehicle_lat if snap else None)
    lng = vehicle_state.lng if vehicle_state else (snap.vehicle_lng if snap else None)

    return {
        "trip_id": trip_id,
        "tenant_id": str(tenant_id),
        "online": vehicle_state is not None,
        "vehicle_id": vehicle_state.vehicle_id if vehicle_state else None,
        "vehicle_code": vehicle_state.vehicle_code if vehicle_state else None,
        "bus_plate": vehicle_meta.get("bus_plate") or (vehicle_state.vehicle_code if vehicle_state else None),
        "driver_name": vehicle_meta.get("driver_name"),
        "vehicle_lat": lat,
        "vehicle_lng": lng,
        "speed_kmh": vehicle_state.speed_kmh if vehicle_state else None,
        "heading_deg": vehicle_meta.get("heading_deg"),
        "updated_at": vehicle_state.updated_at.isoformat() if vehicle_state else None,
        "next_stop_name": snap.next_stop_name if snap else "—",
        "eta_seconds": snap.eta_seconds if snap else 0,
        "eta_display": format_eta_display(snap.eta_seconds) if snap else "—",
        "distance_m": snap.distance_m if snap else 0,
        "traffic_level": snap.traffic_level if snap else "unknown",
        "traffic_label": snap.traffic_label if snap else "—",
        "computed_at": snap.computed_at if snap else None,
        "server_sync_interval_sec": 30,
    }
