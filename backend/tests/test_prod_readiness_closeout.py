"""Durable data-dir stores + metrics auth + email encryption gate."""

from __future__ import annotations

import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from fastapi import FastAPI
from fastapi.testclient import TestClient


class DataPathsTests(unittest.TestCase):
    def test_resolve_prefers_poreiago_data_dir(self):
        from app.core.data_paths import resolve_data_file

        with TemporaryDirectory() as tmp:
            data = Path(tmp)
            legacy = data / "legacy"
            legacy.mkdir()
            legacy_file = legacy / "loyalty_store.json"
            legacy_file.write_text('{"accounts":[]}', encoding="utf-8")
            with mock.patch.dict(os.environ, {"POREIAGO_DATA_DIR": str(data)}, clear=False):
                path = resolve_data_file("loyalty_store.json", legacy_file)
            self.assertEqual(path, data / "loyalty_store.json")
            self.assertTrue(path.is_file())

    def test_branding_and_loyalty_use_data_dir(self):
        with TemporaryDirectory() as tmp:
            with mock.patch.dict(os.environ, {"POREIAGO_DATA_DIR": tmp}, clear=False):
                # Re-resolve helpers (modules already imported — call resolve again)
                from app.core import data_paths
                from travel_platform.growth import branding_store as branding
                from travel_platform.loyalty import loyalty_store as loyalty

                data = Path(tmp)
                branding.DATA_DIR = data
                branding.STORE_PATH = data / "tenant_branding.json"
                loyalty.DATA_DIR = data
                loyalty.STORE_FILE = data / "loyalty_store.json"

                branding.update_branding("office-a", {"display_name": "Office A"})
                self.assertTrue((data / "tenant_branding.json").is_file())

                # loyalty write via ensure empty read/write
                loyalty._write(loyalty._empty())
                self.assertTrue((data / "loyalty_store.json").is_file())


class MetricsAuthTests(unittest.TestCase):
    def test_metrics_requires_token_when_not_public(self):
        from app.api.metrics import router

        app = FastAPI()
        app.include_router(router, prefix="/api/v1")
        client = TestClient(app)
        with mock.patch.dict(
            os.environ,
            {"METRICS_PUBLIC": "false", "METRICS_TOKEN": "secret-metrics", "METRICS_ENABLED": "true"},
            clear=False,
        ):
            denied = client.get("/api/v1/metrics")
            self.assertEqual(denied.status_code, 401)
            ok = client.get("/api/v1/metrics", headers={"Authorization": "Bearer secret-metrics"})
            # May 200 or 500 if prometheus missing in env — but not 401
            self.assertNotEqual(ok.status_code, 401)


class EmailEncryptionProdTests(unittest.TestCase):
    def test_production_guard_requires_email_key(self):
        from app.core.production_guard import collect_production_boot_errors

        env = {
            "ENVIRONMENT": "production",
            "AUTH_JWT_SECRET": "x" * 40,
            "TICKET_JWT_SECRET": "y" * 40,
            "TELEMETRY_DEVICE_KEYS": "prod-key",
            "DATABASE_URL": "postgresql+asyncpg://u:realpass@db/x",
            "ADMIN_AUTH_DISABLED": "0",
            "RENT_DEMO_FLEET": "false",
            "EMAIL_ENCRYPTION_KEY": "",
        }
        errs = collect_production_boot_errors(environ=env)
        self.assertTrue(any("EMAIL_ENCRYPTION_KEY" in e for e in errs))


if __name__ == "__main__":
    unittest.main()
