"""
Admin telemetry API — JWT + tenant από middleware (BackOffice SaaS login).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_tenant_db, get_tenant_id
from schemas.telemetry import (
    FleetEtasResponse,
    FleetDigestSendResponse,
    FleetHeatmapResponse,
    FleetKpisResponse,
    GeofenceMapLayersResponse,
    GpsRetentionPurgeResponse,
    PassengerTrackLinkResponse,
    PlannedVsActualRequest,
    PlannedVsActualResponse,
    TelemetryAlertResponse,
    TelemetrySettingsResponse,
    TelemetrySettingsUpdate,
    TripRouteCompareResponse,
    TripRouteResponse,
    TeltonikaDeviceResponse,
    TeltonikaDeviceUpsert,
    TeltonikaServerStatusResponse,
    TeltonikaTestPingRequest,
    TeltonikaTestPingResponse,
)
from travel_platform.telemetry.alerts import TelemetryAlertBus
from travel_platform.telemetry.fleet_eta_service import fetch_fleet_etas
from travel_platform.telemetry.fleet_geofence_map_service import fetch_geofence_map_layers
from travel_platform.telemetry.fleet_digest_notifications import send_fleet_digest_notifications
from travel_platform.telemetry.fleet_digest_service import collect_fleet_digest
from travel_platform.telemetry.fleet_kpis_service import fetch_fleet_kpis
from travel_platform.telemetry.gps_retention_service import purge_tenant_gps
from travel_platform.telemetry.passenger_track_token import DEFAULT_TTL_HOURS, create_passenger_track_token
from travel_platform.telemetry.planned_vs_actual import fetch_planned_vs_actual
from travel_platform.telemetry.route_export import export_route_document
from travel_platform.telemetry.settings_store import get_telemetry_settings, update_telemetry_settings
from travel_platform.telemetry.trip_heatmap_service import fetch_trip_heatmap
from travel_platform.telemetry.trip_route_compare import fetch_and_compare_trips
from travel_platform.telemetry.trip_route_service import fetch_trip_route

router = APIRouter(prefix="/api/admin/telemetry", tags=["admin-telemetry"])


@router.get("/settings", response_model=TelemetrySettingsResponse)
async def admin_get_settings(tenant_id: Annotated[UUID, Depends(get_tenant_id)]):
    s = get_telemetry_settings(str(tenant_id))
    return TelemetrySettingsResponse(**s.__dict__)


@router.patch("/settings", response_model=TelemetrySettingsResponse)
async def admin_patch_settings(
    body: TelemetrySettingsUpdate,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    patch = body.model_dump(exclude_unset=True)
    s = update_telemetry_settings(patch, tenant_id=str(tenant_id))
    return TelemetrySettingsResponse(**s.__dict__)


@router.post("/gps-retention/purge", response_model=GpsRetentionPurgeResponse)
async def admin_purge_gps_retention(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
):
    """Manual purge of GPS points older than tenant retention policy."""
    settings = get_telemetry_settings(str(tenant_id))
    deleted = await purge_tenant_gps(
        db,
        tenant_id=str(tenant_id),
        retention_days=settings.gps_retention_days,
    )
    await db.commit()
    try:
        from travel_platform.telemetry.fleet_metrics import record_gps_retention_purge

        record_gps_retention_purge(tenant_id=str(tenant_id), deleted=deleted)
    except Exception:
        pass
    return GpsRetentionPurgeResponse(
        tenant_id=tenant_id,
        deleted=deleted,
        retention_days=settings.gps_retention_days,
    )


@router.post("/fleet-digest/send", response_model=FleetDigestSendResponse)
async def admin_send_fleet_digest(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    days: int = Query(1, ge=1, le=30),
):
    """Χειροκίνητη αποστολή fleet digest (email/SMS) για τον tenant."""
    digest = await collect_fleet_digest(db, tenant_id=tenant_id, lookback_days=days)
    outcome = await send_fleet_digest_notifications(digest)
    return FleetDigestSendResponse(
        tenant_id=tenant_id,
        sent=not outcome.get("skipped"),
        email=outcome.get("email"),
        sms=outcome.get("sms"),
        skipped=bool(outcome.get("skipped")),
        reason=outcome.get("reason"),
    )


@router.post("/trips/{trip_id}/track-link", response_model=PassengerTrackLinkResponse)
async def admin_create_passenger_track_link(
    trip_id: int,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    ttl_hours: int = Query(DEFAULT_TTL_HOURS, ge=1, le=168),
):
    """Δημιουργία signed link για δημόσια παρακολούθηση λεωφορείου."""
    try:
        token = create_passenger_track_token(trip_id=trip_id, tenant_id=tenant_id, ttl_hours=ttl_hours)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    path = f"/track/trip/{trip_id}?tenant_id={tenant_id}&token={token}"
    return PassengerTrackLinkResponse(
        trip_id=trip_id,
        tenant_id=tenant_id,
        token=token,
        path=path,
        expires_hours=ttl_hours,
    )


@router.get("/alerts", response_model=list[TelemetryAlertResponse])
async def admin_list_alerts(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    limit: int = Query(50, le=200),
):
    rows = TelemetryAlertBus.list_recent(str(tenant_id), limit=limit)
    return [TelemetryAlertResponse(**r) for r in rows]


@router.post("/alerts/{alert_id}/clear")
async def admin_clear_alert(
    alert_id: str,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    """Απενεργοποίηση συναγερμού οδηγού (SOS) — φεύγει από τον live χάρτη."""
    aid = str(alert_id or "").strip()
    if not aid:
        raise HTTPException(status_code=400, detail="Λείπει alert_id")
    cleared = TelemetryAlertBus.clear_alert(
        aid,
        tenant_id=str(tenant_id),
        notify=True,
        publish_redis=True,
    )
    if not cleared:
        raise HTTPException(status_code=404, detail="Ο συναγερμός δεν βρέθηκε")
    return {
        "ok": True,
        "id": cleared.get("id"),
        "cleared_at": cleared.get("cleared_at"),
        "message": "Ο συναγερμός απενεργοποιήθηκε",
    }


@router.get("/heatmap", response_model=FleetHeatmapResponse)
async def admin_fleet_heatmap(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    trip_id: int | None = None,
    driver_id: UUID | None = None,
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    days: int = Query(7, ge=0, le=365, description="Default window αν λείπει from"),
    cell_size: float = Query(0.01, ge=0.001, le=0.1),
    min_weight: int = Query(2, ge=1, le=50),
    max_cells: int = Query(500, ge=10, le=2000),
    slow_only: bool = Query(False, description="Μόνο αργές κινήσεις / στάσεις"),
    slow_speed_kmh: float = Query(8.0, ge=0, le=40),
):
    """Heatmap από trip_coordinates — PostGIS grid aggregation."""
    effective_from = from_time
    if effective_from is None and days > 0:
        effective_from = datetime.now(timezone.utc) - timedelta(days=days)
    payload = await fetch_trip_heatmap(
        session,
        tenant_id=tenant_id,
        trip_id=trip_id,
        driver_id=driver_id,
        from_time=effective_from,
        to_time=to_time,
        cell_size=cell_size,
        min_weight=min_weight,
        max_cells=max_cells,
        slow_only=slow_only,
        slow_speed_kmh=slow_speed_kmh,
        default_days=0,
    )
    return FleetHeatmapResponse(**payload)


@router.get("/kpis", response_model=FleetKpisResponse)
async def admin_fleet_kpis(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    days: int = Query(30, ge=0, le=365),
):
    """Fleet KPIs — χιλιόμετρα, ταχύτητα, ενεργοί οδηγοί, alerts."""
    payload = await fetch_fleet_kpis(
        session,
        tenant_id=tenant_id,
        from_time=from_time,
        to_time=to_time,
        days=days,
    )
    return FleetKpisResponse(**payload)


@router.get("/etas", response_model=FleetEtasResponse)
async def admin_fleet_etas(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    """ETA επόμενης στάσης για όλους τους ενεργούς οδηγούς στον ζωντανό χάρτη."""
    payload = await fetch_fleet_etas(tenant_id)
    return FleetEtasResponse(**payload)


@router.get("/geofence-map", response_model=GeofenceMapLayersResponse)
async def admin_geofence_map_layers(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    trip_ids: str | None = Query(
        default=None,
        description="Comma-separated trip ids; default = ενεργά από live fleet",
    ),
):
    """Corridor + stop geofence layers για overlay στον ζωντανό χάρτη."""
    parsed: list[int] | None = None
    if trip_ids:
        parsed = []
        for part in trip_ids.split(","):
            part = part.strip()
            if not part:
                continue
            try:
                parsed.append(int(part))
            except ValueError:
                continue
    payload = fetch_geofence_map_layers(tenant_id, trip_ids=parsed)
    return GeofenceMapLayersResponse(**payload)


@router.get("/trips/{trip_id}/route", response_model=TripRouteResponse)
async def admin_trip_route_playback(
    trip_id: int,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    driver_id: str | None = Query(default=None),
    limit: int = Query(5000, ge=1, le=10000),
):
    """Ιστορική διαδρομή δρομολογίου από live GPS οδηγού (buffer + PostGIS)."""
    payload = await fetch_trip_route(
        session,
        tenant_id=tenant_id,
        trip_id=trip_id,
        from_time=from_time,
        to_time=to_time,
        driver_id=driver_id.strip() if driver_id else None,
        limit=limit,
    )
    return TripRouteResponse(**payload)


@router.get("/vehicles/{vehicle_id}/route", response_model=TripRouteResponse)
async def admin_vehicle_route_playback(
    vehicle_id: str,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    vehicle_code: str | None = Query(default=None),
    limit: int = Query(5000, ge=1, le=10000),
):
    """Πλήρες ιστορικό κίνησης οχήματος (Teltonika / οδηγός) — χωρίς απαίτηση trip_id."""
    from travel_platform.telemetry.trip_route_service import fetch_vehicle_route

    payload = await fetch_vehicle_route(
        session,
        tenant_id=tenant_id,
        vehicle_id=vehicle_id,
        vehicle_code=(vehicle_code or "").strip().upper() or None,
        from_time=from_time,
        to_time=to_time,
        limit=limit,
    )
    return TripRouteResponse(**payload)


@router.get("/trips/{trip_id}/route/export")
async def admin_trip_route_export(
    trip_id: int,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    fmt: str = Query("gpx", alias="format", pattern="^(gpx|kml)$"),
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    driver_id: str | None = Query(default=None),
    limit: int = Query(5000, ge=1, le=10000),
):
    """Λήψη διαδρομής ως GPX ή KML."""
    payload = await fetch_trip_route(
        session,
        tenant_id=tenant_id,
        trip_id=trip_id,
        from_time=from_time,
        to_time=to_time,
        driver_id=driver_id.strip() if driver_id else None,
        limit=limit,
    )
    points = payload.get("points") or []
    if not points:
        raise HTTPException(status_code=404, detail="Δεν βρέθηκαν GPS σημεία για εξαγωγή")
    try:
        content, media_type, filename = export_route_document(trip_id, points, fmt=fmt)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/trips/compare", response_model=TripRouteCompareResponse)
async def admin_compare_trip_routes(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    trip_a: int = Query(..., ge=1),
    trip_b: int = Query(..., ge=1),
    limit: int = Query(5000, ge=1, le=10000),
):
    """Σύγκριση δύο ιστορικών διαδρομών (μήκος, διάρκεια, απόκλιση)."""
    if trip_a == trip_b:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="Επιλέξτε δύο διαφορετικά δρομολόγια")
    payload = await fetch_and_compare_trips(
        session,
        tenant_id=tenant_id,
        trip_a=trip_a,
        trip_b=trip_b,
        limit=limit,
    )
    return TripRouteCompareResponse(**payload)


@router.get("/trips/{trip_id}/planned-vs-actual", response_model=PlannedVsActualResponse)
async def admin_planned_vs_actual_get(
    trip_id: int,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    limit: int = Query(5000, ge=1, le=10000),
):
    """Σύγκριση προγραμματισμένης διαδρομής (corridor) με πραγματική GPS."""
    payload = await fetch_planned_vs_actual(
        session,
        tenant_id=tenant_id,
        trip_id=trip_id,
        limit=limit,
    )
    return PlannedVsActualResponse(**payload)


@router.post("/trips/{trip_id}/planned-vs-actual", response_model=PlannedVsActualResponse)
async def admin_planned_vs_actual_post(
    trip_id: int,
    body: PlannedVsActualRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    limit: int = Query(5000, ge=1, le=10000),
):
    """Σύγκριση με planned stops από δρομολόγιο (αν δεν υπάρχει corridor στο backend)."""
    stops = [s.model_dump() for s in body.planned_stops] if body.planned_stops else None
    payload = await fetch_planned_vs_actual(
        session,
        tenant_id=tenant_id,
        trip_id=trip_id,
        planned_stops=stops,
        buffer_m=body.buffer_m,
        limit=limit,
    )
    return PlannedVsActualResponse(**payload)


@router.get("/teltonika/status", response_model=TeltonikaServerStatusResponse)
async def admin_teltonika_status(tenant_id: Annotated[UUID, Depends(get_tenant_id)]):
    """TCP listener status (shared host). tenant_id required by auth middleware."""
    del tenant_id
    from travel_platform.telemetry.teltonika import get_teltonika_status

    return TeltonikaServerStatusResponse(**get_teltonika_status())


@router.get("/teltonika/devices", response_model=list[TeltonikaDeviceResponse])
async def admin_list_teltonika_devices(tenant_id: Annotated[UUID, Depends(get_tenant_id)]):
    from travel_platform.telemetry.teltonika import list_devices

    return [TeltonikaDeviceResponse(**row) for row in list_devices(str(tenant_id))]


@router.post("/teltonika/devices", response_model=TeltonikaDeviceResponse)
async def admin_upsert_teltonika_device(
    body: TeltonikaDeviceUpsert,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    from travel_platform.telemetry.teltonika import upsert_device

    try:
        row = upsert_device(body.model_dump(), tenant_id=str(tenant_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return TeltonikaDeviceResponse(**row)


@router.delete("/teltonika/devices/{device_id}", status_code=204)
async def admin_delete_teltonika_device(
    device_id: str,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    from travel_platform.telemetry.teltonika import delete_device

    if not delete_device(device_id, tenant_id=str(tenant_id)):
        raise HTTPException(status_code=404, detail="Device not found")


@router.post(
    "/teltonika/devices/{device_id}/test-ping",
    response_model=TeltonikaTestPingResponse,
)
async def admin_teltonika_test_ping(
    device_id: str,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    body: TeltonikaTestPingRequest | None = None,
):
    """Drop a test GPS fix for a bound IMEI so the live map / test map show a pin."""
    from travel_platform.telemetry.processor import process_telemetry_payload
    from travel_platform.telemetry.teltonika import get_device_by_imei, list_devices, touch_device

    tid = str(tenant_id)
    rows = list_devices(tid)
    device = next((r for r in rows if str(r.get("id")) == str(device_id)), None)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if not device.get("enabled"):
        raise HTTPException(status_code=400, detail="Η συσκευή είναι ανενεργή")

    req = body or TeltonikaTestPingRequest()
    # Prefer last real fix; else Athens demo pin so the map always has something visible.
    lat = req.latitude
    lng = req.longitude
    if lat is None or lng is None:
        if device.get("last_lat") is not None and device.get("last_lng") is not None:
            lat = float(device["last_lat"])
            lng = float(device["last_lng"])
        else:
            lat, lng = 37.983810, 23.727539
    speed = float(req.speed_kmh or 0)

    vehicle_code = str(device.get("vehicle_code") or device.get("imei"))
    driver_name = str(device.get("label") or f"GPS {vehicle_code}")
    payload = {
        "tenant_id": tid,
        "vehicle_code": vehicle_code,
        "latitude": lat,
        "longitude": lng,
        "speed_kmh": speed,
        "engine_status": "on",
        "heading_deg": 0.0,
        "bus_plate": vehicle_code,
        "driver_name": driver_name,
        "driver_id": device.get("driver_id") or None,
        "imei": device.get("imei"),
        "source": "teltonika_test_ping",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await process_telemetry_payload(payload)
    touch_device(
        str(device.get("imei")),
        lat=lat,
        lng=lng,
        speed_kmh=speed,
        points=1,
    )
    refreshed = get_device_by_imei(str(device.get("imei"))) or device
    return TeltonikaTestPingResponse(
        device=TeltonikaDeviceResponse(**refreshed),
        vehicle_id=str(result.vehicle_id),
        latitude=lat,
        longitude=lng,
        source="test_ping",
    )
