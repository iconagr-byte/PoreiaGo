"""coordinate_flush_worker — safe UUID coercion for driver GPS history."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from travel_platform.telemetry.coordinate_buffer import (
    BufferedCoordinate,
    clear_buffer_for_tests,
    peek_matching,
    push_coordinate,
)
from travel_platform.telemetry.coordinate_flush_worker import _as_uuid_or_none, flush_coordinates_batch
from travel_platform.telemetry.trip_route_service import fetch_trip_route

DEMO_TENANT = "00000000-0000-0000-0000-000000000001"


class UuidCoercionTests(unittest.TestCase):
    def test_accepts_uuid_and_rejects_legacy_keys(self):
        self.assertEqual(
            _as_uuid_or_none("a1000000-0000-4000-8000-000000000001"),
            "a1000000-0000-4000-8000-000000000001",
        )
        self.assertIsNone(_as_uuid_or_none("master-qr-driver"))
        self.assertIsNone(_as_uuid_or_none("driver-e2e"))
        self.assertIsNone(_as_uuid_or_none(""))
        self.assertIsNone(_as_uuid_or_none(None))


class BufferPeekTests(unittest.TestCase):
    def setUp(self):
        clear_buffer_for_tests()

    def tearDown(self):
        clear_buffer_for_tests()

    def test_peek_matching_filters_by_trip_and_driver(self):
        now = datetime.now(timezone.utc)
        push_coordinate(
            BufferedCoordinate(
                tenant_id=DEMO_TENANT,
                trip_id=42,
                driver_id="master-qr-driver",
                vehicle_id=None,
                lat=38.1,
                lng=23.7,
                speed_kmh=40,
                heading_deg=90,
                recorded_at=now,
                raw={"driver_id": "master-qr-driver"},
            ),
        )
        push_coordinate(
            BufferedCoordinate(
                tenant_id=DEMO_TENANT,
                trip_id=99,
                driver_id="other",
                vehicle_id=None,
                lat=39.0,
                lng=22.0,
                speed_kmh=10,
                heading_deg=None,
                recorded_at=now,
                raw={"driver_id": "other"},
            ),
        )
        matched = peek_matching(tenant_id=DEMO_TENANT, trip_id=42, driver_id="master-qr-driver")
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0].trip_id, 42)


class FlushBatchTests(unittest.IsolatedAsyncioTestCase):
    async def test_flush_passes_null_for_non_uuid_driver(self):
        clear_buffer_for_tests()
        now = datetime.now(timezone.utc)
        push_coordinate(
            BufferedCoordinate(
                tenant_id=DEMO_TENANT,
                trip_id=7,
                driver_id="master-qr-driver",
                vehicle_id="not-a-uuid",
                lat=38.2,
                lng=23.8,
                speed_kmh=50,
                heading_deg=10,
                recorded_at=now,
                raw={"driver_id": "master-qr-driver", "source": "driver_pwa"},
            ),
        )

        session = AsyncMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        session.__aenter__ = AsyncMock(return_value=session)
        session.__aexit__ = AsyncMock(return_value=None)

        session_factory = MagicMock(return_value=session)

        with patch(
            "travel_platform.telemetry.coordinate_flush_worker.AsyncSessionLocal",
            session_factory,
            create=True,
        ):
            # Prefer app.core.database import path used in production.
            with patch.dict("sys.modules", {}):
                pass
            with patch(
                "app.core.database.AsyncSessionLocal",
                session_factory,
            ):
                inserted = await flush_coordinates_batch()

        self.assertEqual(inserted, 1)
        kwargs = session.execute.await_args.args[1]
        self.assertIsNone(kwargs["driver_id"])
        self.assertIsNone(kwargs["vehicle_id"])
        self.assertEqual(kwargs["trip_id"], 7)
        clear_buffer_for_tests()


class FetchMergesLiveBufferTests(unittest.IsolatedAsyncioTestCase):
    async def test_fetch_includes_pending_buffer_points(self):
        clear_buffer_for_tests()
        now = datetime.now(timezone.utc)
        push_coordinate(
            BufferedCoordinate(
                tenant_id=DEMO_TENANT,
                trip_id=5,
                driver_id="driver-e2e",
                vehicle_id=None,
                lat=38.5,
                lng=23.1,
                speed_kmh=33,
                heading_deg=None,
                recorded_at=now,
                raw={"driver_id": "driver-e2e"},
            ),
        )

        session = AsyncMock()
        session.execute = AsyncMock(side_effect=RuntimeError("no table"))

        payload = await fetch_trip_route(
            session,
            tenant_id=__import__("uuid").UUID(DEMO_TENANT),
            trip_id=5,
            driver_id="driver-e2e",
        )
        self.assertEqual(payload["point_count"], 1)
        self.assertEqual(payload["points"][0]["source"], "live_buffer")
        self.assertAlmostEqual(payload["points"][0]["lat"], 38.5)
        clear_buffer_for_tests()


if __name__ == "__main__":
    unittest.main()
