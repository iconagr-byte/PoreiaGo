from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class TelemetryUpdateRequest(BaseModel):
    vehicle_code: str = Field(..., examples=["XAH-4021"])
    tenant_id: UUID
    trip_id: int | None = None
    driver_id: UUID | None = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    speed_kmh: float = Field(0, ge=0)
    engine_status: str = Field("off", description="on | off | idle")
    fuel_level_pct: float | None = Field(None, ge=0, le=100)
    recorded_at: datetime | None = None
    heading_deg: float | None = None
    accel_x: float | None = None
    accel_y: float | None = None
    accel_z: float | None = None
    tracker_event_id: int | None = Field(
        None,
        description="Teltonika-style event (101=harsh brake). Prefer over raw accel.",
    )


class TelemetryAcceptedResponse(BaseModel):
    status: str = "accepted"
    message_id: str


class LiveVehicleResponse(BaseModel):
    vehicle_id: str
    vehicle_code: str
    trip_id: int | None
    lat: float
    lng: float
    speed_kmh: float
    engine_on: bool
    fuel_level_pct: float | None
    idle_seconds_trip: int
    updated_at: datetime
    driver_name: str | None = None
    bus_plate: str | None = None
    heading_deg: float | None = None
    driver_id: str | None = None
    photo_url: str | None = None
    vehicle_image_url: str | None = None


class HeatmapPoint(BaseModel):
    lat: float
    lng: float
    weight: int


class FleetHeatmapResponse(BaseModel):
    points: list[HeatmapPoint]
    cell_size: float
    source: str = "trip_coordinates"
    point_count: int = 0
    cell_count: int = 0
    from_time: str | None = None
    to_time: str | None = None
    slow_only: bool = False
    error: str | None = None


class FleetKpiSummary(BaseModel):
    active_drivers_now: int = 0
    gps_points: int = 0
    trips_tracked: int = 0
    drivers_with_gps: int = 0
    total_distance_km: float = 0
    avg_speed_kmh: float = 0
    slow_motion_pct: float = 0
    alerts_total: int = 0
    alerts_route_deviation: int = 0
    alerts_driver_online: int = 0
    alerts_driver_offline: int = 0


class FleetKpiDailyPoint(BaseModel):
    day: str
    gps_points: int
    drivers: int
    trips: int


class FleetKpiTopTrip(BaseModel):
    trip_id: int
    distance_km: float
    point_count: int
    first_at: str | None = None
    last_at: str | None = None


class FleetKpisResponse(BaseModel):
    tenant_id: str
    from_time: str
    to_time: str | None = None
    days: int
    summary: FleetKpiSummary
    daily: list[FleetKpiDailyPoint]
    top_trips: list[FleetKpiTopTrip]
    alerts_by_type: dict[str, int] = Field(default_factory=dict)
    error: str | None = None


class DriverTripTelemetryResponse(BaseModel):
    trip_id: int
    idle_seconds: int
    idle_cost_eur: float
    fuel_wasted_liters: float
    estimated_fuel_saved_liters: float
    is_currently_idling: bool


class TelemetryAlertResponse(BaseModel):
    id: str
    alert_type: str
    tenant_id: str
    vehicle_id: str
    trip_id: int | None
    message: str
    metadata: dict | None = None
    created_at: str


class TripRoutePointResponse(BaseModel):
    id: int
    trip_id: int | None = None
    driver_id: str | None = None
    vehicle_id: str | None = None
    lat: float
    lng: float
    speed_kmh: float = 0
    heading_deg: float | None = None
    recorded_at: str


class TripRouteResponse(BaseModel):
    trip_id: int
    tenant_id: str
    point_count: int
    from_time: str | None = None
    to_time: str | None = None
    points: list[TripRoutePointResponse]
    error: str | None = None
    summary: dict[str, Any] | None = None


class TripRouteCompareMetrics(BaseModel):
    a_to_b_mean_deviation_m: float
    a_to_b_max_deviation_m: float
    b_to_a_mean_deviation_m: float
    b_to_a_max_deviation_m: float
    symmetric_mean_deviation_m: float
    path_length_delta_km: float
    duration_delta_min: float
    avg_speed_delta_kmh: float


class TripRouteCompareResponse(BaseModel):
    trip_a: int
    trip_b: int
    tenant_id: str | None = None
    error: str | None = None
    metrics: TripRouteCompareMetrics | None = None
    route_a: TripRouteResponse
    route_b: TripRouteResponse


class PlannedStopInput(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    name: str | None = None


class PlannedVsActualRequest(BaseModel):
    planned_stops: list[PlannedStopInput] | None = None
    buffer_m: int | None = Field(None, ge=30, le=300)


class PlannedRouteInfo(BaseModel):
    points: list[dict[str, float]]
    source: str
    buffer_m: int
    point_count: int


class PlannedVsActualMetrics(BaseModel):
    on_corridor_pct: float
    mean_deviation_m: float
    max_deviation_m: float
    off_corridor_points: int
    buffer_m: int
    compliance_score: float
    planned_source: str


class PlannedVsActualResponse(BaseModel):
    trip_id: int
    tenant_id: str
    planned: PlannedRouteInfo
    actual: TripRouteResponse
    metrics: PlannedVsActualMetrics | None = None
    error: str | None = None


class PassengerEtaResponse(BaseModel):
    trip_id: int
    next_stop_name: str
    eta_seconds: int
    eta_display: str
    distance_m: int
    traffic_level: str
    traffic_label: str
    vehicle_lat: float | None = None
    vehicle_lng: float | None = None
    computed_at: datetime
    server_sync_interval_sec: int = 30


class PassengerTrackResponse(BaseModel):
    trip_id: int
    tenant_id: str
    online: bool = False
    vehicle_id: str | None = None
    vehicle_code: str | None = None
    bus_plate: str | None = None
    driver_name: str | None = None
    vehicle_lat: float | None = None
    vehicle_lng: float | None = None
    speed_kmh: float | None = None
    heading_deg: float | None = None
    updated_at: str | None = None
    next_stop_name: str = "—"
    eta_seconds: int = 0
    eta_display: str = "—"
    distance_m: int = 0
    traffic_level: str = "unknown"
    traffic_label: str = "—"
    computed_at: datetime | None = None
    server_sync_interval_sec: int = 30


class PassengerTrackLinkResponse(BaseModel):
    trip_id: int
    tenant_id: UUID
    token: str
    path: str
    expires_hours: int = 72


class FleetEtaItem(BaseModel):
    type: str = "eta_update"
    trip_id: int
    next_stop_name: str
    eta_seconds: int
    eta_display: str
    distance_m: int
    traffic_level: str
    traffic_label: str
    vehicle_lat: float | None = None
    vehicle_lng: float | None = None
    computed_at: datetime
    server_sync_interval_sec: int = 30
    vehicle_id: str | None = None
    vehicle_code: str | None = None
    bus_plate: str | None = None
    driver_name: str | None = None
    driver_id: str | None = None
    speed_kmh: float | None = None


class FleetEtasResponse(BaseModel):
    tenant_id: str
    item_count: int
    refresh_seconds: int
    push_seconds: int
    google_maps_configured: bool = False
    items: list[FleetEtaItem]


class GeofenceStopLayer(BaseModel):
    trip_id: int
    stop_id: int
    name: str
    lat: float
    lng: float
    radius_m: int


class GeofenceCorridorLayer(BaseModel):
    trip_id: int
    name: str
    buffer_m: int
    points: list[dict[str, float]]


class GeofenceMapLayersResponse(BaseModel):
    tenant_id: str
    trip_ids: list[int]
    corridors: list[GeofenceCorridorLayer]
    stops: list[GeofenceStopLayer]
    geofence_radius_m: int
    corridor_buffer_m: int


class DriverSafetyResponse(BaseModel):
    driver_id: str
    safety_score: int
    events_last_30d: int
    distance_km_30d: float
    events_per_100km: float


class TelemetrySettingsResponse(BaseModel):
    geofence_radius_m: int = Field(50, ge=30, le=200)
    corridor_buffer_m: int = Field(75, ge=30, le=200)
    corridor_min_speed_kmh: float = Field(8.0, ge=0, le=40)
    corridor_debounce_points: int = Field(3, ge=1, le=10)
    idle_alert_seconds: int = Field(300, ge=60, le=3600)
    idle_fuel_liters_per_hour: float = Field(2.5, ge=0.5, le=10)
    fuel_price_eur_per_liter: float = Field(1.85, ge=0.5, le=5)
    gforce_spike_threshold_g: float = Field(0.45, ge=0.1, le=2.0)
    prefer_tracker_events: bool = True
    eta_refresh_seconds: int = Field(300, ge=60, le=900)
    eta_ws_push_seconds: int = Field(30, ge=10, le=120)
    driver_stale_seconds: int = Field(90, ge=30, le=600)
    gps_retention_days: int = Field(90, ge=0, le=3650)
    driver_gps_max_per_minute: int = Field(60, ge=0, le=600)
    fleet_webhook_enabled: bool = True
    fleet_webhook_min_interval_sec: int = Field(30, ge=0, le=600)
    fleet_digest_enabled: bool = True
    fleet_digest_email_enabled: bool = True
    fleet_digest_sms_enabled: bool = False
    google_maps_configured: bool = False


class TelemetrySettingsUpdate(BaseModel):
    geofence_radius_m: int | None = Field(None, ge=30, le=200)
    corridor_buffer_m: int | None = Field(None, ge=30, le=200)
    corridor_min_speed_kmh: float | None = Field(None, ge=0, le=40)
    corridor_debounce_points: int | None = Field(None, ge=1, le=10)
    idle_alert_seconds: int | None = Field(None, ge=60, le=3600)
    idle_fuel_liters_per_hour: float | None = Field(None, ge=0.5, le=10)
    fuel_price_eur_per_liter: float | None = Field(None, ge=0.5, le=5)
    gforce_spike_threshold_g: float | None = Field(None, ge=0.1, le=2.0)
    prefer_tracker_events: bool | None = None
    eta_refresh_seconds: int | None = Field(None, ge=60, le=900)
    eta_ws_push_seconds: int | None = Field(None, ge=10, le=120)
    driver_stale_seconds: int | None = Field(None, ge=30, le=600)
    gps_retention_days: int | None = Field(None, ge=0, le=3650)
    driver_gps_max_per_minute: int | None = Field(None, ge=0, le=600)
    fleet_webhook_enabled: bool | None = None
    fleet_webhook_min_interval_sec: int | None = Field(None, ge=0, le=600)
    fleet_digest_enabled: bool | None = None
    fleet_digest_email_enabled: bool | None = None
    fleet_digest_sms_enabled: bool | None = None


class GpsRetentionPurgeResponse(BaseModel):
    tenant_id: UUID
    deleted: int = Field(0, ge=0)
    retention_days: int = Field(0, ge=0)


class FleetDigestSendResponse(BaseModel):
    tenant_id: UUID
    sent: bool = False
    email: dict[str, Any] | None = None
    sms: dict[str, Any] | None = None
    skipped: bool = False
    reason: str | None = None
