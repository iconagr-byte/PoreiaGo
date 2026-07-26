"""Fleet rental availability conflict engine + booking lifecycle."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import travel_platform.rental.rental_store as store


class FleetRentalStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "rental_store.json"
        self._patch = patch.object(store, "STORE_FILE", self.path)
        self._patch.start()
        self.tid = "11111111-1111-1111-1111-111111111111"

    def tearDown(self) -> None:
        self._patch.stop()
        self.tmp.cleanup()

    def _vehicle(self, **extra):
        body = {
            "plate_number": "ΡΕΝΤ-001",
            "category": "VAN",
            "model": "Ford Transit",
            "seating_capacity": 9,
            "daily_rate_eur": 90,
            "current_status": "AVAILABLE",
        }
        body.update(extra)
        return store.upsert_vehicle(self.tid, body)

    def test_conflict_blocks_double_booking(self) -> None:
        v = self._vehicle()
        store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Νίκος",
                "start_time": "2026-08-01T10:00:00+00:00",
                "end_time": "2026-08-03T10:00:00+00:00",
                "pickup_location": "Αθήνα",
            },
        )
        with self.assertRaises(ValueError):
            store.create_booking(
                self.tid,
                {
                    "vehicle_id": v["id"],
                    "client_name": "Μαρία",
                    "start_time": "2026-08-02T10:00:00+00:00",
                    "end_time": "2026-08-04T10:00:00+00:00",
                    "pickup_location": "Αθήνα",
                },
            )

    def test_availability_prefers_seat_fit(self) -> None:
        store.upsert_vehicle(
            self.tid,
            {
                "plate_number": "CAR-1",
                "category": "CAR",
                "model": "Yaris",
                "seating_capacity": 5,
                "daily_rate_eur": 40,
            },
        )
        store.upsert_vehicle(
            self.tid,
            {
                "plate_number": "VAN-1",
                "category": "VAN",
                "model": "Transit",
                "seating_capacity": 9,
                "daily_rate_eur": 90,
            },
        )
        store.upsert_vehicle(
            self.tid,
            {
                "plate_number": "BUS-1",
                "category": "MINIBUS",
                "model": "Sprinter",
                "seating_capacity": 20,
                "daily_rate_eur": 160,
            },
        )
        rows = store.check_availability(
            self.tid,
            start_time="2026-09-01T08:00:00+00:00",
            end_time="2026-09-02T08:00:00+00:00",
            min_seats=8,
        )
        self.assertGreaterEqual(len(rows), 2)
        self.assertEqual(rows[0]["plate_number"], "VAN-1")

    def test_inspection_completes_booking(self) -> None:
        v = self._vehicle()
        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Άννα",
                "start_time": "2026-08-10T10:00:00+00:00",
                "end_time": "2026-08-12T10:00:00+00:00",
                "pickup_location": "Γραφείο",
            },
        )
        store.create_inspection(
            self.tid,
            {
                "rental_booking_id": booking["id"],
                "inspection_type": "PICKUP_CHECK",
                "fuel_level": 90,
                "mileage": 12000,
            },
        )
        store.create_inspection(
            self.tid,
            {
                "rental_booking_id": booking["id"],
                "inspection_type": "RETURN_CHECK",
                "fuel_level": 40,
                "mileage": 12450,
            },
        )
        bookings = store.list_bookings(self.tid)
        self.assertEqual(bookings[0]["rental_status"], "COMPLETED")
        vehicle = store.get_vehicle(self.tid, v["id"])
        self.assertEqual(vehicle["current_status"], "AVAILABLE")
        self.assertEqual(vehicle["current_mileage"], 12450)


if __name__ == "__main__":
    unittest.main()
