"""Teltonika pin must expose soft-ack app_driver_id for office chat."""

from __future__ import annotations

import unittest

from schemas.telemetry import LiveVehicleResponse


class TeltonikaChatDriverIdTests(unittest.TestCase):
    def test_live_vehicle_response_accepts_app_driver_id(self):
        row = LiveVehicleResponse(
            vehicle_id="veh-1",
            vehicle_code="EEX5670",
            trip_id=None,
            lat=40.8,
            lng=22.05,
            speed_kmh=0,
            engine_on=True,
            fuel_level_pct=None,
            idle_seconds_trip=0,
            updated_at="2026-10-01T08:00:00+00:00",
            driver_id="drv-achilleas",
            app_driver_id="drv-achilleas",
            source="teltonika",
            gps_sources=["teltonika", "app"],
            app_seen_at="2026-10-01T08:00:00+00:00",
        )
        self.assertEqual(row.driver_id, "drv-achilleas")
        self.assertEqual(row.app_driver_id, "drv-achilleas")
        self.assertIn("teltonika", row.gps_sources)
        self.assertIn("app", row.gps_sources)


if __name__ == "__main__":
    unittest.main()
