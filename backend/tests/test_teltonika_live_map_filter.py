"""Teltonika-bound vehicles must appear on the live map without a driver_id."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from travel_platform.telemetry import office_fleet_filter as filt
from travel_platform.telemetry.teltonika import device_store as ds


class TeltonikaLiveMapFilterTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        path = Path(self.tmp.name) / "devices.json"
        self.patcher = patch.object(ds, "_store_path", return_value=path)
        self.patcher.start()
        self.tenant = "97798681-2f60-4398-b1f6-9eb38dc341b0"
        ds.upsert_device(
            {
                "imei": "861076085468260",
                "vehicle_code": "EEX5670",
                "label": "Λεωφορείο με GPS",
                "enabled": True,
            },
            tenant_id=self.tenant,
        )

    def tearDown(self):
        self.patcher.stop()
        self.tmp.cleanup()

    def test_hides_orphan_without_driver_or_tracker(self):
        self.assertFalse(filt.office_allows_live_driver(self.tenant, None, {"vehicle_code": "GHOST"}))

    def test_allows_bound_plate_without_driver(self):
        self.assertTrue(
            filt.office_allows_live_driver(
                self.tenant,
                None,
                {"vehicle_code": "EEX5670", "bus_plate": "EEX5670", "source": "teltonika"},
            )
        )

    def test_allows_bound_imei_without_driver(self):
        self.assertTrue(
            filt.office_allows_tracker_pin(
                self.tenant,
                {"imei": "861076085468260", "vehicle_code": "EEX5670", "source": "teltonika"},
            )
        )

    def test_rejects_other_office_plate(self):
        self.assertFalse(
            filt.office_allows_tracker_pin(
                "11111111-1111-1111-1111-111111111111",
                {"vehicle_code": "EEX5670", "source": "teltonika"},
            )
        )

    def test_hides_phone_gps_on_teltonika_bound_plate(self):
        """Driver smartphone must never paint a Teltonika-bound bus pin."""
        self.assertFalse(
            filt.office_allows_tracker_pin(
                self.tenant,
                {
                    "vehicle_code": "EEX5670",
                    "bus_plate": "EEX5670",
                    "source": "driver_pwa",
                    "driver_id": "drv-phone",
                },
            )
        )
        self.assertFalse(
            filt.office_allows_live_driver(
                self.tenant,
                "drv-phone",
                {
                    "vehicle_code": "EEX5670",
                    "bus_plate": "EEX5670",
                    "source": "driver_pwa",
                    "driver_id": "drv-phone",
                },
            )
        )

    def test_plate_has_enabled_tracker(self):
        self.assertTrue(filt.office_plate_has_enabled_tracker(self.tenant, "EEX5670"))
        self.assertFalse(filt.office_plate_has_enabled_tracker(self.tenant, "NOPE"))


if __name__ == "__main__":
    unittest.main()
