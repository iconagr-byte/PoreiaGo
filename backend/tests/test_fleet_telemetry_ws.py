"""Fleet telemetry — driver ingress payload, ingest pipeline, WebSocket smoke."""

from __future__ import annotations

import json
import time
import unittest
from unittest.mock import AsyncMock, patch

import jwt
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from travel_platform.telemetry.coordinate_buffer import drain_batch, pending_count
from travel_platform.telemetry.fleet_ingress import driver_payload_to_telemetry, ingest_driver_location
from travel_platform.telemetry.fleet_ws_hub import get_fleet_egress_hub

DEMO_TENANT = "00000000-0000-0000-0000-000000000001"
TEST_JWT_SECRET = "dev-jwt-secret-change-in-prod-32bytes!!"


def _jwt_secret() -> str:
    return TEST_JWT_SECRET


def _driver_session_token(**overrides) -> str:
    payload = {
        "sub": "driver-test-1",
        "tenant_id": DEMO_TENANT,
        "trip_id": 42,
        "roles": ["driver"],
        "driver_name": "Nikos Test",
        "vehicle_code": "XAH-4021",
        "exp": int(time.time()) + 3600,
    }
    payload.update(overrides)
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")


class DriverPayloadNormalizationTests(unittest.TestCase):
    def test_maps_lat_lng_aliases_and_session_defaults(self):
        session = {
            "tenant_id": DEMO_TENANT,
            "trip_id": 7,
            "sub": "drv-99",
            "driver_name": "Maria",
            "vehicle_code": "BUS-7",
        }
        body = {
            "lat": 38.12,
            "lng": 23.45,
            "speed": 55.5,
            "heading": 180,
            "timestamp": 1_710_000_000_000,
        }
        out = driver_payload_to_telemetry(body, session=session)
        self.assertEqual(out["latitude"], 38.12)
        self.assertEqual(out["longitude"], 23.45)
        self.assertEqual(out["speed_kmh"], 55.5)
        self.assertEqual(out["heading_deg"], 180.0)
        self.assertEqual(out["tenant_id"], DEMO_TENANT)
        self.assertEqual(out["trip_id"], 7)
        self.assertEqual(out["driver_id"], "drv-99")
        self.assertEqual(out["driver_name"], "Maria")
        self.assertEqual(out["source"], "driver_pwa")

    def test_maps_boarding_and_sensors(self):
        session = {"tenant_id": DEMO_TENANT, "trip_id": 1, "sub": "drv-1"}
        body = {
            "lat": 38.0,
            "lng": 23.0,
            "speed": 40,
            "accuracy_m": 12.5,
            "boarding": {
                "boarded_count": 2,
                "capacity": 45,
                "progress_label": "2/45",
                "boarded_passengers": [
                    {"booking_id": 1, "passenger_name": "Maria", "seat_number": "4A"},
                ],
            },
            "sensors": {
                "battery": {"level_pct": 88, "charging": False},
                "network": {"effective_type": "4g"},
            },
            "accel_x": 0.1,
            "accel_y": -0.2,
            "accel_z": 9.7,
        }
        out = driver_payload_to_telemetry(body, session=session)
        self.assertEqual(out["accuracy_m"], 12.5)
        self.assertEqual(out["boarding_snapshot"]["boarded_count"], 2)
        self.assertEqual(out["device_sensors"]["battery"]["level_pct"], 88)
        self.assertEqual(out["accel_x"], 0.1)


class IngestDriverLocationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        while drain_batch(500):
            pass

    async def test_buffers_coordinate_and_broadcasts(self):
        session = {
            "tenant_id": DEMO_TENANT,
            "trip_id": 1,
            "sub": "drv-buffer",
            "driver_name": "Buffer Driver",
            "vehicle_code": "BUF-001",
        }
        body = {
            "lat": 37.98,
            "lng": 23.73,
            "speed": 40,
            "heading": 90,
            "bus_plate": "BUF-001",
            "driver_name": "Buffer Driver",
            "timestamp": int(time.time() * 1000),
        }

        hub = get_fleet_egress_hub()
        broadcast = AsyncMock()
        publish = AsyncMock(return_value=True)
        process = AsyncMock()

        with (
            patch("travel_platform.telemetry.fleet_ingress.process_telemetry_payload", process),
            patch("travel_platform.telemetry.fleet_ingress.publish_fleet_location", publish),
            patch.object(hub, "broadcast", broadcast),
            patch(
                "travel_platform.operations.master_qr_bridge.resolve_platform_tenant_id",
                new=AsyncMock(return_value=DEMO_TENANT),
            ),
        ):
            result = await ingest_driver_location(body, session=session)

        self.assertTrue(result["ok"])
        self.assertEqual(result["tenant_id"], DEMO_TENANT)
        process.assert_awaited_once()
        publish.assert_awaited_once()
        broadcast.assert_awaited_once()
        egress = broadcast.await_args.args[1]
        self.assertEqual(egress["type"], "fleet_location")
        self.assertEqual(egress["lat"], 37.98)
        self.assertEqual(egress["lng"], 23.73)
        self.assertGreater(pending_count(), 0)
        batch = drain_batch(10)
        self.assertEqual(len(batch), 1)
        self.assertEqual(batch[0].lat, 37.98)

    async def test_remaps_legacy_demo_tenant_to_platform(self):
        platform = "11111111-2222-3333-4444-555555555555"
        session = {
            "tenant_id": DEMO_TENANT,
            "trip_id": 1,
            "sub": "drv-remap",
            "vehicle_code": "REM-001",
        }
        body = {
            "lat": 38.0,
            "lng": 23.0,
            "speed": 10,
            "bus_plate": "REM-001",
            "tenant_id": DEMO_TENANT,
            "timestamp": int(time.time() * 1000),
        }
        process = AsyncMock()
        with (
            patch("travel_platform.telemetry.fleet_ingress.process_telemetry_payload", process),
            patch("travel_platform.telemetry.fleet_ingress.publish_fleet_location", AsyncMock()),
            patch.object(get_fleet_egress_hub(), "broadcast", AsyncMock()),
            patch(
                "travel_platform.operations.master_qr_bridge.resolve_platform_tenant_id",
                new=AsyncMock(return_value=platform),
            ),
        ):
            result = await ingest_driver_location(body, session=session)

        self.assertTrue(result["ok"])
        self.assertEqual(result["tenant_id"], platform)
        payload = process.await_args.args[0]
        self.assertEqual(payload["tenant_id"], platform)


class FleetTelemetryWebSocketTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import api.ws_telemetry as ws_mod

        cls._orig_secrets = ws_mod._jwt_secrets
        ws_mod._jwt_secrets = lambda: [TEST_JWT_SECRET]
        cls.ws_mod = ws_mod
        cls.app = FastAPI()
        cls.app.include_router(ws_mod.router)
        cls.client = TestClient(cls.app)
        cls.tenant_uuid = DEMO_TENANT

    @classmethod
    def tearDownClass(cls):
        cls.ws_mod._jwt_secrets = cls._orig_secrets

    def test_ingress_rejects_invalid_token(self):
        with self.client.websocket_connect("/ws/telemetry/ingress?token=not-a-jwt") as ws:
            msg = ws.receive_json()
            self.assertEqual(msg.get("type"), "error")
            with self.assertRaises(WebSocketDisconnect) as ctx:
                ws.receive_json()
            self.assertEqual(ctx.exception.code, 4401)

    def test_ingress_ack_and_egress_location(self):
        token = _driver_session_token()
        with self.client.websocket_connect(f"/ws/telemetry/ingress?token={token}") as ingress:
            ready = ingress.receive_json()
            self.assertEqual(ready["type"], "ready")
            self.assertEqual(ready["trip_id"], 42)

            with self.client.websocket_connect(f"/ws/telemetry/egress/{self.tenant_uuid}") as egress:
                snapshot = egress.receive_json()
                self.assertEqual(snapshot["type"], "fleet_snapshot")
                self.assertIsInstance(snapshot.get("vehicles"), list)

                ingress.send_json(
                    {
                        "lat": 38.246,
                        "lng": 21.735,
                        "speed": 62,
                        "heading": 45,
                        "driver_id": "driver-test-1",
                        "tenant_id": DEMO_TENANT,
                        "bus_plate": "XAH-4021",
                        "driver_name": "Nikos Test",
                        "timestamp": int(time.time() * 1000),
                    },
                )
                ack = ingress.receive_json()
                self.assertEqual(ack["type"], "ack")
                self.assertTrue(ack.get("ok"))

                update = egress.receive_json()
                self.assertEqual(update["type"], "fleet_location")
                self.assertAlmostEqual(update["lat"], 38.246, places=3)
                self.assertAlmostEqual(update["lng"], 21.735, places=3)
                self.assertEqual(update["driver_name"], "Nikos Test")

    def test_egress_pong_on_ping(self):
        with self.client.websocket_connect(f"/ws/telemetry/egress/{self.tenant_uuid}") as ws:
            ws.receive_json()
            ws.send_text("ping")
            pong = json.loads(ws.receive_text())
            self.assertEqual(pong["type"], "pong")


if __name__ == "__main__":
    unittest.main()
