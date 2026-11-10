"""Fleet driver PWA forgot / reset password (token + store)."""

from __future__ import annotations

import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch


class DriverPasswordResetTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.store_path = Path(self._tmpdir.name) / "fleet_drivers.json"
        self.env = {
            "POREIAGO_DATA_DIR": self._tmpdir.name,
            "FLEET_DRIVERS_STORE": str(self.store_path),
            "AUTH_JWT_SECRET": "dev-jwt-secret-change-in-prod-32bytes!!",
            "ENVIRONMENT": "test",
        }
        self._patches = [patch.dict("os.environ", self.env, clear=False)]
        for p in self._patches:
            p.start()

        import travel_platform.settings.driver_password_reset as dpr
        import travel_platform.settings.drivers_store as store

        self.dpr = dpr
        self.store = store
        store.STORE_PATH = self.store_path
        store._DATA_DIR = Path(self._tmpdir.name)
        store.reset_drivers_cache()
        self.store_path.write_text(json.dumps({"drivers": []}), encoding="utf-8")
        store.reset_drivers_cache()
        dpr.reset_confirm_rate_limits_for_tests()

        stamp = str(int(time.time() * 1000))[-6:]
        self.tenant = "97798681-2f60-4398-b1f6-9eb38dc341b0"
        self.driver = store.create_driver(
            {
                "name": "Test Driver",
                "email": f"driver.reset.{stamp}@example.com",
                "license_no": f"DRV{stamp}",
                "password": "oldpass1",
                "tenant_id": self.tenant,
                "phone": "6900000000",
                "status": "active",
                "_allow_demo_tenant": True,
            }
        )

    def tearDown(self):
        self.store.reset_drivers_cache()
        for p in self._patches:
            p.stop()
        self._tmpdir.cleanup()

    def test_token_roundtrip_updates_password(self):
        token = self.dpr.create_reset_token(
            driver_id=self.driver.id,
            tenant_id=self.tenant,
            password_hash=self.driver.password_hash,
        )
        updated = self.dpr.apply_password_reset(token=token, new_password="newpass9")
        self.assertEqual(updated.id, self.driver.id)
        auth = self.store.authenticate_driver(
            self.driver.email,
            "newpass9",
            tenant_id=self.tenant,
        )
        self.assertIsNotNone(auth)
        self.assertIsNone(
            self.store.authenticate_driver(
                self.driver.email,
                "oldpass1",
                tenant_id=self.tenant,
            )
        )

    def test_fingerprint_invalidates_after_change(self):
        token = self.dpr.create_reset_token(
            driver_id=self.driver.id,
            tenant_id=self.tenant,
            password_hash=self.driver.password_hash,
        )
        self.dpr.apply_password_reset(token=token, new_password="once-only")
        with self.assertRaises(ValueError):
            self.dpr.apply_password_reset(token=token, new_password="again123")

    def test_resolve_driver_for_reset_requires_email(self):
        found = self.dpr.resolve_driver_for_reset(
            self.driver.email,
            tenant_id=self.tenant,
        )
        self.assertIsNotNone(found)
        self.assertEqual(found.id, self.driver.id)
        self.assertIsNone(
            self.dpr.resolve_driver_for_reset("missing@example.com", tenant_id=self.tenant)
        )

    def test_build_reset_url_uses_base(self):
        url = self.dpr.build_reset_url("abcToken", base_url="https://www.poreiago.com")
        self.assertEqual(url, "https://www.poreiago.com/driver/reset-password?token=abcToken")


if __name__ == "__main__":
    unittest.main()
