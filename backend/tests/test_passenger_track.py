"""Tests for public passenger track link."""

from __future__ import annotations

import os
import time
import unittest
from unittest.mock import AsyncMock, patch
from uuid import UUID

import jwt

from travel_platform.telemetry.passenger_track_token import (
    create_passenger_track_token,
    verify_passenger_track_token,
)

DEMO_TENANT = UUID("00000000-0000-0000-0000-000000000001")
TEST_SECRET = "dev-jwt-secret-change-in-prod-32bytes!!"


class PassengerTrackTokenTests(unittest.TestCase):
    def setUp(self) -> None:
        os.environ["AUTH_JWT_SECRET"] = TEST_SECRET
        import travel_platform.telemetry.passenger_track_token as ptt

        ptt.JWT_SECRET = TEST_SECRET

    def test_create_and_verify_token(self) -> None:
        from travel_platform.telemetry.passenger_track_token import (
            create_passenger_track_token,
            verify_passenger_track_token,
        )

        token = create_passenger_track_token(trip_id=42, tenant_id=DEMO_TENANT, ttl_hours=2)
        payload = verify_passenger_track_token(token, trip_id=42)
        self.assertEqual(payload["tenant_id"], str(DEMO_TENANT))
        self.assertEqual(int(payload["trip_id"]), 42)

    def test_rejects_trip_mismatch(self) -> None:
        from travel_platform.telemetry.passenger_track_token import (
            create_passenger_track_token,
            verify_passenger_track_token,
        )

        token = create_passenger_track_token(trip_id=42, tenant_id=DEMO_TENANT)
        with self.assertRaises(jwt.InvalidTokenError):
            verify_passenger_track_token(token, trip_id=99)


class PassengerTrackServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_fetch_track_merges_live_and_eta(self) -> None:
        from datetime import datetime, timezone
        from types import SimpleNamespace

        from travel_platform.telemetry.passenger_track_service import fetch_passenger_track

        vehicle = SimpleNamespace(
            vehicle_id="veh-1",
            vehicle_code="BUS-1",
            trip_id=7,
            lat=38.0,
            lng=23.0,
            speed_kmh=50.0,
            updated_at=datetime.now(timezone.utc),
        )
        snap = SimpleNamespace(
            next_stop_name="Λάρισα",
            eta_seconds=600,
            distance_m=10000,
            traffic_level="light",
            traffic_label="Ελαφριά κίνηση",
            vehicle_lat=38.0,
            vehicle_lng=23.0,
            computed_at=datetime.now(timezone.utc),
        )

        live = SimpleNamespace(
            list_active=lambda _tid: [vehicle],
            _vehicles={"veh-1": {"bus_plate": "XAH-1", "driver_name": "Nikos", "heading_deg": 90}},
        )

        with (
            patch("travel_platform.telemetry.passenger_track_service.get_live_fleet", return_value=live),
            patch(
                "travel_platform.telemetry.passenger_track_service.resolve_eta_snapshot",
                new=AsyncMock(return_value=snap),
            ),
        ):
            data = await fetch_passenger_track(trip_id=7, tenant_id=DEMO_TENANT)

        self.assertTrue(data["online"])
        self.assertEqual(data["bus_plate"], "XAH-1")
        self.assertEqual(data["next_stop_name"], "Λάρισα")


if __name__ == "__main__":
    unittest.main()
