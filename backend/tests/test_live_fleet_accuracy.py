"""Live fleet meta keeps GPS accuracy for the admin map."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from uuid import UUID

from travel_platform.telemetry.domain import TelemetryUpdate
from travel_platform.telemetry.live_fleet import LiveFleetService

DEMO = UUID("00000000-0000-0000-0000-000000000001")


class LiveFleetAccuracyTests(unittest.TestCase):
    def test_apply_update_stores_accuracy_and_altitude(self):
        fleet = LiveFleetService()
        # Isolate class-level stores for this test instance usage pattern.
        fleet._vehicles = {}
        fleet._code_index = {}
        fleet._heat_points = fleet._heat_points.__class__(list)

        vid = fleet.upsert_vehicle_registry(DEMO, "ACC-001", trip_id=9)
        update = TelemetryUpdate(
            vehicle_code="ACC-001",
            tenant_id=DEMO,
            trip_id=9,
            latitude=37.98,
            longitude=23.73,
            speed_kmh=42.0,
            engine_on=True,
            fuel_level_pct=None,
            recorded_at=datetime.now(timezone.utc),
            raw={
                "driver_id": "drv-acc",
                "driver_name": "Accuracy Driver",
                "bus_plate": "ACC-001",
                "heading_deg": 120.0,
                "accuracy_m": 9.5,
                "altitude_m": 85.0,
            },
        )
        fleet.apply_update(vid, update, idle_seconds=0)
        meta = fleet.vehicle_meta(DEMO, str(vid))
        self.assertEqual(meta.get("accuracy_m"), 9.5)
        self.assertEqual(meta.get("altitude_m"), 85.0)
        self.assertEqual(meta.get("heading_deg"), 120.0)


if __name__ == "__main__":
    unittest.main()
