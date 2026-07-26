"""Driver create on file-store routes must use JWT tenant (multi-office)."""

from __future__ import annotations

import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import UUID

import jwt
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from middleware.tenant import TenantContextMiddleware, _attach_bearer_tenant_context
from travel_platform.settings import drivers_store as store


OFFICE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
OFFICE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
JWT_SECRET = "test-driver-create-jwt-secret-32chars"


def _token(tenant_id: str) -> str:
    return jwt.encode(
        {
            "sub": "admin-user",
            "tenant_id": tenant_id,
            "roles": ["tenant_admin"],
        },
        JWT_SECRET,
        algorithm="HS256",
    )


class AttachBearerTenantTests(unittest.TestCase):
    def test_jwt_overrides_domain_tenant(self):
        app = FastAPI()

        @app.get("/probe")
        async def probe(request: Request):
            return {"tenant_id": str(getattr(request.state, "tenant_id", None))}

        # Simulate DomainTenantMiddleware having set a host tenant first.
        @app.middleware("http")
        async def seed_domain_tenant(request: Request, call_next):
            request.state.tenant_id = UUID(OFFICE_A)
            return await call_next(request)

        app.add_middleware(TenantContextMiddleware)

        with patch.dict(
            os.environ,
            {
                "AUTH_JWT_SECRET": JWT_SECRET,
                "ADMIN_AUTH_DISABLED": "0",
            },
            clear=False,
        ):
            client = TestClient(app)
            # Without this helper the file-store path would keep OFFICE_A.
            # Here we call the attach helper directly to unit-test override.
            req_tenant = {"tenant_id": None}

            @app.get("/attach")
            async def attach(request: Request):
                _attach_bearer_tenant_context(request, JWT_SECRET, "HS256")
                req_tenant["tenant_id"] = str(request.state.tenant_id)
                return req_tenant

            res = client.get(
                "/attach",
                headers={"Authorization": f"Bearer {_token(OFFICE_B)}"},
            )
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["tenant_id"], OFFICE_B)


class DriverCreateJwtTenantTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.store_path = Path(self._tmpdir.name) / "fleet_drivers.json"
        self.env = {
            "POREIAGO_DATA_DIR": self._tmpdir.name,
            "FLEET_DRIVERS_STORE": str(self.store_path),
            "AUTH_JWT_SECRET": JWT_SECRET,
            "ADMIN_AUTH_DISABLED": "0",
        }
        self._patches = [patch.dict("os.environ", self.env, clear=False)]
        for p in self._patches:
            p.start()
        store.STORE_PATH = self.store_path
        store._DATA_DIR = Path(self._tmpdir.name)
        self.store_path.write_text('{"drivers": []}', encoding="utf-8")
        store.reset_drivers_cache()

        from api.admin_platform import router as admin_router

        self.app = FastAPI()
        self.app.add_middleware(TenantContextMiddleware)
        self.app.include_router(admin_router)
        self.client = TestClient(self.app)

    def tearDown(self):
        store.reset_drivers_cache()
        for p in self._patches:
            p.stop()
        self._tmpdir.cleanup()

    def _create_body(self, stamp: str) -> dict:
        return {
            "name": f"Οδηγός {stamp}",
            "license_no": f"LIC{stamp}",
            "email": f"driver.{stamp}@example.com",
            "phone": "+306900000000",
            "password": "BusPass99",
            "status": "active",
        }

    def test_create_driver_scoped_to_jwt_tenant_not_demo(self):
        stamp = str(int(time.time() * 1000))[-6:]
        res = self.client.post(
            "/api/admin/platform/drivers",
            json=self._create_body(stamp),
            headers={"Authorization": f"Bearer {_token(OFFICE_B)}"},
        )
        self.assertEqual(res.status_code, 201, res.text)
        created_id = res.json()["id"]

        listed_b = self.client.get(
            "/api/admin/platform/drivers",
            headers={"Authorization": f"Bearer {_token(OFFICE_B)}"},
        )
        self.assertEqual(listed_b.status_code, 200)
        ids_b = {row["id"] for row in listed_b.json()}
        self.assertIn(created_id, ids_b)

        listed_a = self.client.get(
            "/api/admin/platform/drivers",
            headers={"Authorization": f"Bearer {_token(OFFICE_A)}"},
        )
        self.assertEqual(listed_a.status_code, 200)
        ids_a = {row["id"] for row in listed_a.json()}
        self.assertNotIn(created_id, ids_a)

        row = store.get_driver(created_id)
        self.assertIsNotNone(row)
        self.assertEqual(row.tenant_id, OFFICE_B)
        self.assertNotEqual(row.tenant_id, store.DEMO_TENANT_ID)


if __name__ == "__main__":
    unittest.main()
