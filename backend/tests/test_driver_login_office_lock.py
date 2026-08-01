"""Driver login must stay locked to the Host office tenant."""

from __future__ import annotations

import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

TEST_JWT_SECRET = "dev-jwt-secret-change-in-prod-32bytes!!"
OFFICE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
OFFICE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


class DriverLoginOfficeLockTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import api.driver_portal as portal

        cls._orig_secret = portal._jwt_secret
        portal._jwt_secret = lambda: TEST_JWT_SECRET
        cls.portal = portal

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
        self.driver_a = store.create_driver(
            {
                "name": "Οδηγός A",
                "license_no": f"LICA{stamp}",
                "email": f"a.{stamp}@example.com",
                "password": "driver123",
                "status": "active",
                "tenant_id": OFFICE_A,
            }
        )
        self.driver_b = store.create_driver(
            {
                "name": "Οδηγός B",
                "license_no": f"LICB{stamp}",
                "email": f"b.{stamp}@example.com",
                "password": "driver123",
                "status": "active",
                "tenant_id": OFFICE_B,
            }
        )

        self.app = FastAPI()

        @self.app.middleware("http")
        async def inject_office(request: Request, call_next):
            office = request.headers.get("x-test-office-tenant")
            if office:
                request.state.tenant_id = office
            return await call_next(request)

        self.app.include_router(self.portal.router)
        self.client = TestClient(self.app)

    def tearDown(self):
        self.store.reset_drivers_cache()
        for p in self._patches:
            p.stop()
        self._tmpdir.cleanup()

    def test_login_on_office_a_rejects_office_b_driver(self):
        with patch(
            "api.driver_portal.resolve_platform_tenant_id",
            new=AsyncMock(return_value=OFFICE_A),
        ):
            res = self.client.post(
                "/api/driver/session/login",
                json={"username": self.driver_b.email, "password": "driver123"},
                headers={"x-test-office-tenant": OFFICE_A},
            )
        self.assertEqual(res.status_code, 401)

    def test_login_on_office_a_keeps_session_on_office_a(self):
        with patch(
            "api.driver_portal.resolve_platform_tenant_id",
            new=AsyncMock(return_value=OFFICE_A),
        ):
            res = self.client.post(
                "/api/driver/session/login",
                json={"username": self.driver_a.email, "password": "driver123"},
                headers={"x-test-office-tenant": OFFICE_A},
            )
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(res.json().get("tenant_id"), OFFICE_A)
        self.assertEqual(res.json().get("driver_id"), self.driver_a.id)

    def test_login_without_host_is_rejected(self):
        """Bare unknown Host must not first-match across offices."""
        with patch(
            "api.driver_portal.resolve_platform_tenant_id",
            new=AsyncMock(return_value=OFFICE_A),
        ), patch(
            "api.driver_portal._resolve_poreiago_office_tenant_id",
            new=AsyncMock(return_value=None),
        ):
            res = self.client.post(
                "/api/driver/session/login",
                json={"username": self.driver_b.email, "password": "driver123"},
            )
        self.assertEqual(res.status_code, 401)
        self.assertIn("γραφείου", res.json().get("detail", ""))
        self.assertNotIn("achilliotravel", res.json().get("detail", "").lower())

    def test_login_on_poreiago_platform_host_uses_poreiago_office(self):
        """www.poreiago.com is the PoreiaGo office Host — allow scoped login."""
        with patch(
            "api.driver_portal.resolve_platform_tenant_id",
            new=AsyncMock(return_value=OFFICE_B),
        ), patch(
            "api.driver_portal._resolve_poreiago_office_tenant_id",
            new=AsyncMock(return_value=OFFICE_A),
        ), patch(
            "middleware.domain_tenant._request_host",
            return_value="www.poreiago.com",
        ), patch(
            "middleware.domain_tenant._is_platform_host",
            return_value=True,
        ):
            res = self.client.post(
                "/api/driver/session/login",
                json={"username": self.driver_a.email, "password": "driver123"},
            )
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(res.json().get("tenant_id"), OFFICE_A)
        self.assertEqual(res.json().get("driver_id"), self.driver_a.id)

    def test_authenticate_scoped_by_tenant(self):
        found = self.store.authenticate_driver(
            self.driver_a.email,
            "driver123",
            tenant_id=OFFICE_A,
        )
        self.assertIsNotNone(found)
        missing = self.store.authenticate_driver(
            self.driver_a.email,
            "driver123",
            tenant_id=OFFICE_B,
        )
        self.assertIsNone(missing)


if __name__ == "__main__":
    unittest.main()
