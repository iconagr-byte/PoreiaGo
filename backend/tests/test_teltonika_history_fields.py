"""Teltonika GPS fields must flow into history payload."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

from travel_platform.telemetry.teltonika.codec8 import GpsFix, fix_to_telemetry_fields


class TeltonikaHistoryFieldsTests(unittest.TestCase):
    def test_fix_fields_include_altitude_satellites_io(self):
        fix = GpsFix(
            latitude=40.5,
            longitude=22.9,
            altitude_m=120,
            angle_deg=90,
            satellites=12,
            speed_kmh=48.0,
            recorded_at=datetime(2026, 9, 29, 10, 0, tzinfo=timezone.utc),
            priority=0,
            event_io_id=239,
            io={239: 1, 66: 12500},
        )
        fields = fix_to_telemetry_fields(fix)
        self.assertEqual(fields["altitude_m"], 120)
        self.assertEqual(fields["satellites"], 12)
        self.assertEqual(fields["heading_deg"], 90.0)
        self.assertEqual(fields["engine_status"], "on")
        self.assertIn("239", fields["io"])


if __name__ == "__main__":
    unittest.main()
