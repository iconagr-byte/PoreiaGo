"""SEAL: two offices must never share / steal the same driver."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

from travel_platform.settings import drivers_store as store

OFFICE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
OFFICE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


class DriverOfficeSealTests(unittest.TestCase):
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

    def _create(self, *, email: str, tenant_id: str, license_no: str | None = None):
        return store.create_driver(
            {
                "name": "Οδηγός",
                "license_no": license_no or f"LIC-{uuid4().hex[:8]}",
                "email": email,
                "password": "BusPass99",
                "status": "active",
                "tenant_id": tenant_id,
            }
        )

    def test_global_email_unique_across_offices(self):
        self._create(email="shared@example.com", tenant_id=OFFICE_A)
        with self.assertRaises(ValueError) as ctx:
            self._create(email="shared@example.com", tenant_id=OFFICE_B)
        self.assertIn("άλλου γραφείου", str(ctx.exception))

    def test_list_never_claims_demo_orphans(self):
        orphan = store.create_driver(
            {
                "name": "Orphan",
                "license_no": f"LIC-{uuid4().hex[:8]}",
                "email": "orphan@example.com",
                "password": "BusPass99",
                "status": "active",
                "tenant_id": store.DEMO_TENANT_ID,
                "_allow_demo_tenant": True,
            }
        )
        listed = store.list_drivers_for_office(
            OFFICE_A,
            include_demo_legacy=True,
            claim_demo_legacy=True,
        )
        self.assertEqual(listed, [])
        store.reset_drivers_cache()
        again = store.get_driver(orphan.id)
        self.assertIsNotNone(again)
        self.assertEqual(again.tenant_id, store.DEMO_TENANT_ID)

    def test_seal_removes_demo_duplicates_only(self):
        a = self._create(email="dup@example.com", tenant_id=OFFICE_A)
        drivers = store._ensure()
        demo_id = str(uuid4())
        drivers[demo_id] = store.FleetDriver(
            id=demo_id,
            name="DemoClone",
            license_no=f"LIC-{uuid4().hex[:8]}",
            phone="",
            email="dup@example.com",
            hiring_date=a.hiring_date,
            status="active",
            password_hash=a.password_hash,
            tenant_id=store.DEMO_TENANT_ID,
        )
        other_id = str(uuid4())
        drivers[other_id] = store.FleetDriver(
            id=other_id,
            name="OtherOffice",
            license_no=f"LIC-{uuid4().hex[:8]}",
            phone="",
            email="dup@example.com",
            hiring_date=a.hiring_date,
            status="active",
            password_hash=a.password_hash,
            tenant_id=OFFICE_B,
        )
        store._persist()
        store.reset_drivers_cache()

        result = store.seal_cross_office_driver_uniqueness()
        self.assertEqual(result["removed"], 1)
        self.assertGreaterEqual(result["skipped_real_conflicts"], 1)
        store.reset_drivers_cache()
        survivors = [d for d in store.list_drivers() if d.email == "dup@example.com"]
        self.assertEqual(len(survivors), 2)
        self.assertTrue(all(d.tenant_id != store.DEMO_TENANT_ID for d in survivors))

    def test_cannot_move_driver_between_offices(self):
        row = self._create(email="move@example.com", tenant_id=OFFICE_A)
        with self.assertRaises(ValueError):
            store.update_driver(row.id, {"tenant_id": OFFICE_B})

    def test_demo_create_blocked_without_flag(self):
        import os
        from unittest.mock import patch

        with patch.dict(os.environ, {"ENVIRONMENT": "production"}, clear=False):
            with self.assertRaises(ValueError):
                store.create_driver(
                    {
                        "name": "Demo",
                        "license_no": f"LIC-{uuid4().hex[:8]}",
                        "email": "demo.block@example.com",
                        "password": "BusPass99",
                        "status": "active",
                        "tenant_id": store.DEMO_TENANT_ID,
                    }
                )

    def test_rehome_moves_driver_to_achillio(self):
        row = self._create(email="axilleas0@yahoo.gr", tenant_id=OFFICE_A)
        result = store.rehome_driver_to_tenant("axilleas0@yahoo.gr", OFFICE_B)
        self.assertTrue(result["ok"])
        self.assertEqual(result["moved"], 1)
        store.reset_drivers_cache()
        again = store.get_driver(row.id)
        self.assertEqual(again.tenant_id, OFFICE_B)


if __name__ == "__main__":
    unittest.main()
