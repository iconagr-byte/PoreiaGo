"""Driver HTTP telemetry fallback — POST /api/driver/telemetry/location."""

from __future__ import annotations

import time
import unittest
from unittest.mock import AsyncMock, patch

import jwt
from fastapi import FastAPI
from fastapi.testclient import TestClient

DEMO_TENANT = "00000000-0000-0000-0000-000000000001"
TEST_JWT_SECRET = "dev-jwt-secret-change-in-prod-32bytes!!"


def _driver_token() -> str:
    return jwt.encode(
        {
            "sub": "driver-http-1",
            "tenant_id": DEMO_TENANT,
            "trip_id": 7,
            "roles": ["driver"],
            "exp": int(time.time()) + 3600,
        },
        TEST_JWT_SECRET,
        algorithm="HS256",
    )


class DriverHttpTelemetryTests(unittest.TestCase):
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

    def test_location_requires_auth(self):
        res = self.client.post("/api/driver/telemetry/location", json={"lat": 1, "lng": 2})
        self.assertEqual(res.status_code, 401)

    def test_location_ingests_and_acks(self):
        token = _driver_token()
        with patch(
            "travel_platform.telemetry.fleet_ingress.ingest_driver_location",
            new=AsyncMock(return_value={"ok": True, "vehicle_id": "v1"}),
        ):
            with patch(
                "travel_platform.telemetry.driver_shift_tracker.on_driver_connected",
                return_value=False,
            ):
                res = self.client.post(
                    "/api/driver/telemetry/location",
                    headers={"Authorization": f"Bearer {token}"},
                    json={
                        "lat": 38.24,
                        "lng": 21.73,
                        "speed": 40,
                        "bus_plate": "XAH-4021",
                        "timestamp": int(time.time() * 1000),
                    },
                )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["type"], "ack")
        self.assertTrue(body["ok"])


if __name__ == "__main__":
    unittest.main()
