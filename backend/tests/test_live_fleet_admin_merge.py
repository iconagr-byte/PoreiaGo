"""Admin live map must see platform GPS even with a legacy demo JWT."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from uuid import UUID

from travel_platform.telemetry.domain import TelemetryUpdate
from travel_platform.telemetry.live_fleet import LiveFleetService
from travel_platform.operations.master_qr_local import DEFAULT_TENANT

PLATFORM = "c8208a59-bb2b-4299-a4d5-6fbadbb9b089"
DEMO = DEFAULT_TENANT


def _ping(live: LiveFleetService, *, tenant_id: str, code: str, lat: float, lng: float) -> None:
    update = TelemetryUpdate(
        vehicle_code=code,
        tenant_id=UUID(tenant_id),
        trip_id=1,
        latitude=lat,
        longitude=lng,
        speed_kmh=12,
        engine_on=True,
        fuel_level_pct=None,
        recorded_at=datetime.now(timezone.utc),
        raw={"driver_name": "Test", "bus_plate": code, "driver_id": "d1"},
    )
    vid = live.upsert_vehicle_registry(UUID(tenant_id), code, 1)
    live.apply_update(vid, update, idle_seconds=0)


class LiveFleetAdminMergeTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        LiveFleetService._vehicles = {}
        LiveFleetService._code_index = {}

    async def test_demo_admin_sees_platform_gps(self):
        live = LiveFleetService()
        _ping(live, tenant_id=PLATFORM, code="TRIP-1", lat=40.8, lng=22.05)

        with patch(
            "travel_platform.operations.master_qr_bridge.resolve_platform_tenant_id",
            new=AsyncMock(return_value=PLATFORM),
        ):
            rows = await live.list_active_for_admin_async(UUID(DEMO))

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].vehicle_code, "TRIP-1")

    async def test_platform_admin_sees_own_gps(self):
        live = LiveFleetService()
        _ping(live, tenant_id=PLATFORM, code="BUS-9", lat=38.2, lng=21.7)

        with patch(
            "travel_platform.operations.master_qr_bridge.resolve_platform_tenant_id",
            new=AsyncMock(return_value=PLATFORM),
        ):
            rows = await live.list_active_for_admin_async(UUID(PLATFORM))

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].vehicle_code, "BUS-9")

    async def test_platform_admin_also_merges_demo_legacy(self):
        live = LiveFleetService()
        _ping(live, tenant_id=DEMO, code="OLD-1", lat=37.9, lng=23.7)
        _ping(live, tenant_id=PLATFORM, code="NEW-1", lat=40.8, lng=22.0)

        with patch(
            "travel_platform.operations.master_qr_bridge.resolve_platform_tenant_id",
            new=AsyncMock(return_value=PLATFORM),
        ):
            rows = await live.list_active_for_admin_async(UUID(PLATFORM))

        codes = {r.vehicle_code for r in rows}
        self.assertEqual(codes, {"OLD-1", "NEW-1"})


if __name__ == "__main__":
    unittest.main()
