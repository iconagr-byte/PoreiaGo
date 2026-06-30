"""Fleet KPIs — alert counting."""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from travel_platform.telemetry.alerts import TelemetryAlertBus
from travel_platform.telemetry.fleet_kpis_service import count_alerts_since


class FleetKpisTests(unittest.TestCase):
    def setUp(self):
        TelemetryAlertBus._recent.clear()

    def test_count_alerts_since_filters_by_time(self):
        now = datetime.now(timezone.utc)
        TelemetryAlertBus.push_driver_shift(
            alert_type="DRIVER_ONLINE",
            tenant_id="t1",
            message="online",
            metadata={"trip_id": 1},
        )
        counts = count_alerts_since("t1", from_time=now - timedelta(hours=1))
        self.assertEqual(counts["total"], 1)
        self.assertEqual(counts["by_type"]["DRIVER_ONLINE"], 1)

    def test_count_alerts_ignores_old(self):
        now = datetime.now(timezone.utc)
        TelemetryAlertBus._recent.appendleft(
            {
                "id": "old",
                "alert_type": "ROUTE_DEVIATION",
                "tenant_id": "t1",
                "created_at": (now - timedelta(days=10)).isoformat(),
            },
        )
        counts = count_alerts_since("t1", from_time=now - timedelta(days=1))
        self.assertEqual(counts["total"], 0)


if __name__ == "__main__":
    unittest.main()
