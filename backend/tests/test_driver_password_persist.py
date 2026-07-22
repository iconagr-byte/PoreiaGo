"""Driver app accounts — create/update password persist + login."""

from __future__ import annotations

import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from ticketing.password_utils import verify_password


class DriverPasswordPersistTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.store_path = Path(self._tmpdir.name) / "fleet_drivers.json"
        self.env = {
            "POREIAGO_DATA_DIR": self._tmpdir.name,
            "FLEET_DRIVERS_STORE": str(self.store_path),
        }
        self._patches = [
            patch.dict("os.environ", self.env, clear=False),
        ]
        for p in self._patches:
            p.start()

        import travel_platform.settings.drivers_store as store

        self.store = store
        # Re-bind module paths to temp store after env change.
        store.STORE_PATH = self.store_path
        store._DATA_DIR = Path(self._tmpdir.name)
        store.reset_drivers_cache()
        # Valid empty store — avoid demo seed unless a test deletes the file.
        self.store_path.write_text(json.dumps({"drivers": []}), encoding="utf-8")
        store.reset_drivers_cache()
    def tearDown(self):
        self.store.reset_drivers_cache()
        for p in self._patches:
            p.stop()
        self._tmpdir.cleanup()

    def _create(self, **overrides):
        stamp = str(int(time.time() * 1000))[-6:]
        data = {
            "name": "Τεστ Οδηγός",
            "license_no": f"LIC{stamp}",
            "email": f"driver.{stamp}@example.com",
            "phone": "+30 6900000000",
            "password": "SecretPass1",
            "status": "active",
            "vehicle_code": f"BUS-{stamp}",
            "license_plate": f"TST-{stamp}",
        }
        data.update(overrides)
        return self.store.create_driver(data)

    def test_create_persists_hashed_password_and_login_works(self):
        driver = self._create(password="MyBusCode99")
        self.assertTrue(self.store_path.exists())
        raw = json.loads(self.store_path.read_text(encoding="utf-8"))
        rows = raw["drivers"]
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertNotIn("password", row)
        self.assertTrue(str(row["password_hash"]).startswith("pbkdf2_sha256$"))
        self.assertTrue(verify_password("MyBusCode99", row["password_hash"]))

        # Simulate API restart: drop memory, reload from disk.
        self.store.reset_drivers_cache()
        authed = self.store.authenticate_driver(driver.email, "MyBusCode99")
        self.assertIsNotNone(authed)
        self.assertEqual(authed.id, driver.id)

        self.assertIsNone(self.store.authenticate_driver(driver.email, "wrong"))

    def test_login_accepts_plate_and_license_as_username(self):
        driver = self._create(password="PlateLogin1", vehicle_code="XYZ-1111", license_plate="XYZ-1111")
        self.store.reset_drivers_cache()
        self.assertIsNotNone(self.store.authenticate_driver("XYZ-1111", "PlateLogin1"))
        self.assertIsNotNone(self.store.authenticate_driver(driver.license_no, "PlateLogin1"))

    def test_update_password_persists_and_old_fails(self):
        driver = self._create(password="OldPass11")
        self.store.update_driver(driver.id, {"password": "NewPass22"})
        self.store.reset_drivers_cache()
        self.assertIsNone(self.store.authenticate_driver(driver.email, "OldPass11"))
        self.assertIsNotNone(self.store.authenticate_driver(driver.email, "NewPass22"))

    def test_create_requires_password(self):
        with self.assertRaises(ValueError):
            self._create(password="")
        with self.assertRaises(ValueError):
            self._create(password="   ")

    def test_duplicate_email_rejected(self):
        first = self._create(password="PassAAAA")
        with self.assertRaises(ValueError) as ctx:
            self._create(
                password="PassBBBB",
                email=first.email,
                license_no="OTHERLIC1",
                vehicle_code="OTHER-1",
                license_plate="OTHER-1",
            )
        self.assertIn("email", str(ctx.exception).lower())

    def test_empty_store_file_is_not_reseeded(self):
        self.store_path.write_text(json.dumps({"drivers": []}), encoding="utf-8")
        self.store.reset_drivers_cache()
        drivers = self.store.list_drivers()
        self.assertEqual(drivers, [])
        # Still empty on disk — no demo overwrite.
        raw = json.loads(self.store_path.read_text(encoding="utf-8"))
        self.assertEqual(raw.get("drivers"), [])

    def test_seed_only_when_file_missing(self):
        if self.store_path.exists():
            self.store_path.unlink()
        self.store.reset_drivers_cache()
        self.assertFalse(self.store_path.exists())
        drivers = self.store.list_drivers()
        self.assertGreaterEqual(len(drivers), 1)
        self.assertTrue(self.store_path.exists())
        # Seed passwords work
        nikos = self.store.authenticate_driver("nikos.driver@aerostride.com", "driver123")
        self.assertIsNotNone(nikos)

    def test_inactive_driver_cannot_login(self):
        driver = self._create(password="ActiveOnly1", status="inactive")
        self.assertIsNone(self.store.authenticate_driver(driver.email, "ActiveOnly1"))

    def test_mtime_reload_picks_up_external_write(self):
        driver = self._create(password="FirstPass1")
        # External process updates the store file.
        raw = json.loads(self.store_path.read_text(encoding="utf-8"))
        from ticketing.password_utils import hash_password

        raw["drivers"][0]["password_hash"] = hash_password("ExternPass2")
        # Ensure mtime advances.
        time.sleep(0.02)
        self.store_path.write_text(json.dumps(raw, indent=2), encoding="utf-8")
        # Keep cache but newer mtime should reload.
        authed = self.store.authenticate_driver(driver.email, "ExternPass2")
        self.assertIsNotNone(authed)

    def test_list_drivers_scoped_by_tenant(self):
        demo = self._create(password="DemoPass1", tenant_id=self.store.DEMO_TENANT_ID)
        other_tid = "11111111-1111-4111-8111-111111111111"
        other = self._create(
            password="OtherPass1",
            tenant_id=other_tid,
            email="other.office@example.com",
            license_no="LICOTHER1",
            vehicle_code="OTH-1",
            license_plate="OTH-1",
        )
        demo_list = self.store.list_drivers(tenant_id=self.store.DEMO_TENANT_ID)
        other_list = self.store.list_drivers(tenant_id=other_tid)
        self.assertEqual([d.id for d in demo_list], [demo.id])
        self.assertEqual([d.id for d in other_list], [other.id])

    def test_seed_drivers_belong_to_demo_tenant_only(self):
        if self.store_path.exists():
            self.store_path.unlink()
        self.store.reset_drivers_cache()
        demo = self.store.list_drivers(tenant_id=self.store.DEMO_TENANT_ID)
        other = self.store.list_drivers(tenant_id="22222222-2222-4222-8222-222222222222")
        self.assertGreaterEqual(len(demo), 1)
        self.assertEqual(other, [])
        self.assertTrue(all(d.tenant_id == self.store.DEMO_TENANT_ID for d in demo))


if __name__ == "__main__":
    unittest.main()
