"""Rental ID / driving license validation + verification status."""

from __future__ import annotations

import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import travel_platform.rental.rental_store as store


class RentalIdentityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "rental_store.json"
        self._patch = patch.object(store, "STORE_FILE", self.path)
        self._patch.start()
        self.tid = "11111111-1111-1111-1111-111111111111"

    def tearDown(self) -> None:
        self._patch.stop()
        self.tmp.cleanup()

    def _vehicle(self):
        return store.upsert_vehicle(
            self.tid,
            {
                "plate_number": "ID-001",
                "category": "CAR",
                "model": "Yaris",
                "seating_capacity": 5,
                "daily_rate_eur": 40,
            },
        )

    def test_wallet_self_drive_requires_docs(self) -> None:
        v = self._vehicle()
        with self.assertRaises(ValueError) as ctx:
            store.create_booking(
                self.tid,
                {
                    "vehicle_id": v["id"],
                    "client_name": "Νίκος",
                    "client_email": "n@example.com",
                    "channel": "WALLET",
                    "driver_mode": "SELF_DRIVE",
                    "start_time": "2026-09-01T10:00:00+00:00",
                    "end_time": "2026-09-03T10:00:00+00:00",
                    "pickup_location": "Γραφείο",
                },
            )
        self.assertIn("ταυτότητας", str(ctx.exception).lower())

    def test_underage_rejected(self) -> None:
        v = self._vehicle()
        with self.assertRaises(ValueError) as ctx:
            store.create_booking(
                self.tid,
                {
                    "vehicle_id": v["id"],
                    "client_name": "Νέος",
                    "client_email": "young@example.com",
                    "channel": "WALLET",
                    "driver_mode": "SELF_DRIVE",
                    "start_time": "2026-09-01T10:00:00+00:00",
                    "end_time": "2026-09-03T10:00:00+00:00",
                    "pickup_location": "Γραφείο",
                    "id_document_url": "/api/site/rental-id/id-test.jpg",
                    "driving_license_url": "/api/site/rental-id/license-test.jpg",
                    "date_of_birth": "2010-01-01",
                    "license_number": "AB123",
                    "license_expires_at": "2030-01-01",
                },
            )
        self.assertIn("ηλικία", str(ctx.exception).lower())

    def test_expired_license_rejected(self) -> None:
        v = self._vehicle()
        with self.assertRaises(ValueError) as ctx:
            store.create_booking(
                self.tid,
                {
                    "vehicle_id": v["id"],
                    "client_name": "Μαρία",
                    "client_email": "m@example.com",
                    "channel": "WALLET",
                    "driver_mode": "SELF_DRIVE",
                    "start_time": "2026-09-01T10:00:00+00:00",
                    "end_time": "2026-09-10T10:00:00+00:00",
                    "pickup_location": "Γραφείο",
                    "id_document_url": "/api/site/rental-id/id-test.jpg",
                    "driving_license_url": "/api/site/rental-id/license-test.jpg",
                    "date_of_birth": "1990-05-05",
                    "license_number": "XY999",
                    "license_expires_at": "2026-09-05",
                },
            )
        self.assertIn("δίπλωμα", str(ctx.exception).lower())

    def test_valid_identity_pending_then_verified(self) -> None:
        v = self._vehicle()
        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Άννα",
                "client_email": "anna@example.com",
                "channel": "WALLET",
                "driver_mode": "SELF_DRIVE",
                "start_time": "2026-09-01T10:00:00+00:00",
                "end_time": "2026-09-03T10:00:00+00:00",
                "pickup_location": "Γραφείο",
                "id_document_url": "/api/site/rental-id/id-ok.jpg",
                "driving_license_url": "/api/site/rental-id/license-ok.jpg",
                "date_of_birth": "1995-03-15",
                "license_number": "DL-7788",
                "license_expires_at": "2029-12-31",
            },
        )
        self.assertEqual(booking["id_verification_status"], "pending")
        self.assertEqual(booking["license_number"], "DL-7788")
        verified = store.update_id_verification(self.tid, booking["id"], "verified")
        self.assertEqual(verified["id_verification_status"], "verified")

    def test_with_driver_skips_docs(self) -> None:
        v = self._vehicle()
        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Γιώργος",
                "client_email": "g@example.com",
                "channel": "WALLET",
                "driver_mode": "WITH_DRIVER",
                "start_time": "2026-10-01T10:00:00+00:00",
                "end_time": "2026-10-02T10:00:00+00:00",
                "pickup_location": "Αεροδρόμιο",
            },
        )
        self.assertEqual(booking["id_verification_status"], "not_required")

    def test_age_helper(self) -> None:
        dob = datetime(2000, 7, 27, tzinfo=timezone.utc)
        on = datetime(2026, 7, 27, tzinfo=timezone.utc)
        self.assertEqual(store._age_years(dob, on=on), 26)
        on2 = datetime(2026, 7, 26, tzinfo=timezone.utc)
        self.assertEqual(store._age_years(dob, on=on2), 25)


if __name__ == "__main__":
    unittest.main()
