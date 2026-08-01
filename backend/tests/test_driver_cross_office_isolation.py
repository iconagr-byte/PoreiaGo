"""Drivers must never authenticate or list across offices (PoreiaGo ↔ Achillio)."""

from __future__ import annotations

import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

TEST_JWT_SECRET = "dev-jwt-secret-change-in-prod-32bytes!!"
OFFICE_POREIAGO = "11111111-1111-4111-8111-111111111111"
OFFICE_ACHILLIO = "22222222-2222-4222-8222-222222222222"


class DriverCrossOfficeIsolationTests(unittest.TestCase):
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
        self.shared_email = f"shared.{stamp}@example.com"
        self.password = "BusPass99"

        self.driver_poreiago = store.create_driver(
            {
                "name": "Οδηγός PoreiaGo",
                "license_no": f"LICP{stamp}",
                "email": self.shared_email,
                "password": self.password,
                "status": "active",
                "tenant_id": OFFICE_POREIAGO,
            }
        )
        self.driver_achillio = store.create_driver(
            {
                "name": "Οδηγός Achillio",
                "license_no": f"LICA{stamp}",
                "email": self.shared_email,
                "password": self.password,
                "status": "active",
                "tenant_id": OFFICE_ACHILLIO,
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

    def test_same_email_exists_independently_per_office(self):
        poreiago_rows = self.store.list_drivers(tenant_id=OFFICE_POREIAGO)
        achillio_rows = self.store.list_drivers(tenant_id=OFFICE_ACHILLIO)
        self.assertEqual([d.id for d in poreiago_rows], [self.driver_poreiago.id])
        self.assertEqual([d.id for d in achillio_rows], [self.driver_achillio.id])
        self.assertNotEqual(self.driver_poreiago.id, self.driver_achillio.id)

    def test_authenticate_scoped_to_office(self):
        p = self.store.authenticate_driver(
            self.shared_email, self.password, tenant_id=OFFICE_POREIAGO
        )
        a = self.store.authenticate_driver(
            self.shared_email, self.password, tenant_id=OFFICE_ACHILLIO
        )
        self.assertEqual(p.id, self.driver_poreiago.id)
        self.assertEqual(a.id, self.driver_achillio.id)
        self.assertIsNone(
            self.store.authenticate_driver(
                self.shared_email, self.password, tenant_id=str(uuid4())
            )
        )

    def test_login_on_poreiago_returns_poreiago_driver_only(self):
        with patch(
            "api.driver_portal.resolve_platform_tenant_id",
            new=AsyncMock(return_value=OFFICE_ACHILLIO),
        ):
            res = self.client.post(
                "/api/driver/session/login",
                json={"username": self.shared_email, "password": self.password},
                headers={"x-test-office-tenant": OFFICE_POREIAGO},
            )
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertEqual(body["tenant_id"], OFFICE_POREIAGO)
        self.assertEqual(body["driver_id"], self.driver_poreiago.id)
        self.assertEqual(body["driver_name"], "Οδηγός PoreiaGo")

    def test_login_on_achillio_returns_achillio_driver_only(self):
        with patch(
            "api.driver_portal.resolve_platform_tenant_id",
            new=AsyncMock(return_value=OFFICE_ACHILLIO),
        ):
            res = self.client.post(
                "/api/driver/session/login",
                json={"username": self.shared_email, "password": self.password},
                headers={"x-test-office-tenant": OFFICE_ACHILLIO},
            )
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertEqual(body["tenant_id"], OFFICE_ACHILLIO)
        self.assertEqual(body["driver_id"], self.driver_achillio.id)
        self.assertEqual(body["driver_name"], "Οδηγός Achillio")

    def test_achillio_only_driver_rejected_on_poreiago_host(self):
        stamp = str(int(time.time() * 1000))[-5:]
        only_ach = self.store.create_driver(
            {
                "name": "Μόνο Achillio",
                "license_no": f"LICX{stamp}",
                "email": f"only.ach.{stamp}@example.com",
                "password": self.password,
                "status": "active",
                "tenant_id": OFFICE_ACHILLIO,
            }
        )
        with patch(
            "api.driver_portal.resolve_platform_tenant_id",
            new=AsyncMock(return_value=OFFICE_ACHILLIO),
        ), patch(
            "api.driver_portal._resolve_poreiago_office_tenant_id",
            new=AsyncMock(return_value=OFFICE_POREIAGO),
        ):
            res = self.client.post(
                "/api/driver/session/login",
                json={"username": only_ach.email, "password": self.password},
                headers={"x-test-office-tenant": OFFICE_POREIAGO},
            )
        self.assertEqual(res.status_code, 401)
        self.assertIn("άλλο γραφείο", res.json().get("detail", ""))


if __name__ == "__main__":
    unittest.main()
