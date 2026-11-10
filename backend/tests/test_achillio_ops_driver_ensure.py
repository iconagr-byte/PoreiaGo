"""Achillio ops driver (axdafnis) must live on Achillio Travel with working password."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

from travel_platform.settings import drivers_store as store

OFFICE_POREIAGO = "11111111-1111-4111-8111-111111111111"
OFFICE_ACHILLIO = "22222222-2222-4222-8222-222222222222"
OPS_EMAIL = "axdafnis@gmail.com"
OPS_PASSWORD = "Mpouri@1234"


class AchillioOpsDriverEnsureTests(unittest.TestCase):
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

    def test_ensure_creates_on_achillio_with_password(self):
        result = store.ensure_home_driver_on_tenant(OPS_EMAIL, OFFICE_ACHILLIO)
        self.assertTrue(result["ok"])
        self.assertEqual(result["action"], "created")
        rows = store.find_drivers_by_email(OPS_EMAIL)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].tenant_id, OFFICE_ACHILLIO)
        authed = store.authenticate_driver(
            OPS_EMAIL, OPS_PASSWORD, tenant_id=OFFICE_ACHILLIO
        )
        self.assertIsNotNone(authed)

    def test_ensure_resets_password_and_rehomes_from_poreiago(self):
        stranded = store.create_driver(
            {
                "name": "Old",
                "license_no": f"LIC-{uuid4().hex[:8]}",
                "email": OPS_EMAIL,
                "password": "WrongOld99",
                "status": "active",
                "tenant_id": OFFICE_POREIAGO,
            }
        )
        result = store.ensure_home_driver_on_tenant(OPS_EMAIL, OFFICE_ACHILLIO)
        self.assertTrue(result["ok"])
        self.assertTrue(result.get("password_reset"))
        store.reset_drivers_cache()
        again = store.get_driver(stranded.id)
        self.assertEqual(again.tenant_id, OFFICE_ACHILLIO)
        self.assertIsNotNone(
            store.authenticate_driver(
                OPS_EMAIL, OPS_PASSWORD, tenant_id=OFFICE_ACHILLIO
            )
        )
        self.assertIsNone(
            store.authenticate_driver(
                OPS_EMAIL, "WrongOld99", tenant_id=OFFICE_ACHILLIO
            )
        )
