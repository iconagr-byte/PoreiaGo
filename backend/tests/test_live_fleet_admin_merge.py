"""Admin live map — DEMO↔platform merge must not bleed into other offices."""

from __future__ import annotations

import os
import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from uuid import UUID

from travel_platform.telemetry.domain import TelemetryUpdate
from travel_platform.telemetry.live_fleet import LiveFleetService
from travel_platform.operations.master_qr_local import DEFAULT_TENANT

PLATFORM = "c8208a59-bb2b-4299-a4d5-6fbadbb9b089"
DEMO = DEFAULT_TENANT
OTHER = "11111111-1111-4111-8111-111111111111"


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
        raw={"driver_name": "Achilleas Charalambidis", "bus_plate": code, "driver_id": "d1"},
    )
    vid = live.upsert_vehicle_registry(UUID(tenant_id), code, 1)
    live.apply_update(vid, update, idle_seconds=0)


class LiveFleetAdminMergeTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        LiveFleetService._vehicles = {}
        LiveFleetService._code_index = {}

    async def test_merge_off_by_default_no_cross_tenant(self):
        live = LiveFleetService()
        _ping(live, tenant_id=PLATFORM, code="TRIP-1", lat=40.8, lng=22.05)

        with patch.dict(os.environ, {"ALLOW_CROSS_TENANT_FLEET_MERGE": ""}, clear=False):
            with patch(
                "travel_platform.operations.master_qr_bridge.resolve_platform_tenant_id",
                new=AsyncMock(return_value=PLATFORM),
            ):
                demo_rows = await live.list_active_for_admin_async(UUID(DEMO))
                other_rows = await live.list_active_for_admin_async(UUID(OTHER))

        self.assertEqual(demo_rows, [])
        self.assertEqual(other_rows, [])

    async def test_demo_admin_sees_platform_gps_when_merge_on(self):
        live = LiveFleetService()
        _ping(live, tenant_id=PLATFORM, code="TRIP-1", lat=40.8, lng=22.05)

        with patch.dict(os.environ, {"ALLOW_CROSS_TENANT_FLEET_MERGE": "1"}, clear=False):
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

    async def test_platform_admin_merges_demo_legacy_when_merge_on(self):
        live = LiveFleetService()
        _ping(live, tenant_id=DEMO, code="OLD-1", lat=37.9, lng=23.7)
        _ping(live, tenant_id=PLATFORM, code="NEW-1", lat=40.8, lng=22.0)

        with patch.dict(os.environ, {"ALLOW_CROSS_TENANT_FLEET_MERGE": "1"}, clear=False):
            with patch(
                "travel_platform.operations.master_qr_bridge.resolve_platform_tenant_id",
                new=AsyncMock(return_value=PLATFORM),
            ):
                rows = await live.list_active_for_admin_async(UUID(PLATFORM))

        codes = {r.vehicle_code for r in rows}
        self.assertEqual(codes, {"OLD-1", "NEW-1"})

    async def test_other_office_never_sees_achillio_or_demo_pin(self):
        """PoreiaGo must not show Achilleas even if legacy merge is enabled."""
        live = LiveFleetService()
        _ping(live, tenant_id=DEMO, code="TRIP-1", lat=40.8, lng=22.05)
        _ping(live, tenant_id=PLATFORM, code="TRIP-1b", lat=40.81, lng=22.06)

        with patch.dict(os.environ, {"ALLOW_CROSS_TENANT_FLEET_MERGE": "1"}, clear=False):
            with patch(
                "travel_platform.operations.master_qr_bridge.resolve_platform_tenant_id",
                new=AsyncMock(return_value=PLATFORM),
            ):
                rows = await live.list_active_for_admin_async(UUID(OTHER))

        self.assertEqual(rows, [])


if __name__ == "__main__":
    unittest.main()
