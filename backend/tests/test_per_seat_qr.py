"""Unit tests for per-seat boarding helpers + rotating JWT seat claim."""

from __future__ import annotations

import unittest

from ticketing.qr_rotating import issue_rotating_jwt, verify_rotating_jwt
from ticketing.seat_boarding import (
    boarded_seats_from_spec,
    booking_seat_codes,
    normalize_seat,
    passenger_name_for_seat,
)


class SeatBoardingHelperTests(unittest.TestCase):
    def test_normalize_and_codes_from_passengers(self):
        booking = {
            "seat_number": "5A, 5B",
            "customer_name": "Μαρία",
            "special_requirements": {
                "passengers": [
                    {"seat": "5A", "name": "Μαρία", "role": "booker"},
                    {"seat": "5B", "name": "Γιάννης", "role": "companion"},
                ]
            },
        }
        self.assertEqual(booking_seat_codes(booking), ["5A", "5B"])
        self.assertEqual(passenger_name_for_seat(booking, "5b"), "Γιάννης")
        self.assertEqual(normalize_seat(" 5b "), "5B")
        self.assertEqual(boarded_seats_from_spec({"boarded_seats": ["5A"]}), ["5A"])

    def test_rotating_jwt_includes_optional_seat(self):
        issued = issue_rotating_jwt("ref-xyz", 7, seat="2C")
        payload, err = verify_rotating_jwt(issued["token"])
        self.assertIsNone(err)
        self.assertEqual(payload["ref"], "ref-xyz")
        self.assertEqual(payload["tid"], 7)
        self.assertEqual(payload.get("seat"), "2C")
        self.assertEqual(issued.get("seat"), "2C")

    def test_rotating_jwt_omits_seat_when_empty(self):
        issued = issue_rotating_jwt("ref-xyz", 7)
        payload, err = verify_rotating_jwt(issued["token"])
        self.assertIsNone(err)
        self.assertNotIn("seat", payload)


if __name__ == "__main__":
    unittest.main()
