"""Platform-wide configuration (12-factor env)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class PlatformSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Tenant / auth
    auth_jwt_secret: str = ""
    auth_jwt_algorithm: str = "HS256"

    # Abandoned booking recovery
    abandoned_pending_minutes: int = 60
    abandoned_recovery_cooldown_hours: int = 24

    # Dynamic pricing
    pricing_high_occupancy_threshold: float = 0.80
    pricing_high_occupancy_markup_pct: float = 10.0
    pricing_low_occupancy_threshold: float = 0.30
    pricing_low_occupancy_discount_pct: float = 5.0

    # Master QR (driver manifest bootstrap)
    master_qr_secret: str = ""
    master_qr_ttl_hours: int = 24

    # Partner webhooks
    webhook_signing_secret: str = ""
    webhook_delivery_timeout_seconds: int = 10
    webhook_max_retries: int = 5

    # Telemetry / idle control
    idle_alert_seconds: int = 300
    idle_fuel_liters_per_hour: float = 2.5
    fuel_price_eur_per_liter: float = 1.85
    geofence_radius_m: int = 50
    corridor_buffer_m: int = 75
    gforce_spike_threshold_g: float = 0.45
    eta_refresh_seconds: int = 5
    driver_stale_seconds: int = 90
    gps_retention_days: int = 90
    driver_gps_max_per_minute: int = 60
    fleet_webhook_enabled: bool = True
    fleet_webhook_min_interval_sec: int = 30
    fleet_digest_enabled: bool = True
    fleet_digest_email_enabled: bool = True
    fleet_digest_sms_enabled: bool = False
    google_maps_api_key: str = ""

    # Celery
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    usage_metering_enabled: bool = True
    usage_metering_cron_hour: int = 2
    usage_metering_cron_minute: int = 0

    # Notifications / hybrid providers (live when keys set in env)
    smtp_from_email: str = "noreply@aerostride.app"
    sms_sender_id: str = "AEROSTRIDE"
    aviationstack_api_key: str = ""
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    twilio_whatsapp_from: str = ""


@lru_cache
def get_platform_settings() -> PlatformSettings:
    return PlatformSettings()


platform_settings = get_platform_settings()


def hybrid_provider_status() -> dict:
    """Public readiness flags (never expose secret values)."""
    s = get_platform_settings()
    aviation = bool(str(s.aviationstack_api_key or "").strip())
    twilio_sms = bool(
        str(s.twilio_account_sid or "").strip()
        and str(s.twilio_auth_token or "").strip()
        and str(s.twilio_from_number or "").strip()
    )
    wa_from = str(s.twilio_whatsapp_from or "").strip()
    if not wa_from and twilio_sms:
        wa_from = f"whatsapp:{s.twilio_from_number.strip()}"
    twilio_whatsapp = twilio_sms and bool(wa_from)
    return {
        "aviationstack": {
            "configured": aviation,
            "mode": "live" if aviation else "stub",
        },
        "twilio_sms": {
            "configured": twilio_sms,
            "mode": "live" if twilio_sms else "stub",
        },
        "twilio_whatsapp": {
            "configured": twilio_whatsapp,
            "mode": "live" if twilio_whatsapp else "stub",
        },
    }