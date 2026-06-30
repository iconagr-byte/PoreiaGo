"""Stale driver GPS heartbeat tests."""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from travel_platform.telemetry.driver_gps_heartbeat import (
    clear_driver_gps,
    collect_stale_sessions,
    touch_driver_gps,
)


def _session():
    return {
        "tenant_id": "00000000-0000-0000-0000-000000000001",
        "sub": "driver-1",
        "trip_id": 1,
    }


class DriverGpsHeartbeatTests(unittest.TestCase):
    def setUp(self):
        clear_driver_gps(_session())

    def tearDown(self):
        clear_driver_gps(_session())

    def test_touch_and_not_stale(self):
        touch_driver_gps(_session(), recorded_at=datetime.now(timezone.utc))
        stale = collect_stale_sessions(stale_seconds=90)
        self.assertEqual(stale, [])

    def test_collect_stale_after_timeout(self):
        old = datetime.now(timezone.utc) - timedelta(seconds=120)
        touch_driver_gps(_session(), recorded_at=old)
        stale = collect_stale_sessions(stale_seconds=90)
        self.assertEqual(len(stale), 1)
        self.assertEqual(stale[0]["trip_id"], 1)
        again = collect_stale_sessions(stale_seconds=90)
        self.assertEqual(again, [])

    def test_resume_clears_stale_flag(self):
        old = datetime.now(timezone.utc) - timedelta(seconds=120)
        touch_driver_gps(_session(), recorded_at=old)
        collect_stale_sessions(stale_seconds=90)
        was_stale = touch_driver_gps(_session(), recorded_at=datetime.now(timezone.utc))
        self.assertTrue(was_stale)
        stale = collect_stale_sessions(stale_seconds=90)
        self.assertEqual(stale, [])


if __name__ == "__main__":
    unittest.main()
