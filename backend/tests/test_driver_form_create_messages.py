"""Driver create uniqueness messages stay actionable for admins."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from travel_platform.settings import drivers_store as store

OFFICE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
OFFICE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


class DriverCreateMessageTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.store_path = Path(self._tmpdir.name) / "fleet_drivers.json"
        self.env = {
            "POREIAGO_DATA_DIR": self._tmpdir.name,
            "FLEET_DRIVERS_STORE": str(self.store_path),
            "ENVIRONMENT": "test",
        }
        self._patch = patch.dict("os.environ", self.env, clear=False)
        self._patch.start()
        store.STORE_PATH = self.store_path
        store._DATA_DIR = Path(self._tmpdir.name)
        self.store_path.write_text('{"drivers": []}', encoding="utf-8")
        store.reset_drivers_cache()

    def tearDown(self):
        store.reset_drivers_cache()
        self._patch.stop()
        self._tmpdir.cleanup()

    def _create(self, *, email: str, tenant_id: str, license_no: str | None = None):
        return store.create_driver(
            {
                "name": "Test Driver",
                "license_no": license_no or f"LIC-{uuid4().hex[:8]}",
                "email": email,
                "password": "BusPass99",
                "status": "active",
                "tenant_id": tenant_id,
            }
        )

    def test_duplicate_email_message_mentions_other_office(self):
        self._create(email="shared@example.com", tenant_id=OFFICE_A)
        with self.assertRaises(ValueError) as ctx:
            self._create(email="shared@example.com", tenant_id=OFFICE_B)
        msg = str(ctx.exception)
        self.assertIn("άλλο γραφείο", msg)
        self.assertIn("άλλο email", msg)


if __name__ == "__main__":
    unittest.main()
