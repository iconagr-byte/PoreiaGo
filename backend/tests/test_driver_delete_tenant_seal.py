"""Delete driver must never wipe another office's row (PoreiaGo ↔ Achillio)."""

from __future__ import annotations

import tempfile
import time
import unittest
from pathlib import Path
from uuid import uuid4

from travel_platform.settings import drivers_store as store

OFFICE_POREIAGO = "11111111-1111-4111-8111-111111111111"
OFFICE_ACHILLIO = "22222222-2222-4222-8222-222222222222"


class DriverDeleteTenantSealTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.store_path = Path(self._tmpdir.name) / "fleet_drivers.json"
        store.STORE_PATH = self.store_path
        store._DATA_DIR = Path(self._tmpdir.name)
        self.store_path.write_text('{"drivers": []}', encoding="utf-8")
        store.reset_drivers_cache()
        stamp = str(int(time.time() * 1000))[-6:]
        self.poreiago = store.create_driver(
            {
                "name": "PoreiaGo Test",
                "license_no": f"LICP{stamp}",
                "email": f"pg.{stamp}@example.com",
                "password": "BusPass99",
                "status": "active",
                "tenant_id": OFFICE_POREIAGO,
            }
        )
        self.achillio = store.create_driver(
            {
                "name": "Achillio Real",
                "license_no": f"LICA{stamp}",
                "email": f"ach.{stamp}@example.com",
                "password": "BusPass99",
                "status": "active",
                "tenant_id": OFFICE_ACHILLIO,
            }
        )

    def tearDown(self):
        store.reset_drivers_cache()
        self._tmpdir.cleanup()

    def test_delete_requires_matching_tenant(self):
        with self.assertRaises(KeyError):
            store.delete_driver(self.achillio.id, tenant_id=OFFICE_POREIAGO)
        store.reset_drivers_cache()
        self.assertIsNotNone(store.get_driver(self.achillio.id))
        self.assertEqual(store.get_driver(self.achillio.id).tenant_id, OFFICE_ACHILLIO)

    def test_delete_own_office_ok(self):
        store.delete_driver(self.poreiago.id, tenant_id=OFFICE_POREIAGO)
        store.reset_drivers_cache()
        self.assertIsNone(store.get_driver(self.poreiago.id))
        self.assertIsNotNone(store.get_driver(self.achillio.id))

    def test_rehome_does_not_steal_real_office(self):
        result = store.rehome_driver_to_tenant(
            self.achillio.email,
            OFFICE_POREIAGO,
            only_from_demo=True,
        )
        self.assertEqual(result.get("moved"), 0)
        self.assertGreaterEqual(result.get("skipped_real", 0), 1)
        store.reset_drivers_cache()
        again = store.get_driver(self.achillio.id)
        self.assertEqual(again.tenant_id, OFFICE_ACHILLIO)


if __name__ == "__main__":
    unittest.main()
