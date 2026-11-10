"""Live refresh interval is locked to 1 second platform-wide."""

from travel_platform.telemetry.settings_store import (
    LOCKED_LIVE_REFRESH_SECONDS,
    get_telemetry_settings,
    update_telemetry_settings,
)


def test_live_refresh_locked_to_one_second():
    assert LOCKED_LIVE_REFRESH_SECONDS == 1
    settings = get_telemetry_settings()
    assert settings.eta_ws_push_seconds == 1
    assert settings.eta_refresh_seconds == 1

    patched = update_telemetry_settings(
        {
            "eta_ws_push_seconds": 60,
            "eta_refresh_seconds": 300,
            "idle_alert_seconds": 180,
            "driver_gps_max_per_minute": 30,
        }
    )
    assert patched.eta_ws_push_seconds == 1
    assert patched.eta_refresh_seconds == 1
    assert patched.idle_alert_seconds == 180
    # Rate limit remains editable; default headroom for 1 Hz GPS.
    assert patched.driver_gps_max_per_minute == 30
