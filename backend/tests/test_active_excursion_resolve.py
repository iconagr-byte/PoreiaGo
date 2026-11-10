"""Active excursion matching for live-map bus labels."""

from __future__ import annotations

import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

from travel_platform.telemetry.active_excursion_resolve import (
    normalize_plate,
    resolve_active_excursion,
    trip_is_active_now,
)

_ATHENS = ZoneInfo("Europe/Athens")


class ActiveExcursionResolveTests(unittest.TestCase):
    def test_normalize_plate(self):
        self.assertEqual(normalize_plate("ee x-5670"), "EEX5670")

    def test_trip_window_same_day(self):
        trip = {
            "status": "published",
            "departureTime": "2026-09-29T08:00:00",
            "arrivalTime": "",
        }
        now = datetime(2026, 9, 29, 12, 0, tzinfo=_ATHENS)
        self.assertTrue(trip_is_active_now(trip, now=now))
        early = datetime(2026, 9, 29, 3, 0, tzinfo=_ATHENS)
        self.assertFalse(trip_is_active_now(trip, now=early))

    def test_resolve_by_plate(self):
        trips = [
            {
                "id": 42,
                "title": "Μετέωρα",
                "status": "published",
                "departureTime": "2026-09-29T08:00:00",
                "arrivalTime": "2026-09-29T20:00:00",
                "vehiclePlate": "EEX5670",
            }
        ]

        import travel_platform.operations.tenant_trip_catalog_store as catalog

        prev = catalog.list_tenant_trips

        def _fake(tid, published_only=True):
            self.assertEqual(tid, "tenant-a")
            return trips

        catalog.list_tenant_trips = _fake
        try:
            hit = resolve_active_excursion(
                "tenant-a",
                vehicle_code="EEX5670",
                now=datetime(2026, 9, 29, 12, 0, tzinfo=_ATHENS),
            )
            self.assertIsNotNone(hit)
            self.assertEqual(hit["trip_id"], 42)
            self.assertEqual(hit["title"], "Μετέωρα")
        finally:
            catalog.list_tenant_trips = prev

    def test_no_match_wrong_plate(self):
        import travel_platform.operations.tenant_trip_catalog_store as catalog

        prev = catalog.list_tenant_trips
        catalog.list_tenant_trips = lambda *_a, **_k: [
            {
                "id": 1,
                "title": "Other",
                "status": "published",
                "departureTime": "2026-09-29T08:00:00",
                "arrivalTime": "2026-09-29T20:00:00",
                "vehiclePlate": "AAA1111",
            }
        ]
        try:
            hit = resolve_active_excursion(
                "tenant-a",
                vehicle_code="EEX5670",
                now=datetime(2026, 9, 29, 12, 0, tzinfo=_ATHENS),
            )
            self.assertIsNone(hit)
        finally:
            catalog.list_tenant_trips = prev


if __name__ == "__main__":
    unittest.main()
