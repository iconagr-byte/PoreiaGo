"""Achilleas home email must stay on Achillio — force rehome + recreate if missing."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

from travel_platform.settings import drivers_store as store

OFFICE_POREIAGO = "11111111-1111-4111-8111-111111111111"
OFFICE_ACHILLIO = "22222222-2222-4222-8222-222222222222"
HOME_EMAIL = "axilleas0@yahoo.gr"


class AchilleasHomeEnsureTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.store_path = Path(self._tmpdir.name) / "fleet_drivers.json"
        store.STORE_PATH = self.store_path
        store._DATA_DIR = Path(self._tmpdir.name)
        self.store_path.write_text('{"drivers": []}', encoding="utf-8")
        store.reset_drivers_cache()

    def tearDown(self):
        store.reset_drivers_cache()
        self._tmpdir.cleanup()

    def test_ensure_creates_when_missing(self):
        result = store.ensure_home_driver_on_tenant(HOME_EMAIL, OFFICE_ACHILLIO)
        self.assertTrue(result["ok"])
        self.assertEqual(result["action"], "created")
        rows = store.find_drivers_by_email(HOME_EMAIL)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].tenant_id, OFFICE_ACHILLIO)
        self.assertEqual(rows[0].name, "Αχιλλέας Χαραλαμπίδης")
        listed = store.list_drivers_for_office(OFFICE_ACHILLIO)
        self.assertEqual([d.email for d in listed], [HOME_EMAIL])

    def test_ensure_pulls_back_from_poreiago(self):
        stranded = store.create_driver(
            {
                "name": "Αχιλλέας Χαραλαμπίδης",
                "license_no": f"LIC-{uuid4().hex[:8]}",
                "email": HOME_EMAIL,
                "password": "BusPass99",
                "status": "active",
                "tenant_id": OFFICE_POREIAGO,
            }
        )
        result = store.ensure_home_driver_on_tenant(HOME_EMAIL, OFFICE_ACHILLIO)
        self.assertTrue(result["ok"])
        self.assertEqual(result["action"], "rehomed")
        store.reset_drivers_cache()
        again = store.get_driver(stranded.id)
        self.assertEqual(again.tenant_id, OFFICE_ACHILLIO)
        self.assertEqual(store.list_drivers_for_office(OFFICE_POREIAGO), [])
        self.assertEqual(
            [d.id for d in store.list_drivers_for_office(OFFICE_ACHILLIO)],
            [stranded.id],
        )

    def test_default_rehome_still_refuses_unrelated_office_steal(self):
        other = store.create_driver(
            {
                "name": "Other",
                "license_no": f"LIC-{uuid4().hex[:8]}",
                "email": "other.driver@example.com",
                "password": "BusPass99",
                "status": "active",
                "tenant_id": OFFICE_ACHILLIO,
            }
        )
        result = store.rehome_driver_to_tenant(
            other.email,
            OFFICE_POREIAGO,
            only_from_demo=True,
        )
        self.assertEqual(result.get("moved"), 0)
        store.reset_drivers_cache()
        self.assertEqual(store.get_driver(other.id).tenant_id, OFFICE_ACHILLIO)


if __name__ == "__main__":
    unittest.main()
