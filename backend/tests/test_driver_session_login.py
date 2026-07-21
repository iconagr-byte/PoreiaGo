"""Driver PWA primary login — POST /api/driver/session/login."""

from __future__ import annotations

import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

TEST_JWT_SECRET = "dev-jwt-secret-change-in-prod-32bytes!!"


class DriverSessionLoginApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import api.driver_portal as portal

        cls._orig_secret = portal._jwt_secret
        portal._jwt_secret = lambda: TEST_JWT_SECRET
        cls.portal = portal
        cls.app = FastAPI()
        cls.app.include_router(portal.router)
        cls.client = TestClient(cls.app)

    @classmethod
    def tearDownClass(cls):
        cls.portal._jwt_secret = cls._orig_secret

    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.store_path = Path(self._tmpdir.name) / "fleet_drivers.json"
        self.env = {
            "POREIAGO_DATA_DIR": self._tmpdir.name,
            "FLEET_DRIVERS_STORE": str(self.store_path),
            "TICKET_JWT_SECRET": TEST_JWT_SECRET,
        }
        self._patches = [patch.dict("os.environ", self.env, clear=False)]
        for p in self._patches:
            p.start()

        import travel_platform.settings.drivers_store as store

        self.store = store
        store.STORE_PATH = self.store_path
        store._DATA_DIR = Path(self._tmpdir.name)
        store.reset_drivers_cache()
        self.store_path.write_text(json.dumps({"drivers": []}), encoding="utf-8")
        store.reset_drivers_cache()

        stamp = str(int(time.time() * 1000))[-6:]
        self.driver = store.create_driver(
            {
                "name": "Νίκος Παπαδόπουλος",
                "license_no": f"LIC{stamp}",
                "email": f"nikos.{stamp}@example.com",
                "password": "driver123",
                "status": "active",
                "vehicle_code": "XAH-4021",
                "license_plate": "XAH-4021",
                "photo_url": "/images/drivers/nikos.jpg",
            }
        )

    def tearDown(self):
        self.store.reset_drivers_cache()
        for p in self._patches:
            p.stop()
        self._tmpdir.cleanup()

    def test_login_ok_returns_session_with_profile(self):
        res = self.client.post(
            "/api/driver/session/login",
            json={"username": self.driver.email, "password": "driver123"},
        )
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertTrue(data.get("access_token"))
        self.assertEqual(data.get("driver_id"), self.driver.id)
        self.assertEqual(data.get("driver_name"), "Νίκος Παπαδόπουλος")
        self.assertEqual(data.get("photo_url"), "/images/drivers/nikos.jpg")
        self.assertIn("vehicle_plate", data)
        self.assertTrue(data.get("expires_at"))

    def test_login_uses_resolved_platform_tenant(self):
        from unittest.mock import AsyncMock

        platform = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        with patch(
            "api.driver_portal.resolve_platform_tenant_id",
            new=AsyncMock(return_value=platform),
        ):
            res = self.client.post(
                "/api/driver/session/login",
                json={"username": self.driver.email, "password": "driver123"},
            )
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(res.json().get("tenant_id"), platform)

    def test_login_rejects_bad_password(self):
        res = self.client.post(
            "/api/driver/session/login",
            json={"username": self.driver.email, "password": "wrong"},
        )
        self.assertEqual(res.status_code, 401)
