"""Office driver lists are exact-tenant only (no DEMO claim)."""

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

    def _create(self, *, name: str, email: str, tenant_id: str, **extra):
        payload = {
            "id": str(uuid4()),
            "name": name,
            "license_no": f"LIC-{uuid4().hex[:8]}",
            "email": email,
            "phone": "+306900000000",
            "password": "BusPass99",
            "status": "active",
            "tenant_id": tenant_id,
        }
        payload.update(extra)
        return store.create_driver(payload)

    def test_demo_orphan_not_listed_or_claimed(self):
        orphan = self._create(
            name="Achilleas Charalambidis",
            email="axilleas0@yahoo.gr",
            tenant_id=store.DEMO_TENANT_ID,
            _allow_demo_tenant=True,
        )
        listed = store.list_drivers_for_office(
            OFFICE,
            include_demo_legacy=True,
            claim_demo_legacy=True,
        )
        self.assertEqual(listed, [])
        store.reset_drivers_cache()
        again = store.get_driver(orphan.id)
        self.assertEqual(again.tenant_id, store.DEMO_TENANT_ID)

    def test_office_sees_only_own_drivers(self):
        mine = self._create(name="Mine", email="mine@example.com", tenant_id=OFFICE)
        self._create(name="Other", email="other@example.com", tenant_id=OTHER)
        listed = store.list_drivers_for_office(OFFICE)
        self.assertEqual([d.id for d in listed], [mine.id])

    def test_driver_visible_to_office_exact_only(self):
        orphan = self._create(
            name="Achilleas",
            email="a@example.com",
            tenant_id=store.DEMO_TENANT_ID,
            _allow_demo_tenant=True,
        )
        self.assertFalse(store.driver_visible_to_office(orphan, OFFICE))
        self.assertFalse(
            store.driver_visible_to_office(orphan, OFFICE, allow_demo_legacy=True)
        )


if __name__ == "__main__":
    unittest.main()
