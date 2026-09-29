"""Tests for live fleet trail ring + history flush helpers."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import pytest

from travel_platform.telemetry import coordinate_flush_worker
from travel_platform.telemetry.coordinate_buffer import clear_buffer_for_tests, pending_count
from travel_platform.telemetry.live_fleet_trail_redis import (
    append_trail_point,
    clear_memory_trails_for_tests,
    drain_trail,
    load_trail,
    trail_points_for_api,
)
from travel_platform.telemetry.trail_history_flush import persist_vehicle_trail_to_history


@pytest.fixture(autouse=True)
def _clean():
    clear_memory_trails_for_tests()
    clear_buffer_for_tests()
    yield
    clear_memory_trails_for_tests()
    clear_buffer_for_tests()


def test_append_and_load_trail_memory():
    async def run():
        tid, vid = "tenant-a", "veh-1"
        assert await append_trail_point(tid, vid, lat=38.25, lng=21.73, speed_kmh=0)
        assert not await append_trail_point(tid, vid, lat=38.250001, lng=21.730001, speed_kmh=0)
        assert await append_trail_point(tid, vid, lat=38.26, lng=21.74, speed_kmh=40)
        trail = await load_trail(tid, vid)
        assert len(trail) == 2
        api = trail_points_for_api(trail)
        assert api[0]["lat"] == pytest.approx(38.25, abs=1e-5)
        assert api[-1]["lng"] == pytest.approx(21.74, abs=1e-5)

    asyncio.run(run())


def test_process_telemetry_buffers_history_and_trail(monkeypatch):
    """Shared ingest path (Teltonika + driver) must enqueue PostGIS history + trail."""

    async def run():
        from uuid import uuid4

        from travel_platform.telemetry.processor import process_telemetry_payload

        tid = str(uuid4())
        before = pending_count()
        await process_telemetry_payload(
            {
                "tenant_id": tid,
                "vehicle_code": "EEX5670",
                "bus_plate": "EEX5670",
                "latitude": 40.52,
                "longitude": 22.20,
                "speed_kmh": 55,
                "heading_deg": 180,
                "engine_status": "on",
                "source": "teltonika",
                "imei": "861076085468260",
                "altitude_m": 90,
                "satellites": 11,
                "recorded_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        assert pending_count() == before + 1
        from travel_platform.telemetry.processor import get_live_fleet

        fleet = get_live_fleet()
        vid = fleet.find_vehicle_id(tid, "EEX5670")
        assert vid
        trail = await load_trail(tid, vid)
        assert len(trail) >= 1
        meta = fleet._vehicles.get(str(vid), {})
        assert meta.get("tracking_started_at")

    asyncio.run(run())


def test_drain_trail_clears_and_persist_queues_history(monkeypatch):
    async def _noop_flush():
        return 0

    monkeypatch.setattr(coordinate_flush_worker, "flush_coordinates_batch", _noop_flush)

    async def run():
        tid, vid = "tenant-b", "veh-2"
        await append_trail_point(
            tid,
            vid,
            lat=37.98,
            lng=23.72,
            speed_kmh=10,
            trip_id=7,
            driver_id="drv-1",
            recorded_at=datetime.now(timezone.utc),
        )
        await append_trail_point(tid, vid, lat=37.99, lng=23.73, speed_kmh=20, trip_id=7)

        before = pending_count()
        n = await persist_vehicle_trail_to_history(tid, vid, trip_id=7, driver_id="drv-1")
        assert n == 2
        assert pending_count() == before + 2
        assert await load_trail(tid, vid) == []
        assert await drain_trail(tid, vid) == []

    asyncio.run(run())
