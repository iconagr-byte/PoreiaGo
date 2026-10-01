"""Force live-map pin from Teltonika device binding."""

from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from travel_platform.telemetry.teltonika import device_store as ds
from travel_platform.telemetry.teltonika.paint_live import paint_live_pin_from_device


class TeltonikaPaintLiveTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        path = Path(self.tmp.name) / "devices.json"
        self.patcher = patch.object(ds, "_store_path", return_value=path)
        self.patcher.start()
        self.tenant = "97798681-2f60-4398-b1f6-9eb38dc341b0"
        self.device = ds.upsert_device(
            {
                "imei": "861076085468260",
                "vehicle_code": "EEX5670",
                "label": "Λεωφορείο με GPS",
                "enabled": True,
            },
            tenant_id=self.tenant,
        )
        ds.touch_device("861076085468260", lat=40.8, lng=22.05, speed_kmh=0, points=1)
        self.device = ds.get_device_by_imei("861076085468260")

    def tearDown(self):
        self.patcher.stop()
        self.tmp.cleanup()

    def test_paints_open_pin_from_last_fix(self):
        with patch(
            "travel_platform.telemetry.teltonika.paint_live.process_telemetry_payload",
            new_callable=AsyncMock,
        ) as process:
            ok = asyncio.run(
                paint_live_pin_from_device(
                    self.device, open_channel=True, reason="imei_accept"
                )
            )
        self.assertTrue(ok)
        process.assert_awaited()
        payload = process.await_args.args[0]
        self.assertEqual(payload["source"], "teltonika")
        self.assertFalse(payload.get("hydrated_from_store"))
        self.assertEqual(payload["vehicle_code"], "EEX5670")
        self.assertAlmostEqual(float(payload["latitude"]), 40.8, places=4)

    def test_skips_without_coordinates(self):
        bare = {**self.device, "last_lat": None, "last_lng": None}
        with patch(
            "travel_platform.telemetry.teltonika.paint_live.process_telemetry_payload",
            new_callable=AsyncMock,
        ) as process:
            ok = asyncio.run(paint_live_pin_from_device(bare, open_channel=True))
        self.assertFalse(ok)
        process.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
