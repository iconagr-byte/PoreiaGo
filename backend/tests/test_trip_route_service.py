"""trip_route_service — PostGIS route playback queries."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from travel_platform.telemetry.trip_route_service import _row_to_point, fetch_trip_route

DEMO_TENANT = "00000000-0000-0000-0000-000000000001"


class TripRoutePointTests(unittest.TestCase):
    def test_row_to_point_maps_coordinates(self):
        row = {
            "id": 7,
            "trip_id": 42,
            "driver_id": None,
            "vehicle_id": None,
            "recorded_at": datetime(2026, 6, 9, 12, 0, tzinfo=timezone.utc),
            "speed_kmh": 55.5,
            "heading_deg": 90.0,
            "lat": 38.246,
            "lng": 21.735,
        }
        point = _row_to_point(row)
        self.assertEqual(point["id"], 7)
        self.assertAlmostEqual(point["lat"], 38.246)
        self.assertAlmostEqual(point["lng"], 21.735)
        self.assertEqual(point["speed_kmh"], 55.5)


class FetchTripRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_fetch_returns_empty_on_db_error(self):
        session = AsyncMock()
        session.execute = AsyncMock(side_effect=RuntimeError("no table"))

        result = await fetch_trip_route(
            session,
            tenant_id=__import__("uuid").UUID(DEMO_TENANT),
            trip_id=1,
        )
        self.assertEqual(result["point_count"], 0)
        self.assertEqual(result["points"], [])
        self.assertEqual(result["error"], "database_unavailable")

    async def test_fetch_maps_rows(self):
        row = {
            "id": 1,
            "trip_id": 5,
            "driver_id": None,
            "vehicle_id": None,
            "recorded_at": datetime(2026, 6, 9, 10, 0, tzinfo=timezone.utc),
            "speed_kmh": 40,
            "heading_deg": None,
            "lat": 38.1,
            "lng": 23.7,
        }

        mapping = MagicMock()
        mapping.all.return_value = [row]

        result_mock = MagicMock()
        result_mock.mappings.return_value = mapping

        session = AsyncMock()
        session.execute = AsyncMock(return_value=result_mock)

        payload = await fetch_trip_route(
            session,
            tenant_id=__import__("uuid").UUID(DEMO_TENANT),
            trip_id=5,
            limit=100,
        )
        self.assertEqual(payload["point_count"], 1)
        self.assertEqual(payload["trip_id"], 5)
        self.assertAlmostEqual(payload["points"][0]["lat"], 38.1)


if __name__ == "__main__":
    unittest.main()
