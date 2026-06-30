"""E2E smoke — fleet telemetry WS + admin REST APIs."""

from __future__ import annotations

import json
import time
import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from uuid import UUID

import jwt
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

DEMO_TENANT = "00000000-0000-0000-0000-000000000001"
TEST_JWT_SECRET = "dev-jwt-secret-change-in-prod-32bytes!!"


def _driver_token() -> str:
    return jwt.encode(
        {
            "sub": "driver-e2e",
            "tenant_id": DEMO_TENANT,
            "trip_id": 1,
            "roles": ["driver"],
            "driver_name": "E2E Driver",
            "vehicle_code": "E2E-1",
            "exp": int(time.time()) + 3600,
        },
        TEST_JWT_SECRET,
        algorithm="HS256",
    )


def _tenant_app() -> FastAPI:
    from core.dependencies import get_tenant_db

    app = FastAPI()

    @app.middleware("http")
    async def inject_tenant(request: Request, call_next):
        request.state.tenant_id = UUID(DEMO_TENANT)
        return await call_next(request)

    async def override_db():
        yield AsyncMock()

    app.dependency_overrides[get_tenant_db] = override_db

    from api.admin_telemetry import router as admin_telemetry_router

    app.include_router(admin_telemetry_router)
    return app


class FleetTelemetryE2ETests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import api.ws_telemetry as ws_mod

        ws_mod.JWT_SECRET = TEST_JWT_SECRET
        cls.ws_app = FastAPI()
        cls.ws_app.include_router(ws_mod.router)
        cls.ws_client = TestClient(cls.ws_app)
        cls.admin_client = TestClient(_tenant_app())

    def test_ws_ingress_to_egress_roundtrip(self):
        token = _driver_token()
        with self.ws_client.websocket_connect(f"/ws/telemetry/ingress?token={token}") as ingress:
            ingress.receive_json()
            with self.ws_client.websocket_connect(f"/ws/telemetry/egress/{DEMO_TENANT}") as egress:
                egress.receive_json()
                ingress.send_json(
                    {
                        "lat": 38.9,
                        "lng": 22.4,
                        "speed": 50,
                        "heading": 10,
                        "timestamp": int(time.time() * 1000),
                    },
                )
                self.assertEqual(ingress.receive_json()["type"], "ack")
                update = egress.receive_json()
                self.assertEqual(update["type"], "fleet_location")
                self.assertAlmostEqual(update["lat"], 38.9, places=2)

    def test_admin_geofence_map_endpoint(self):
        res = self.admin_client.get("/api/admin/telemetry/geofence-map?trip_ids=1")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["tenant_id"], DEMO_TENANT)
        self.assertGreaterEqual(len(data["corridors"]), 1)
        self.assertGreaterEqual(len(data["stops"]), 1)

    def test_admin_fleet_etas_endpoint(self):
        res = self.admin_client.get("/api/admin/telemetry/etas")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("items", data)
        self.assertIn("refresh_seconds", data)

    @patch("api.admin_telemetry.fetch_trip_route", new_callable=AsyncMock)
    def test_admin_trip_route_forwards_filters(self, mock_fetch):
        mock_fetch.return_value = {
            "trip_id": 1,
            "tenant_id": DEMO_TENANT,
            "point_count": 2,
            "points": [
                {
                    "id": 1,
                    "trip_id": 1,
                    "lat": 38.0,
                    "lng": 23.0,
                    "speed_kmh": 40,
                    "heading_deg": None,
                    "recorded_at": "2026-01-01T10:00:00+00:00",
                },
            ],
        }
        driver_id = "00000000-0000-0000-0000-000000000099"
        res = self.admin_client.get(
            "/api/admin/telemetry/trips/1/route",
            params={
                "from": "2026-01-01T00:00:00+00:00",
                "to": "2026-01-01T23:59:59+00:00",
                "driver_id": driver_id,
            },
        )
        self.assertEqual(res.status_code, 200)
        mock_fetch.assert_awaited_once()
        kwargs = mock_fetch.await_args.kwargs
        self.assertEqual(kwargs["trip_id"], 1)
        self.assertEqual(str(kwargs["driver_id"]), driver_id)
        self.assertIsInstance(kwargs["from_time"], datetime)

    @patch("api.admin_telemetry.fetch_fleet_kpis", new_callable=AsyncMock)
    def test_admin_kpis_endpoint(self, mock_kpis):
        mock_kpis.return_value = {
            "tenant_id": DEMO_TENANT,
            "from_time": datetime.now(timezone.utc).isoformat(),
            "to_time": None,
            "days": 7,
            "summary": {
                "active_drivers_now": 0,
                "gps_points": 0,
                "trips_tracked": 0,
                "drivers_with_gps": 0,
                "total_distance_km": 0.0,
                "avg_speed_kmh": 0.0,
                "slow_motion_pct": 0.0,
                "alerts_total": 0,
                "alerts_route_deviation": 0,
                "alerts_driver_online": 0,
                "alerts_driver_offline": 0,
            },
            "daily": [],
            "top_trips": [],
            "alerts_by_type": {},
            "error": None,
        }
        res = self.admin_client.get("/api/admin/telemetry/kpis?days=7")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["days"], 7)

    def test_admin_alerts_ws_snapshot(self):
        with self.ws_client.websocket_connect(
            f"/ws/admin/telemetry/alerts?tenant_id={DEMO_TENANT}",
        ) as ws:
            snap = ws.receive_json()
            self.assertEqual(snap["type"], "alerts_snapshot")
            self.assertIsInstance(snap.get("alerts"), list)
            ws.send_text("ping")
            self.assertEqual(json.loads(ws.receive_text())["type"], "pong")


if __name__ == "__main__":
    unittest.main()
