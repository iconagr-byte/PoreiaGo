"""Office can clear driver SOS so the pin leaves the live map."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from travel_platform.telemetry.alerts import TelemetryAlertBus


class TelemetryAlertClearTests(unittest.TestCase):
    def setUp(self):
        TelemetryAlertBus._recent.clear()
        TelemetryAlertBus._cleared_ids.clear()

    def tearDown(self):
        TelemetryAlertBus._recent.clear()
        TelemetryAlertBus._cleared_ids.clear()

    def test_clear_removes_sos_from_list_recent(self):
        row = TelemetryAlertBus.push_driver_shift(
            alert_type="SOS",
            tenant_id="tenant-a",
            message="SOS test",
            metadata={"bus_plate": "EEX5670", "driver_id": "drv-1", "lat": 40.8, "lng": 22.0},
        )
        aid = row["id"]
        self.assertEqual(len(TelemetryAlertBus.list_recent("tenant-a")), 1)

        with patch.object(TelemetryAlertBus, "_notify_ws_cleared"):
            cleared = TelemetryAlertBus.clear_alert(aid, tenant_id="tenant-a", notify=False)

        self.assertEqual(cleared["id"], aid)
        self.assertTrue(cleared.get("cleared_at"))
        self.assertEqual(TelemetryAlertBus.list_recent("tenant-a"), [])
        self.assertIn(aid, TelemetryAlertBus._cleared_ids)

    def test_cleared_id_not_reingested(self):
        TelemetryAlertBus._cleared_ids.add("sos-1")
        again = TelemetryAlertBus.ingest_redis_alert(
            {
                "id": "sos-1",
                "alert_type": "SOS",
                "tenant_id": "tenant-a",
                "message": "revive",
                "metadata": {"lat": 1, "lng": 2},
            }
        )
        self.assertIsNone(again)
        self.assertEqual(TelemetryAlertBus.list_recent("tenant-a"), [])


if __name__ == "__main__":
    unittest.main()
