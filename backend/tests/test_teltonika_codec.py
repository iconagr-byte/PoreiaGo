"""Teltonika Codec 8 parser + device store tests."""

from __future__ import annotations

import struct
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from travel_platform.telemetry.teltonika import codec8, device_store as ds


class Codec8Tests(unittest.TestCase):
    def test_imei_login_roundtrip(self):
        imei = "860123456789012"
        packet = struct.pack(">H", len(imei)) + imei.encode("ascii")
        parsed, n = codec8.parse_imei_login(packet)
        self.assertEqual(parsed, imei)
        self.assertEqual(n, len(packet))

    def test_build_and_parse_avl(self):
        pkt = codec8.build_minimal_codec8_packet(
            latitude=38.24664,
            longitude=21.73457,
            speed_kmh=42,
            ts=datetime(2026, 9, 21, 12, 0, tzinfo=timezone.utc),
            ignition=1,
            io_extra={253: 2},  # harsh brake
        )
        records, consumed, ack = codec8.parse_avl_packet(pkt)
        self.assertEqual(consumed, len(pkt))
        self.assertEqual(struct.unpack(">I", ack)[0], 1)
        self.assertEqual(len(records), 1)
        fix = records[0]
        self.assertAlmostEqual(fix.latitude, 38.24664, places=5)
        self.assertAlmostEqual(fix.longitude, 21.73457, places=5)
        self.assertEqual(fix.speed_kmh, 42)
        self.assertEqual(fix.engine_status(), "on")
        self.assertEqual(fix.tracker_event_id(), 101)

    def test_incomplete_packet(self):
        pkt = codec8.build_minimal_codec8_packet(latitude=38.0, longitude=22.0)
        records, consumed, ack = codec8.parse_avl_packet(pkt[:10])
        self.assertIsNone(records)
        self.assertEqual(consumed, 0)
        self.assertIsNone(ack)


class DeviceStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        path = Path(self.tmp.name) / "devices.json"
        self.patcher = patch.object(ds, "_store_path", return_value=path)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.tmp.cleanup()

    def test_upsert_and_lookup(self):
        row = ds.upsert_device(
            {"imei": "860123456789012", "vehicle_code": "TEST-1", "label": "Bus"},
            tenant_id="11111111-1111-1111-1111-111111111111",
        )
        self.assertEqual(row["vehicle_code"], "TEST-1")
        found = ds.get_device_by_imei("860123456789012")
        self.assertIsNotNone(found)
        self.assertEqual(found["id"], row["id"])
        listed = ds.list_devices("11111111-1111-1111-1111-111111111111")
        self.assertEqual(len(listed), 1)

    def test_rejects_bad_imei(self):
        with self.assertRaises(ValueError):
            ds.upsert_device({"imei": "123", "vehicle_code": "X"}, tenant_id="t1")


if __name__ == "__main__":
    unittest.main()
