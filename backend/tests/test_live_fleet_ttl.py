"""Live fleet Redis TTL + load refresh."""

from __future__ import annotations

import os

from travel_platform.telemetry import live_fleet_redis as mod


def test_default_ttl_is_long_enough_for_gps_gaps(monkeypatch):
    monkeypatch.delenv("FLEET_LIVE_REDIS_TTL_SEC", raising=False)
    assert mod._ttl_seconds() >= 900


def test_ttl_env_override(monkeypatch):
    monkeypatch.setenv("FLEET_LIVE_REDIS_TTL_SEC", "300")
    assert mod._ttl_seconds() == 300


def test_driver_stale_default_allows_brief_gaps():
    from travel_platform.telemetry.settings_store import TelemetryRuntimeSettings

    assert TelemetryRuntimeSettings().driver_stale_seconds >= 300
