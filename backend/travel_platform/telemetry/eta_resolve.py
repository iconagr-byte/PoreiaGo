"""Resolve ETA snapshot for REST / WebSocket."""

from __future__ import annotations

from uuid import UUID

from travel_platform.telemetry.eta_intelligence import TripEtaSnapshot, get_eta_service
from travel_platform.telemetry.processor import get_live_fleet

DEMO_TENANT = UUID("00000000-0000-0000-0000-000000000001")


async def resolve_eta_snapshot(trip_id: int, tenant_id: UUID) -> TripEtaSnapshot | None:
    eta_svc = get_eta_service()
    snap = eta_svc.get_cached(tenant_id, trip_id)
    if snap:
        return snap
    live = get_live_fleet()
    vehicle = next((v for v in live.list_active(tenant_id) if v.trip_id == trip_id), None)
    if vehicle:
        snap = await eta_svc.compute_eta(
            tenant_id=tenant_id,
            trip_id=trip_id,
            origin_lat=vehicle.lat,
            origin_lng=vehicle.lng,
        )
        if snap:
            eta_svc._cache[(str(tenant_id), trip_id)] = snap
            return snap
    return await eta_svc.compute_eta(
        tenant_id=tenant_id,
        trip_id=trip_id,
        origin_lat=38.85,
        origin_lng=22.5,
    )
