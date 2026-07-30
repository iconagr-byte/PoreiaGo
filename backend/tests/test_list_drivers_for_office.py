"""Legacy DEMO drivers must reappear on the live office list."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

from travel_platform.settings import drivers_store as store

OFFICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


class ListDriversForOfficeTests(unittest.TestCase):
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

    def _create(self, *, name: str, email: str, tenant_id: str, driver_id: str | None = None):
        row = store.create_driver(
            {
                "id": driver_id or str(uuid4()),
                "name": name,
                "license_no": f"LIC-{uuid4().hex[:8]}",
                "email": email,
                "phone": "+306900000000",
                "password": "BusPass99",
                "status": "active",
                "tenant_id": tenant_id,
            }
        )
        return row

    def test_office_sees_and_claims_non_seed_demo_driver(self):
        orphan = self._create(
            name="Achilleas Charalambidis",
            email="axilleas0@yahoo.gr",
            tenant_id=store.DEMO_TENANT_ID,
        )
        self.assertEqual(orphan.tenant_id, store.DEMO_TENANT_ID)

        strict = store.list_drivers(tenant_id=OFFICE)
        self.assertEqual(strict, [])

        listed = store.list_drivers_for_office(
            OFFICE,
            include_demo_legacy=True,
            claim_demo_legacy=True,
        )
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0].id, orphan.id)
        self.assertEqual(listed[0].tenant_id, OFFICE)

        store.reset_drivers_cache()
        again = store.list_drivers(tenant_id=OFFICE)
        self.assertEqual([d.id for d in again], [orphan.id])

    def _inject_seed(self):
        seed_id = next(iter(store.SEED_DRIVER_IDS))
        drivers = store._ensure()
        drivers[seed_id] = store.FleetDriver(
            id=seed_id,
            name="Νίκος Παπαδόπουλος",
            license_no="AB123456",
            phone="+30 694 111 0001",
            email="nikos.driver@aerostride.com",
            hiring_date=store.date(2022, 3, 15),
            status="active",
            tenant_id=store.DEMO_TENANT_ID,
            password_hash="x",
        )
        store._persist()
        return seed_id

    def test_seed_demo_drivers_not_claimed(self):
        seed_id = self._inject_seed()
        listed = store.list_drivers_for_office(
            OFFICE,
            include_demo_legacy=True,
            claim_demo_legacy=True,
        )
        self.assertEqual(listed, [])
        store.reset_drivers_cache()
        self.assertEqual(store.get_driver(seed_id).tenant_id, store.DEMO_TENANT_ID)

    def test_other_office_without_legacy_flag_stays_empty(self):
        self._create(
            name="Achilleas Charalambidis",
            email="axilleas0@yahoo.gr",
            tenant_id=store.DEMO_TENANT_ID,
        )
        listed = store.list_drivers_for_office(
            OTHER,
            include_demo_legacy=False,
            claim_demo_legacy=False,
        )
        self.assertEqual(listed, [])

    def test_driver_visible_to_office(self):
        orphan = self._create(
            name="Achilleas",
            email="a@example.com",
            tenant_id=store.DEMO_TENANT_ID,
        )
        self.assertTrue(store.driver_visible_to_office(orphan, OFFICE))
        seed_id = self._inject_seed()
        seed = store.get_driver(seed_id)
        self.assertFalse(store.driver_visible_to_office(seed, OFFICE))


if __name__ == "__main__":
    unittest.main()
