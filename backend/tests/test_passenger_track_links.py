"""Tests for passenger track link builder."""

import unittest

from travel_platform.telemetry.passenger_track_links import (
    DEMO_TENANT,
    build_passenger_track_link,
    enrich_booking_passenger_track,
    resolve_booking_trip_id,
)


class PassengerTrackLinkBuilderTests(unittest.TestCase):
    def test_resolve_trip_id(self) -> None:
        self.assertEqual(resolve_booking_trip_id({"tripId": 5}), 5)
        self.assertIsNone(resolve_booking_trip_id({}))

    def test_build_link_contains_track_path(self) -> None:
        link = build_passenger_track_link(trip_id=9, tenant_id=DEMO_TENANT, frontend_base="https://app.test")
        self.assertIsNotNone(link)
        assert link is not None
        self.assertIn("/track/trip/9", link["url"])
        self.assertIn("token=", link["url"])

    def test_enrich_booking(self) -> None:
        out = enrich_booking_passenger_track({"id": "b1", "tripId": 3})
        self.assertIn("passengerTrackUrl", out)
        self.assertIn("/track/trip/3", out["passengerTrackUrl"])


if __name__ == "__main__":
    unittest.main()
