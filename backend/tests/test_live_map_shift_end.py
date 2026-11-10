"""Live fleet media enrichment + forced shift offline + map clear."""

from __future__ import annotations

import asyncio

from travel_platform.telemetry.driver_shift_tracker import (
    force_driver_offline,
    on_driver_connected,
)
from travel_platform.telemetry.live_fleet import LiveFleetService
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


def test_remove_driver_vehicles_clears_memory_pin():
    live = LiveFleetService()
    vid = "test-shift-end-vid"
    code_key = "tenant-a:BUS-SHIFT-END"
    live._vehicles[vid] = {
        "vehicle_id": vid,
        "tenant_id": "tenant-a",
        "driver_id": "driver-a",
        "vehicle_code": "BUS-SHIFT-END",
        "lat": 37.98,
        "lng": 23.72,
    }
    live._code_index[code_key] = vid
    try:
        removed = asyncio.run(live.remove_driver_vehicles("tenant-a", "driver-a"))
        assert vid in removed
        assert vid not in live._vehicles
        assert code_key not in live._code_index
    finally:
        live._vehicles.pop(vid, None)
        live._code_index.pop(code_key, None)
