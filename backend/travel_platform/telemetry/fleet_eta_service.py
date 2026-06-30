"""Fleet ETA — όλοι οι ενεργοί οδηγοί / δρομολόγια."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from travel_platform.telemetry.eta_intelligence import get_eta_service
from travel_platform.telemetry.eta_resolve import resolve_eta_snapshot
from travel_platform.telemetry.eta_serializers import format_eta_display, snapshot_to_payload
from travel_platform.telemetry.processor import get_live_fleet
from travel_platform.telemetry.settings_store import get_telemetry_settings


async def fetch_fleet_etas(tenant_id: UUID) -> dict[str, Any]:
    """Επιστρέφει ETA ανά ενεργό δρομολόγιο στον στόλο."""
    live = get_live_fleet()
    settings = get_telemetry_settings(str(tenant_id))
    vehicles = live.list_active(tenant_id)
    seen_trips: set[int] = set()
    items: list[dict[str, Any]] = []

    for vehicle in vehicles:
        trip_id = vehicle.trip_id
        if not trip_id or trip_id in seen_trips:
            continue
        seen_trips.add(int(trip_id))

        snap = await resolve_eta_snapshot(int(trip_id), tenant_id)
        if not snap:
            continue

        meta = live.vehicle_meta(tenant_id, vehicle.vehicle_id)
        payload = snapshot_to_payload(
            snap,
            sync_interval_sec=settings.eta_ws_push_seconds,
        )
        items.append(
            {
                **payload,
                "vehicle_id": vehicle.vehicle_id,
                "vehicle_code": vehicle.vehicle_code,
                "bus_plate": meta.get("bus_plate") or vehicle.vehicle_code,
                "driver_name": meta.get("driver_name") or "—",
                "driver_id": meta.get("driver_id"),
                "speed_kmh": round(float(vehicle.speed_kmh or 0), 1),
                "eta_display": format_eta_display(snap.eta_seconds),
            },
        )

    items.sort(key=lambda row: row.get("eta_seconds") or 0)

    return {
        "tenant_id": str(tenant_id),
        "item_count": len(items),
        "refresh_seconds": settings.eta_refresh_seconds,
        "push_seconds": settings.eta_ws_push_seconds,
        "google_maps_configured": settings.google_maps_configured,
        "items": items,
    }
