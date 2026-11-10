"""Rental desk QR verify (`RENT:{booking_id}`)."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import travel_platform.rental.rental_store as store


class RentalQrVerifyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "rental_store.json"
        self._patch = patch.object(store, "STORE_FILE", self.path)
        self._patch.start()
        self.tid = "11111111-1111-1111-1111-111111111111"

    def tearDown(self) -> None:
        self._patch.stop()
        self.tmp.cleanup()

    def _booking(self):
        v = store.upsert_vehicle(
            self.tid,
            {
                "plate_number": "QR-001",
                "category": "CAR",
                "model": "Yaris",
                "seating_capacity": 5,
                "daily_rate_eur": 40,
            },
        )
        return store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Νίκος",
                "client_email": "n@example.com",
                "start_time": "2026-12-01T10:00:00+00:00",
                "end_time": "2026-12-02T10:00:00+00:00",
                "pickup_location": "Γραφείο",
            },
        )

    def test_parse_rent_prefix_and_bare(self) -> None:
        self.assertEqual(store.parse_rental_qr_code("RENT:abc-123"), "abc-123")
        self.assertEqual(store.parse_rental_qr_code("rent:XYZ"), "XYZ")
        self.assertEqual(store.parse_rental_qr_code("plain-id"), "plain-id")
        with self.assertRaises(ValueError):
            store.parse_rental_qr_code("RENT:")
        with self.assertRaises(ValueError):
            store.parse_rental_qr_code("  ")

    def test_verify_checkin_eligible(self) -> None:
        booking = self._booking()
        result = store.verify_rental_qr(self.tid, f"RENT:{booking['id']}")
        self.assertTrue(result["ok"])
        self.assertTrue(result["eligible_checkin"])
        self.assertFalse(result["eligible_checkout"])
        self.assertEqual(result["booking"]["id"], booking["id"])
        self.assertIn("check-in", result["reason"].lower())

    def test_verify_checkout_after_pickup(self) -> None:
        booking = self._booking()
        store.create_inspection(
            self.tid,
            {
                "rental_booking_id": booking["id"],
                "inspection_type": "PICKUP_CHECK",
                "fuel_level": 80,
                "mileage": 1000,
            },
        )
        result = store.verify_rental_qr(self.tid, booking["id"])
        self.assertTrue(result["eligible_checkout"])
        self.assertFalse(result["eligible_checkin"])

    def test_verify_missing(self) -> None:
        with self.assertRaises(ValueError):
            store.verify_rental_qr(self.tid, "RENT:does-not-exist")


if __name__ == "__main__":
    unittest.main()
