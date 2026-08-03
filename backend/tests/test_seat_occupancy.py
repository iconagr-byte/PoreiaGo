"""Unit tests for excursion seat occupancy helpers."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from uuid import uuid4

from app.models.booking import BookingStatus
from app.services.seat_occupancy import (
    booking_matches_external_trip,
    conflicting_seats,
    normalize_seat_code,
    seats_from_booking,
)


class SeatOccupancyTests(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(normalize_seat_code(" 1a "), "1A")

    def test_seats_from_booking_meta_and_label(self):
        b = SimpleNamespace(
            metadata_json={"seats": ["1a", "2B"]},
            seat_label="3C, 4a",
        )
        self.assertEqual(seats_from_booking(b), {"1A", "2B", "3C", "4A"})

    def test_trip_match(self):
        b = SimpleNamespace(metadata_json={"external_trip_id": 42})
        self.assertTrue(booking_matches_external_trip(b, 42))
        self.assertFalse(booking_matches_external_trip(b, 7))

    def test_conflicts(self):
        self.assertEqual(conflicting_seats(["1a", "9Z"], {"1A", "2B"}), ["1A"])


if __name__ == "__main__":
    unittest.main()
