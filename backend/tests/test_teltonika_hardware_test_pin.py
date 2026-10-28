"""Δοκιμαστικό pin must prefer Codec/hardware fix, not browser geolocation."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("AUTH_JWT_SECRET", "test-teltonika-hw-pin-jwt-secret-32chars!")


class HardwareLastFixTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store_path = Path(self.tmp.name) / "teltonika_devices.json"
        self._prev = os.environ.get("TELTONIKA_DEVICES_STORE")
        os.environ["TELTONIKA_DEVICES_STORE"] = str(self.store_path)

    def tearDown(self):
        if self._prev is None:
            os.environ.pop("TELTONIKA_DEVICES_STORE", None)
        else:
            os.environ["TELTONIKA_DEVICES_STORE"] = self._prev
        self.tmp.cleanup()

    def test_browser_touch_does_not_overwrite_store_coords(self):
        from travel_platform.telemetry.teltonika.device_store import (
            get_device_by_imei,
            hardware_last_fix,
            touch_device,
            upsert_device,
        )

        upsert_device(
            {
                "imei": "861076085468260",
                "vehicle_code": "EEX5670",
                "label": "Λεωφορείο με GPS",
                "enabled": True,
            },
            tenant_id="office-a",
        )
        touch_device(
            "861076085468260",
            lat=40.80894,
            lng=22.85134,
            speed_kmh=0,
            points=1,
            from_hardware=True,
        )
        # Browser «Η θέση μου» must not write lat/lng into the device store.
        touch_device(
            "861076085468260",
            lat=37.98381,
            lng=23.72754,
            speed_kmh=0,
            points=1,
            from_hardware=False,
        )
        device = get_device_by_imei("861076085468260")
        self.assertIsNotNone(device)
        self.assertEqual(float(device["last_lat"]), 40.80894)
        self.assertEqual(float(device["last_hw_lat"]), 40.80894)
        self.assertEqual(hardware_last_fix(device), (40.80894, 22.85134))

    def test_rejects_polluted_last_lat_without_codec_source(self):
        from travel_platform.telemetry.teltonika.device_store import hardware_last_fix

        self.assertIsNone(
            hardware_last_fix(
                {"last_lat": 37.9, "last_lng": 23.7, "last_fix_source": None}
            )
        )
        self.assertIsNone(
            hardware_last_fix(
                {
                    "last_lat": 37.9,
                    "last_lng": 23.7,
                    "last_fix_source": "manual",
                }
            )
        )
        self.assertEqual(
            hardware_last_fix(
                {
                    "last_lat": 40.8,
                    "last_lng": 22.8,
                    "last_fix_source": "teltonika",
                }
            ),
            (40.8, 22.8),
        )

    def test_resolve_falls_back_to_live_fleet_teltonika(self):
        from travel_platform.telemetry.teltonika.device_store import (
            resolve_hardware_fix,
            upsert_device,
        )

        device = upsert_device(
            {
                "imei": "861076085468260",
                "vehicle_code": "EEX5670",
                "label": "Λεωφορείο με GPS",
                "enabled": True,
            },
            tenant_id="office-a",
        )
        fleet = MagicMock()
        fleet._vehicles = {
            "v1": {
                "tenant_id": "office-a",
                "vehicle_code": "EEX5670",
                "bus_plate": "EEX5670",
                "imei": "861076085468260",
                "source": "teltonika",
                "lat": 40.80111,
                "lng": 22.85001,
            }
        }
        with patch(
            "travel_platform.telemetry.processor.get_live_fleet",
            return_value=fleet,
        ):
            resolved = resolve_hardware_fix(device, tenant_id="office-a")
        self.assertEqual(resolved, (40.80111, 22.85001, "live_fleet"))


if __name__ == "__main__":
    unittest.main()
