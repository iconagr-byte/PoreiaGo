"""Tests for driver GPS ingress rate limiting."""

from __future__ import annotations

import os
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from travel_platform.telemetry.ingress_rate_limit import (
    check_driver_gps_rate_limit,
    driver_ingress_key,
    reset_driver_ingress_rate_limits,
)


class IngressRateLimitTests(unittest.TestCase):
    def setUp(self) -> None:
        reset_driver_ingress_rate_limits()

    def tearDown(self) -> None:
        reset_driver_ingress_rate_limits()

    def test_driver_ingress_key_from_session_and_body(self) -> None:
        session = {"tenant_id": "t1", "sub": "d1", "trip_id": 9}
        body = {"lat": 1, "lng": 2}
        self.assertEqual(driver_ingress_key(session=session, body=body), "t1:d1:9")

    def test_allows_up_to_max_per_minute(self) -> None:
        session = {"tenant_id": "tenant-a", "sub": "drv", "trip_id": 1}
        body = {}
        for _ in range(5):
            result = check_driver_gps_rate_limit(
                tenant_id="tenant-a",
                session=session,
                body=body,
                max_per_minute=5,
            )
            self.assertTrue(result.allowed)

        blocked = check_driver_gps_rate_limit(
            tenant_id="tenant-a",
            session=session,
            body=body,
            max_per_minute=5,
        )
        self.assertFalse(blocked.allowed)
        self.assertIsNotNone(blocked.retry_after_sec)
        self.assertGreater(blocked.retry_after_sec, 0)

    def test_zero_max_disables_limit(self) -> None:
        session = {"tenant_id": "tenant-b", "sub": "drv", "trip_id": 1}
        body = {}
        for _ in range(20):
            result = check_driver_gps_rate_limit(
                tenant_id="tenant-b",
                session=session,
                body=body,
                max_per_minute=0,
            )
            self.assertTrue(result.allowed)

    def test_different_drivers_have_separate_buckets(self) -> None:
        body = {}
        for driver in ("drv-1", "drv-2"):
            session = {"tenant_id": "tenant-c", "sub": driver, "trip_id": 1}
            for _ in range(3):
                result = check_driver_gps_rate_limit(
                    tenant_id="tenant-c",
                    session=session,
                    body=body,
                    max_per_minute=3,
                )
                self.assertTrue(result.allowed)
            blocked = check_driver_gps_rate_limit(
                tenant_id="tenant-c",
                session=session,
                body=body,
                max_per_minute=3,
            )
            self.assertFalse(blocked.allowed)


class IngestRateLimitIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        reset_driver_ingress_rate_limits()
        from travel_platform.telemetry.settings_store import update_telemetry_settings

        update_telemetry_settings({"driver_gps_max_per_minute": 2})

    async def asyncTearDown(self) -> None:
        reset_driver_ingress_rate_limits()
        from travel_platform.telemetry.settings_store import update_telemetry_settings

        update_telemetry_settings({"driver_gps_max_per_minute": 60})

    async def test_ingest_returns_rate_limited_without_processing(self) -> None:
        from travel_platform.telemetry.fleet_ingress import ingest_driver_location

        session = {
            "tenant_id": str(uuid4()),
            "trip_id": 1,
            "sub": "drv-limit",
            "driver_name": "Limit Driver",
            "vehicle_code": "LIM-001",
        }
        body = {
            "lat": 37.98,
            "lng": 23.73,
            "speed": 40,
            "heading": 90,
            "bus_plate": "LIM-001",
        }

        process = AsyncMock()
        with patch("travel_platform.telemetry.fleet_ingress.process_telemetry_payload", process):
            first = await ingest_driver_location(body, session=session)
            second = await ingest_driver_location(body, session=session)
            third = await ingest_driver_location(body, session=session)

        self.assertTrue(first["ok"])
        self.assertTrue(second["ok"])
        self.assertFalse(third["ok"])
        self.assertTrue(third["rate_limited"])
        self.assertEqual(process.await_count, 2)

    async def test_rate_limited_increments_metric(self) -> None:
        os.environ["METRICS_ENABLED"] = "true"
        import travel_platform.telemetry.fleet_metrics as fm

        fm._ENABLED = None
        from travel_platform.telemetry.fleet_metrics import FLEET_GPS_RATE_LIMITED_TOTAL
        from travel_platform.telemetry.fleet_ingress import ingest_driver_location

        tid = str(uuid4())
        session = {"tenant_id": tid, "trip_id": 1, "sub": "drv-metric"}
        body = {"lat": 1.0, "lng": 2.0, "speed": 10}

        from travel_platform.telemetry.fleet_ws_hub import get_fleet_egress_hub

        hub = get_fleet_egress_hub()
        with (
            patch("travel_platform.telemetry.fleet_ingress.process_telemetry_payload", AsyncMock()),
            patch("travel_platform.telemetry.fleet_ingress.publish_fleet_location", AsyncMock()),
            patch.object(hub, "broadcast", AsyncMock()),
        ):
            await ingest_driver_location(body, session=session)
            await ingest_driver_location(body, session=session)
            before = FLEET_GPS_RATE_LIMITED_TOTAL.labels(tenant_id=tid)._value.get()
            await ingest_driver_location(body, session=session)
            after = FLEET_GPS_RATE_LIMITED_TOTAL.labels(tenant_id=tid)._value.get()

        self.assertEqual(after, before + 1.0)
        os.environ.pop("METRICS_ENABLED", None)
        fm._ENABLED = None


if __name__ == "__main__":
    unittest.main()
