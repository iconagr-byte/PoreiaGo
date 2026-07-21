"""
Telemetry API — GPS ingestion + admin live fleet + driver trip stats.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_tenant_db, get_tenant_id
from travel_platform.telemetry.ingestion import TelemetryIngestionService
from travel_platform.telemetry.live_fleet import LiveFleetService
from travel_platform.telemetry.processor import get_idling, get_live_fleet, process_telemetry_payload
from travel_platform.telemetry.alerts import TelemetryAlertBus
from travel_platform.telemetry.driving_behavior import DrivingBehaviorService
from travel_platform.telemetry.eta_intelligence import get_eta_service
from travel_platform.telemetry.settings_store import get_telemetry_settings, update_telemetry_settings
from schemas.telemetry import (
    DriverSafetyResponse,
    DriverTripTelemetryResponse,
    HeatmapPoint,
    LiveVehicleResponse,
    PassengerEtaResponse,
    TelemetryAcceptedResponse,
    TelemetryAlertResponse,
    TelemetrySettingsResponse,
    TelemetrySettingsUpdate,
    TelemetryUpdateRequest,
)

router = APIRouter(tags=["telemetry"])
ingest_router = APIRouter(prefix="/telemetry", tags=["telemetry-ingest"])


def verify_device_key(x_device_key: str | None = Header(default=None, alias="X-Device-Key")) -> str:
    allowed = os.getenv("TELEMETRY_DEVICE_KEYS", "dev-gps-key").split(",")
    if not x_device_key or x_device_key.strip() not in allowed:
        raise HTTPException(status_code=401, detail="Invalid device key")
    return x_device_key.strip()


@ingest_router.post("/update", response_model=TelemetryAcceptedResponse, status_code=202)
async def telemetry_update(
    body: TelemetryUpdateRequest,
    _: str = Depends(verify_device_key),
):
    """
    Onboard GPS tracker endpoint — enqueue only (Redis Stream / memory queue).
  Thousands of points/min supported via async workers.
    """
    svc = TelemetryIngestionService()
    msg_id = await svc.accept_update(
        tenant_id=body.tenant_id,
        vehicle_code=body.vehicle_code,
        latitude=body.latitude,
        longitude=body.longitude,
        speed_kmh=body.speed_kmh,
        engine_status=body.engine_status,
        fuel_level_pct=body.fuel_level_pct,
        trip_id=body.trip_id,
        driver_id=body.driver_id,
        recorded_at=body.recorded_at.isoformat() if body.recorded_at else None,
        heading_deg=body.heading_deg,
        accel_x=body.accel_x,
        accel_y=body.accel_y,
        accel_z=body.accel_z,
        tracker_event_id=body.tracker_event_id,
    )
    return TelemetryAcceptedResponse(message_id=msg_id)


# Admin routes under /api/v1/telemetry (tenant JWT via platform middleware)
admin_router = APIRouter(prefix="/telemetry", tags=["telemetry-admin"])


@admin_router.get("/fleet/live", response_model=list[LiveVehicleResponse])
async def fleet_live(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    live: LiveFleetService = get_live_fleet()
    rows = []
    for v in live.list_active_for_admin(tenant_id):
        meta = live._vehicles.get(v.vehicle_id, {})
        rows.append(
            LiveVehicleResponse(
                vehicle_id=v.vehicle_id,
                vehicle_code=v.vehicle_code,
                trip_id=v.trip_id,
                lat=v.lat,
                lng=v.lng,
                speed_kmh=v.speed_kmh,
                engine_on=v.engine_on,
                fuel_level_pct=v.fuel_level_pct,
                idle_seconds_trip=v.idle_seconds_trip,
                updated_at=v.updated_at,
                driver_name=meta.get("driver_name"),
                bus_plate=meta.get("bus_plate", v.vehicle_code),
                heading_deg=meta.get("heading_deg"),
                driver_id=meta.get("driver_id"),
            ),
        )
    return rows


@admin_router.get("/settings", response_model=TelemetrySettingsResponse)
async def get_telemetry_settings_api(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    s = get_telemetry_settings(str(tenant_id))
    return TelemetrySettingsResponse(**s.__dict__)


@admin_router.patch("/settings", response_model=TelemetrySettingsResponse)
async def patch_telemetry_settings_api(
    body: TelemetrySettingsUpdate,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    patch = body.model_dump(exclude_unset=True)
    s = update_telemetry_settings(patch, tenant_id=str(tenant_id))
    return TelemetrySettingsResponse(**s.__dict__)


@admin_router.get("/alerts", response_model=list[TelemetryAlertResponse])
async def telemetry_alerts(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    limit: int = Query(50, le=200),
):
    rows = TelemetryAlertBus.list_recent(str(tenant_id), limit=limit)
    return [TelemetryAlertResponse(**r) for r in rows]


@admin_router.get("/drivers/{driver_id}/safety", response_model=DriverSafetyResponse)
async def driver_safety(
    driver_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    _ = tenant_id
    profile = DrivingBehaviorService().get_profile(driver_id)
    return DriverSafetyResponse(
        driver_id=str(driver_id),
        safety_score=profile.safety_score,
        events_last_30d=profile.events_last_30d,
        distance_km_30d=profile.distance_km_30d,
        events_per_100km=profile.events_per_100km,
    )


@admin_router.get("/heatmap", response_model=list[HeatmapPoint])
async def fleet_heatmap(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    cell_size: float = Query(0.01, description="Grid cell in degrees (~1km)"),
):
    """Heatmap — PostGIS trip_coordinates με fallback σε in-memory live grid."""
    from travel_platform.telemetry.trip_heatmap_service import fetch_trip_heatmap

    payload = await fetch_trip_heatmap(
        session,
        tenant_id=tenant_id,
        cell_size=cell_size,
        default_days=7,
    )
    if payload.get("points"):
        return [HeatmapPoint(**p) for p in payload["points"]]
    live = get_live_fleet()
    return [HeatmapPoint(**p) for p in live.heatmap_grid(tenant_id, cell_size)]


@admin_router.post("/simulate")
async def simulate_point(
    body: TelemetryUpdateRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    """Dev/admin: process one point synchronously (no queue)."""
    if body.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="tenant_id mismatch")
    payload = body.model_dump(mode="json")
    payload["tenant_id"] = str(body.tenant_id)
    if body.recorded_at:
        payload["recorded_at"] = body.recorded_at.isoformat()
    result = await process_telemetry_payload(payload)
    return {
        "vehicle_id": str(result.vehicle_id),
        "stop_arrival": result.stop_arrival_triggered,
        "stop_id": result.matched_stop_id,
    }
