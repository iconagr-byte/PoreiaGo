"""Driver activity store + history composition tests."""

from __future__ import annotations

import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient


class DriverActivityStoreTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        path = Path(self._tmpdir.name) / "driver_activity.json"
        from travel_platform.settings import driver_activity_store as store

        self.store = store
        store.reset_activity_store_for_tests(path)

    def tearDown(self):
        self._tmpdir.cleanup()

    def test_login_and_shift_pairing(self):
        login = self.store.record_driver_login(
            driver_id="a1000000-0000-4000-8000-000000000001",
            tenant_id="t1",
            trip_id=9,
            method="password",
        )
        self.assertEqual(login["type"], "login")

        start = self.store.record_shift_start(
            driver_id="a1000000-0000-4000-8000-000000000001",
            tenant_id="t1",
            trip_id=9,
        )
        self.assertEqual(start["type"], "shift_start")
        self.assertTrue(self.store.get_open_shift("a1000000-0000-4000-8000-000000000001"))

        end = self.store.record_shift_end(
            driver_id="a1000000-0000-4000-8000-000000000001",
            tenant_id="t1",
            trip_id=9,
            km=42.5,
        )
        self.assertEqual(end["type"], "shift_end")
        self.assertEqual(end["km"], 42.5)
        self.assertIsNone(self.store.get_open_shift("a1000000-0000-4000-8000-000000000001"))

        shifts = self.store.pair_driver_shifts("a1000000-0000-4000-8000-000000000001")
        self.assertEqual(len(shifts), 1)
        self.assertEqual(shifts[0]["status"], "completed")
        self.assertEqual(shifts[0]["km"], 42.5)

        summary = self.store.activity_summary("a1000000-0000-4000-8000-000000000001")
        self.assertEqual(summary["login_count"], 1)
        self.assertEqual(summary["completed_shifts"], 1)
        self.assertEqual(summary["shift_km_total"], 42.5)


class DriverHistoryApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.activity_path = Path(self._tmpdir.name) / "driver_activity.json"
        self.drivers_path = Path(self._tmpdir.name) / "fleet_drivers.json"

        from travel_platform.settings import driver_activity_store as activity
        from travel_platform.settings import drivers_store as drivers

        self.activity = activity
        self.drivers = drivers
        activity.reset_activity_store_for_tests(self.activity_path)
        drivers.STORE_PATH = self.drivers_path
        drivers._DATA_DIR = Path(self._tmpdir.name)
        drivers.reset_drivers_cache()
        self.drivers_path.write_text(json.dumps({"drivers": []}), encoding="utf-8")
        drivers.reset_drivers_cache()

        stamp = str(int(time.time() * 1000))[-6:]
        self.driver = drivers.create_driver(
            {
                "name": "Ιστορικό Τεστ",
                "license_no": f"HIST{stamp}",
                "email": f"hist.{stamp}@example.com",
                "password": "driver123",
                "status": "active",
            }
        )

        import api.admin_platform as admin

        self.admin = admin
        self.app = FastAPI()
        self.app.include_router(admin.router)
        self.client = TestClient(self.app)

    async def asyncTearDown(self):
        self.drivers.reset_drivers_cache()
        self._tmpdir.cleanup()

    async def test_history_endpoint_returns_logins_and_shifts(self):
        self.activity.record_driver_login(
            driver_id=self.driver.id,
            tenant_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            method="password",
        )
        self.activity.record_shift_start(
            driver_id=self.driver.id,
            tenant_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            trip_id=3,
        )
        self.activity.record_shift_end(
            driver_id=self.driver.id,
            tenant_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            trip_id=3,
            km=12.25,
        )

        with (
            patch(
                "travel_platform.operations.master_qr_bridge.resolve_platform_tenant_id",
                new=AsyncMock(return_value="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
            ),
            patch(
                "travel_platform.telemetry.driver_history_service.fetch_driver_gps_km",
                new=AsyncMock(
                    return_value={
                        "total_km": 12.25,
                        "trips": [
                            {
                                "trip_id": 3,
                                "distance_km": 12.25,
                                "point_count": 40,
                                "first_at": "2026-07-20T08:00:00+00:00",
                                "last_at": "2026-07-20T10:00:00+00:00",
                            }
                        ],
                        "error": None,
                        "from_time": None,
                        "to_time": None,
                    }
                ),
            ),
        ):
            # Force DB path to fall through to None session when AsyncSessionLocal fails
            # — build_driver_history still works with activity store.
            res = self.client.get(f"/api/admin/platform/drivers/{self.driver.id}/history")

        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertEqual(data["driver_id"], self.driver.id)
        self.assertGreaterEqual(data["summary"]["login_count"], 1)
        self.assertGreaterEqual(data["summary"]["shift_count"], 1)
        self.assertTrue(data["logins"])
        self.assertTrue(data["shifts"])
        self.assertTrue(data["timeline"])

    async def test_history_404_for_unknown_driver(self):
        res = self.client.get(
            "/api/admin/platform/drivers/00000000-0000-4000-8000-000000009999/history"
        )
        self.assertEqual(res.status_code, 404)


class DriverLoginRecordsActivityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import api.driver_portal as portal

        cls._orig_secret = portal._jwt_secret
        portal._jwt_secret = lambda: "dev-jwt-secret-change-in-prod-32bytes!!"
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
        self.activity_path = Path(self._tmpdir.name) / "driver_activity.json"
        self.env_patch = patch.dict(
            "os.environ",
            {
                "POREIAGO_DATA_DIR": self._tmpdir.name,
                "FLEET_DRIVERS_STORE": str(self.store_path),
                "DRIVER_ACTIVITY_STORE": str(self.activity_path),
                "TICKET_JWT_SECRET": "dev-jwt-secret-change-in-prod-32bytes!!",
            },
            clear=False,
        )
        self.env_patch.start()

        import travel_platform.settings.driver_activity_store as activity
        import travel_platform.settings.drivers_store as store

        self.activity = activity
        self.store = store
        activity.reset_activity_store_for_tests(self.activity_path)
        store.STORE_PATH = self.store_path
        store._DATA_DIR = Path(self._tmpdir.name)
        store.reset_drivers_cache()
        self.store_path.write_text(json.dumps({"drivers": []}), encoding="utf-8")
        store.reset_drivers_cache()

        stamp = str(int(time.time() * 1000))[-6:]
        self.driver = store.create_driver(
            {
                "name": "Login Hist",
                "license_no": f"LH{stamp}",
                "email": f"login.hist.{stamp}@example.com",
                "password": "driver123",
                "status": "active",
            }
        )

    def tearDown(self):
        self.store.reset_drivers_cache()
        self.env_patch.stop()
        self._tmpdir.cleanup()

    def test_password_login_records_activity(self):
        with patch(
            "api.driver_portal.resolve_platform_tenant_id",
            new=AsyncMock(return_value="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
        ):
            res = self.client.post(
                "/api/driver/session/login",
                json={"username": self.driver.email, "password": "driver123"},
            )
        self.assertEqual(res.status_code, 200, res.text)
        events = self.activity.list_driver_events(self.driver.id, types={"login"})
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["method"], "password")


if __name__ == "__main__":
    unittest.main()
