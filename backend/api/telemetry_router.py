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
    env = os.getenv("ENVIRONMENT", "development").lower()
    raw = (os.getenv("TELEMETRY_DEVICE_KEYS") or "").strip()
    if not raw:
        if env in ("production", "prod"):
            raise HTTPException(status_code=401, detail="Telemetry device keys not configured")
        allowed = ["dev-gps-key"]
    else:
        allowed = [k.strip() for k in raw.split(",") if k.strip()]
    if env in ("production", "prod") and any(
        k.lower() in {"dev-gps-key", "change-me"} for k in allowed
    ):
        # Never accept known weak keys even if misconfigured in prod env.
        allowed = [k for k in allowed if k.lower() not in {"dev-gps-key", "change-me"}]
        if not allowed:
            raise HTTPException(status_code=401, detail="Telemetry device keys not configured")
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
    """Latest GPS pins for the admin map.

    Per-row failures are skipped. A total list failure returns 503 (not empty [])
    so the admin client keeps the last-known pin instead of wiping the map.
    """
    import logging

    from travel_platform.telemetry.live_fleet_media import enrich_live_vehicle_media
    from travel_platform.telemetry.live_fleet_trail_redis import (
        load_trails_for_tenant,
        trail_points_for_api,
    )
    from travel_platform.telemetry.trip_title_resolve import resolve_trip_title

    log = logging.getLogger(__name__)
    try:
        # If Teltonika has a recent fix in the device store but the live fleet
        # is empty (restart / stream lag), re-paint pins before listing.
        from travel_platform.telemetry.teltonika.hydrate_live import (
            hydrate_tenant_live_from_devices,
        )

        await hydrate_tenant_live_from_devices(str(tenant_id))
    except Exception:
        log.debug("teltonika live hydrate skipped", exc_info=True)
    try:
        live: LiveFleetService = get_live_fleet()
        vehicles = await live.list_active_for_admin_async(tenant_id)
    except Exception as exc:
        log.exception("fleet_live list_active failed tenant=%s", tenant_id)
        raise HTTPException(status_code=503, detail="Live fleet temporarily unavailable") from exc

    # Empty map but online IMEI in device store — force paint once (Achillio).
    if not vehicles:
        try:
            from travel_platform.telemetry.teltonika.hydrate_live import (
                hydrate_tenant_live_from_devices,
            )

            n = await hydrate_tenant_live_from_devices(str(tenant_id), force=True)
            if n:
                vehicles = await live.list_active_for_admin_async(tenant_id)
                log.info(
                    "fleet_live empty-map recovery wrote=%s tenant=%s now=%s",
                    n,
                    tenant_id,
                    len(vehicles),
                )
        except Exception:
            log.debug("fleet_live empty-map recovery skipped", exc_info=True)

    rows = []
    trails_by_vehicle: dict = {}
    try:
        vids = [str(v.vehicle_id) for v in vehicles if getattr(v, "vehicle_id", None)]
        trails_by_vehicle = await load_trails_for_tenant(str(tenant_id), vids)
    except Exception:
        log.debug("fleet_live trail load skipped", exc_info=True)

    from travel_platform.telemetry.office_fleet_filter import office_allows_live_driver

    for v in vehicles:
        try:
            meta = await live.vehicle_meta_async(tenant_id, v.vehicle_id)
            if not meta:
                meta = live._vehicles.get(v.vehicle_id, {})
            if not office_allows_live_driver(str(tenant_id), meta.get("driver_id"), meta):
                continue
            # Teltonika pin clears driver_id; soft-ack keeps app_driver_id for chat/photo.
            app_driver_id = str(meta.get("app_driver_id") or "").strip() or None
            chat_driver_id = str(meta.get("driver_id") or app_driver_id or "").strip() or None
            media = enrich_live_vehicle_media(
                driver_id=chat_driver_id,
                bus_plate=meta.get("bus_plate", v.vehicle_code),
                vehicle_code=v.vehicle_code,
            )
            from travel_platform.telemetry.active_excursion_resolve import (
                enrich_meta_with_active_excursion,
            )

            trip_id, trip_title_hint, meta = enrich_meta_with_active_excursion(
                str(tenant_id),
                meta,
                vehicle_code=v.vehicle_code,
                trip_id=v.trip_id,
            )
            try:
                live._vehicles[str(v.vehicle_id)] = {
                    **live._vehicles.get(str(v.vehicle_id), {}),
                    **meta,
                }
            except Exception:
                pass
            trip_title = await resolve_trip_title(trip_id, preferred=trip_title_hint or meta.get("trip_title"))
            # Empty Redis trail → empty list. Do not fabricate a 1-point stub:
            # the client accumulates from the live pin and a stub would replace
            # that growing path on every poll.
            raw_trail = trails_by_vehicle.get(str(v.vehicle_id)) or []
            from travel_platform.telemetry.tracker_priority import (
                resolve_live_gps_sources,
                resolve_tracker_alive_seconds,
            )

            alive_sec = resolve_tracker_alive_seconds(str(tenant_id))
            gps_sources = resolve_live_gps_sources(
                meta,
                max_age_sec=alive_sec,
                tenant_id=str(tenant_id),
            )
            tracker_signal_at = str(meta.get("tracker_signal_at") or "") or None
            # App-sourced pin + online IMEI: expose device last_seen so the
            # client dual badge treats Teltonika as open.
            if "teltonika" in gps_sources and not tracker_signal_at:
                try:
                    from travel_platform.telemetry.teltonika.device_store import (
                        get_enabled_device_by_vehicle_code,
                    )
                    from travel_platform.telemetry.tracker_priority import (
                        is_tracker_binding_alive,
                    )

                    device = get_enabled_device_by_vehicle_code(
                        str(tenant_id),
                        meta.get("vehicle_code") or meta.get("bus_plate") or v.vehicle_code,
                    )
                    if is_tracker_binding_alive(device, max_age_sec=alive_sec):
                        tracker_signal_at = str(device.get("last_seen_at") or "") or None
                        if not meta.get("imei") and device.get("imei"):
                            meta["imei"] = device.get("imei")
                except Exception:
                    pass
            rows.append(
                LiveVehicleResponse(
                    vehicle_id=v.vehicle_id,
                    vehicle_code=v.vehicle_code,
                    trip_id=trip_id,
                    lat=v.lat,
                    lng=v.lng,
                    speed_kmh=v.speed_kmh,
                    engine_on=v.engine_on,
                    fuel_level_pct=v.fuel_level_pct,
                    idle_seconds_trip=v.idle_seconds_trip,
                    updated_at=v.updated_at,
                    driver_name=meta.get("driver_name"),
                    bus_plate=media.get("bus_plate") or meta.get("bus_plate", v.vehicle_code),
                    heading_deg=meta.get("heading_deg"),
                    driver_id=chat_driver_id,
                    app_driver_id=app_driver_id,
                    photo_url=media.get("photo_url"),
                    vehicle_image_url=media.get("vehicle_image_url"),
                    trip_title=trip_title or None,
                    tracking_started_at=meta.get("tracking_started_at"),
                    trail=trail_points_for_api(raw_trail),
                    source=str(meta.get("source") or "") or None,
                    imei=str(meta.get("imei") or "") or None,
                    gps_sources=gps_sources,
                    app_seen_at=str(meta.get("app_seen_at") or "") or None,
                    tracker_signal_at=tracker_signal_at,
                    hydrated_from_store=bool(meta.get("hydrated_from_store")),
                ),
            )
        except Exception:
            log.exception("fleet_live row enrich failed vehicle=%s", getattr(v, "vehicle_id", None))
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
