"""
Runtime telemetry settings — editable from admin control panel.
Merges env defaults (PlatformSettings) with in-memory tenant overrides.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from core.config import get_platform_settings

# Live ETA / WS / fleet push — locked platform-wide (not tenant-configurable).
LOCKED_LIVE_REFRESH_SECONDS = 5


@dataclass
class TelemetryRuntimeSettings:
    geofence_radius_m: int = 50
    corridor_buffer_m: int = 75
    corridor_min_speed_kmh: float = 8.0
    corridor_debounce_points: int = 3
    idle_alert_seconds: int = 300
    idle_fuel_liters_per_hour: float = 2.5
    fuel_price_eur_per_liter: float = 1.85
    gforce_spike_threshold_g: float = 0.45
    prefer_tracker_events: bool = True
    eta_refresh_seconds: int = 5
    eta_ws_push_seconds: int = 5
    driver_stale_seconds: int = 90
    gps_retention_days: int = 90
    driver_gps_max_per_minute: int = 60
    fleet_webhook_enabled: bool = True
    fleet_webhook_min_interval_sec: int = 30
    fleet_digest_enabled: bool = True
    fleet_digest_email_enabled: bool = True
    fleet_digest_sms_enabled: bool = False
    google_maps_configured: bool = False


_store: TelemetryRuntimeSettings | None = None
_tenant_overrides: dict[str, dict[str, Any]] = {}


def _defaults() -> TelemetryRuntimeSettings:
    s = get_platform_settings()
    return TelemetryRuntimeSettings(
        geofence_radius_m=s.geofence_radius_m,
        corridor_buffer_m=s.corridor_buffer_m,
        idle_alert_seconds=s.idle_alert_seconds,
        idle_fuel_liters_per_hour=s.idle_fuel_liters_per_hour,
        fuel_price_eur_per_liter=s.fuel_price_eur_per_liter,
        gforce_spike_threshold_g=s.gforce_spike_threshold_g,
        eta_refresh_seconds=s.eta_refresh_seconds,
        driver_stale_seconds=getattr(s, "driver_stale_seconds", 90),
        gps_retention_days=getattr(s, "gps_retention_days", 90),
        driver_gps_max_per_minute=getattr(s, "driver_gps_max_per_minute", 60),
        fleet_webhook_enabled=getattr(s, "fleet_webhook_enabled", True),
        fleet_webhook_min_interval_sec=getattr(s, "fleet_webhook_min_interval_sec", 30),
        fleet_digest_enabled=getattr(s, "fleet_digest_enabled", True),
        fleet_digest_email_enabled=getattr(s, "fleet_digest_email_enabled", True),
        fleet_digest_sms_enabled=getattr(s, "fleet_digest_sms_enabled", False),
        google_maps_configured=bool(s.google_maps_api_key),
    )


def get_telemetry_settings(tenant_id: str | None = None) -> TelemetryRuntimeSettings:
    global _store
    if _store is None:
        _store = _defaults()
    base = asdict(_store)
    if tenant_id and tenant_id in _tenant_overrides:
        base.update(_tenant_overrides[tenant_id])
    # Hard lock — ignore any saved/override values for live refresh.
    base["eta_ws_push_seconds"] = LOCKED_LIVE_REFRESH_SECONDS
    base["eta_refresh_seconds"] = LOCKED_LIVE_REFRESH_SECONDS
    return TelemetryRuntimeSettings(**base)


def update_telemetry_settings(
    patch: dict[str, Any],
    tenant_id: str | None = None,
) -> TelemetryRuntimeSettings:
    global _store
    if _store is None:
        _store = _defaults()

    allowed = set(TelemetryRuntimeSettings.__dataclass_fields__.keys()) - {
        "google_maps_configured",
        # Locked — cannot be changed from admin UI / API.
        "eta_ws_push_seconds",
        "eta_refresh_seconds",
    }
    clean = {k: v for k, v in patch.items() if k in allowed}

    if tenant_id:
        cur = _tenant_overrides.setdefault(tenant_id, {})
        cur.update(clean)
        cur["eta_ws_push_seconds"] = LOCKED_LIVE_REFRESH_SECONDS
        cur["eta_refresh_seconds"] = LOCKED_LIVE_REFRESH_SECONDS
    else:
        for k, v in clean.items():
            setattr(_store, k, v)
        _store.eta_ws_push_seconds = LOCKED_LIVE_REFRESH_SECONDS
        _store.eta_refresh_seconds = LOCKED_LIVE_REFRESH_SECONDS

    settings = get_telemetry_settings(tenant_id)
    apply_telemetry_settings_to_services(settings)
    return settings


def apply_telemetry_settings_to_services(settings: TelemetryRuntimeSettings | None = None) -> None:
    if settings is None:
        settings = get_telemetry_settings()
    _apply_to_services(settings)


def _apply_to_services(settings: TelemetryRuntimeSettings) -> None:
    import travel_platform.telemetry.corridor_geofence as corridor_mod
    import travel_platform.telemetry.driving_behavior as driving_mod
    import travel_platform.telemetry.eta_intelligence as eta_mod
    import travel_platform.telemetry.ws_hub as ws_mod
    from travel_platform.telemetry.processor import get_idling

    corridor_mod.DEFAULT_BUFFER_M = settings.corridor_buffer_m
    corridor_mod.MIN_SPEED_FOR_CHECK_KMH = settings.corridor_min_speed_kmh
    corridor_mod.CONSECUTIVE_OFF_POINTS = settings.corridor_debounce_points

    driving_mod.G_SPIKE_THRESHOLD = settings.gforce_spike_threshold_g

    eta_mod.REFRESH_SECONDS = LOCKED_LIVE_REFRESH_SECONDS
    ws_mod.ETA_PUSH_INTERVAL_SEC = LOCKED_LIVE_REFRESH_SECONDS

    idling = get_idling()
    idling._threshold = settings.idle_alert_seconds
    idling._fuel_lph = settings.idle_fuel_liters_per_hour
    idling._fuel_price = settings.fuel_price_eur_per_liter
