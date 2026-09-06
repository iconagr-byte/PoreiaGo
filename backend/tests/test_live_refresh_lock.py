"""Live refresh interval is locked to 5 seconds platform-wide."""

from travel_platform.telemetry.settings_store import (
    LOCKED_LIVE_REFRESH_SECONDS,
    get_telemetry_settings,
    update_telemetry_settings,
)


def test_live_refresh_locked_to_five_seconds():
    assert LOCKED_LIVE_REFRESH_SECONDS == 5
    settings = get_telemetry_settings()
    assert settings.eta_ws_push_seconds == 5
    assert settings.eta_refresh_seconds == 5

    patched = update_telemetry_settings(
        {
            "eta_ws_push_seconds": 60,
            "eta_refresh_seconds": 300,
            "idle_alert_seconds": 180,
        }
    )
    assert patched.eta_ws_push_seconds == 5
    assert patched.eta_refresh_seconds == 5
    assert patched.idle_alert_seconds == 180
