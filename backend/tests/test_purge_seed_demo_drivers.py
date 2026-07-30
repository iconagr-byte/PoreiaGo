"""Seed demo drivers must be purged and never paint the live map."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

from travel_platform.settings import drivers_store as store
from travel_platform.telemetry.office_fleet_filter import office_allows_live_driver

OFFICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


class PurgeSeedDemoDriversTests(unittest.TestCase):
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

    def test_purge_removes_seed_rows(self):
        seed_id = self._inject_seed()
        self.assertIsNotNone(store.get_driver(seed_id))
        n = store.purge_seed_demo_drivers()
        self.assertEqual(n, 1)
        store.reset_drivers_cache()
        self.assertIsNone(store.get_driver(seed_id))

    def test_seed_cannot_authenticate(self):
        self._inject_seed()
        self.assertIsNone(
            store.authenticate_driver("nikos.driver@aerostride.com", "driver123")
        )

    def test_missing_file_does_not_reseed_demos(self):
        self.store_path.unlink(missing_ok=True)
        store.reset_drivers_cache()
        rows = store.list_drivers()
        self.assertEqual(rows, [])
        self.assertTrue(self.store_path.exists())

    def test_live_map_hides_orphan_and_seed(self):
        seed_id = self._inject_seed()
        self.assertFalse(office_allows_live_driver(OFFICE, seed_id))

        real = store.create_driver(
            {
                "id": str(uuid4()),
                "name": "Achilleas",
                "license_no": "LIC-1",
                "email": "a@example.com",
                "phone": "+306900000000",
                "password": "BusPass99",
                "status": "active",
                "tenant_id": store.DEMO_TENANT_ID,
            }
        )
        # Still on DEMO — not on office list → no pin.
        self.assertFalse(office_allows_live_driver(OFFICE, real.id))

        store.update_driver(real.id, {"tenant_id": OFFICE})
        self.assertTrue(office_allows_live_driver(OFFICE, real.id))


if __name__ == "__main__":
    unittest.main()
