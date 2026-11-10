"""Live fleet media enrichment + forced shift offline."""

from __future__ import annotations

from travel_platform.telemetry.driver_shift_tracker import (
    force_driver_offline,
    on_driver_connected,
)
from travel_platform.telemetry.live_fleet_media import DEFAULT_BUS_IMAGE, enrich_live_vehicle_media


def test_enrich_live_vehicle_media_defaults_to_hero_bus():
    media = enrich_live_vehicle_media(driver_id=None, bus_plate=None, vehicle_code=None)
    assert media["vehicle_image_url"] == DEFAULT_BUS_IMAGE
    assert media["photo_url"] is None


def test_force_driver_offline_clears_connections():
    session = {"tenant_id": "t1", "sub": "d1", "trip_id": 9}
    assert on_driver_connected(session, 101) is True
    assert on_driver_connected(session, 102) is False
    assert force_driver_offline(session) is True
    assert force_driver_offline(session) is False
