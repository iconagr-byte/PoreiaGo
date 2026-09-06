"""End-shift must wipe live pins across office + seed tenant mirrors."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from uuid import UUID

from travel_platform.operations.master_qr_local import DEFAULT_TENANT
from travel_platform.telemetry.domain import TelemetryUpdate
from travel_platform.telemetry.live_fleet import LiveFleetService

OFFICE = "81ce186d-40fd-4f51-8e62-1353a9e68f33"
SEED = "c8208a59-bb2b-4299-a4d5-6fbadbb9b089"
DRIVER = "df8f4625-f439-448d-a978-53f942bbc594"


def _ping(live: LiveFleetService, *, tenant_id: str, driver_id: str, code: str) -> str:
    update = TelemetryUpdate(
        vehicle_code=code,
        tenant_id=UUID(tenant_id),
        trip_id=1,
        latitude=40.8,
        longitude=22.05,
        speed_kmh=0,
        engine_on=False,
        fuel_level_pct=None,
        recorded_at=datetime.now(timezone.utc),
        raw={"driver_name": "Test", "bus_plate": code, "driver_id": driver_id},
    )
    vid = live.upsert_vehicle_registry(UUID(tenant_id), code, 1)
    live.apply_update(str(vid), update, idle_seconds=0)
    live._vehicles[str(vid)]["driver_id"] = driver_id
    return str(vid)


class RemoveDriverVehiclesTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        LiveFleetService._vehicles = {}
        LiveFleetService._code_index = {}

    async def test_clears_seed_mirror_and_office(self):
        live = LiveFleetService()
        office_vid = _ping(live, tenant_id=OFFICE, driver_id=DRIVER, code="TRIP-1")
        seed_vid = _ping(live, tenant_id=SEED, driver_id=DRIVER, code="TRIP-1b")
        other = _ping(live, tenant_id=SEED, driver_id="other-driver", code="OTHER")

        with patch(
            "travel_platform.telemetry.live_fleet_redis.delete_live_vehicle",
            new=AsyncMock(return_value=True),
        ) as delete_mock, patch(
            "travel_platform.telemetry.live_fleet_redis.load_live_vehicles",
            new=AsyncMock(return_value=[]),
        ):
            removed = await live.remove_driver_vehicles(
                OFFICE,
                DRIVER,
                extra_tenant_ids=[SEED, DEFAULT_TENANT],
            )

        self.assertIn(office_vid, removed)
        self.assertIn(seed_vid, removed)
        self.assertNotIn(other, removed)
        self.assertNotIn(office_vid, live._vehicles)
        self.assertNotIn(seed_vid, live._vehicles)
        self.assertIn(other, live._vehicles)
        self.assertGreaterEqual(delete_mock.await_count, 2)

    async def test_clears_redis_only_pin(self):
        live = LiveFleetService()
        remote = {
            "vehicle_id": "remote-1",
            "tenant_id": SEED,
            "driver_id": DRIVER,
            "vehicle_code": "TRIP-1",
            "lat": 40.8,
            "lng": 22.05,
        }

        async def load(tid):
            return [remote] if tid == SEED else []

        with patch(
            "travel_platform.telemetry.live_fleet_redis.delete_live_vehicle",
            new=AsyncMock(return_value=True),
        ) as delete_mock, patch(
            "travel_platform.telemetry.live_fleet_redis.load_live_vehicles",
            new=AsyncMock(side_effect=load),
        ):
            removed = await live.remove_driver_vehicles(
                OFFICE,
                DRIVER,
                extra_tenant_ids=[SEED],
            )

        self.assertEqual(removed, ["remote-1"])
        delete_mock.assert_any_await(SEED, "remote-1")


if __name__ == "__main__":
    unittest.main()
