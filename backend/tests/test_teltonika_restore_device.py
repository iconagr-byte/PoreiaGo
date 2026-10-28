"""Empty Achillio Teltonika list must restore the known EEX5670 IMEI."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("AUTH_JWT_SECRET", "test-teltonika-restore-jwt-secret-32chars!")


class RestoreDefaultTrackerTests(unittest.TestCase):
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

    def test_seeds_when_office_empty(self):
        from travel_platform.telemetry.teltonika.device_store import (
            ensure_office_default_trackers,
            list_devices,
        )

        rows = ensure_office_default_trackers("office-achillio")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["imei"], "861076085468260")
        self.assertEqual(rows[0]["vehicle_code"], "EEX5670")
        self.assertEqual(rows[0]["tenant_id"], "office-achillio")
        self.assertEqual(len(list_devices("office-achillio")), 1)

    def test_rebinds_from_wrong_tenant(self):
        from travel_platform.telemetry.teltonika.device_store import (
            ensure_office_default_trackers,
            list_devices,
            upsert_device,
        )

        upsert_device(
            {
                "imei": "861076085468260",
                "vehicle_code": "EEX5670",
                "label": "Λεωφορείο με GPS",
                "enabled": True,
            },
            tenant_id="platform-wrong",
        )
        self.assertEqual(len(list_devices("office-achillio")), 0)
        rows = ensure_office_default_trackers("office-achillio")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["tenant_id"], "office-achillio")
        self.assertEqual(len(list_devices("platform-wrong")), 0)

    def test_does_not_clobber_existing_office_fleet(self):
        from travel_platform.telemetry.teltonika.device_store import (
            ensure_office_default_trackers,
            list_devices,
            upsert_device,
        )

        upsert_device(
            {
                "imei": "999999999999999",
                "vehicle_code": "OTHER1",
                "label": "Other",
                "enabled": True,
            },
            tenant_id="office-achillio",
        )
        rows = ensure_office_default_trackers("office-achillio")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["vehicle_code"], "OTHER1")
        self.assertEqual(len(list_devices("office-achillio")), 1)


if __name__ == "__main__":
    unittest.main()
