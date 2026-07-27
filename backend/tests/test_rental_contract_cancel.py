"""Rental contract acceptance + free-cancel 24h window."""

from __future__ import annotations

import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import travel_platform.rental.rental_store as store


class RentalContractCancelTests(unittest.TestCase):
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
                "plate_number": "CTR-001",
                "category": "CAR",
                "model": "Yaris",
                "seating_capacity": 5,
                "daily_rate_eur": 40,
            },
        )

    def test_wallet_requires_contract(self) -> None:
        v = self._vehicle()
        with self.assertRaises(ValueError) as ctx:
            store.create_booking(
                self.tid,
                {
                    "vehicle_id": v["id"],
                    "client_name": "Νίκος",
                    "client_email": "n@example.com",
                    "channel": "WALLET",
                    "driver_mode": "WITH_DRIVER",
                    "start_time": "2026-11-01T10:00:00+00:00",
                    "end_time": "2026-11-02T10:00:00+00:00",
                    "pickup_location": "Γραφείο",
                },
            )
        self.assertIn("όρων", str(ctx.exception).lower())

    def test_wallet_contract_saved(self) -> None:
        v = self._vehicle()
        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Άννα",
                "client_email": "a@example.com",
                "channel": "WALLET",
                "driver_mode": "SELF_DRIVE",
                "start_time": "2026-11-01T10:00:00+00:00",
                "end_time": "2026-11-02T10:00:00+00:00",
                "pickup_location": "Γραφείο",
                "id_document_url": "/api/site/rental-id/id-anna.jpg",
                "driving_license_url": "/api/site/rental-id/lic-anna.jpg",
                "date_of_birth": "1990-01-01",
                "license_number": "CT-1",
                "license_expires_at": "2030-01-01",
                "contract_accepted": True,
                "contract_signature_url": "/api/site/rental-photos/contract-anna.png",
                "contract_signer_name": "Άννα",
            },
        )
        self.assertTrue(booking["contract_accepted"])
        self.assertEqual(booking["contract_version"], store.CONTRACT_VERSION)
        self.assertTrue(booking["contract_signature_url"].endswith("contract-anna.png"))

    def test_free_cancel_ok_beyond_24h(self) -> None:
        v = self._vehicle()
        now = datetime(2026, 7, 27, 8, 0, tzinfo=timezone.utc)
        start = now + timedelta(hours=48)
        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Κώστας",
                "client_email": "k@example.com",
                "start_time": start.isoformat(),
                "end_time": (start + timedelta(days=1)).isoformat(),
                "pickup_location": "Γραφείο",
            },
        )
        self.assertTrue(store.free_cancel_eligible(booking, now=now))
        cancelled = store.cancel_booking_for_customer(
            self.tid, booking["id"], email="k@example.com", now=now
        )
        self.assertEqual(cancelled["rental_status"], "CANCELLED")

    def test_free_cancel_blocked_inside_24h(self) -> None:
        v = self._vehicle()
        now = datetime(2026, 7, 27, 8, 0, tzinfo=timezone.utc)
        start = now + timedelta(hours=12)
        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Μαρία",
                "client_email": "m@example.com",
                "start_time": start.isoformat(),
                "end_time": (start + timedelta(days=1)).isoformat(),
                "pickup_location": "Γραφείο",
            },
        )
        self.assertFalse(store.free_cancel_eligible(booking, now=now))
        with self.assertRaises(ValueError) as ctx:
            store.cancel_booking_for_customer(
                self.tid, booking["id"], email="m@example.com", now=now
            )
        self.assertIn("24", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
