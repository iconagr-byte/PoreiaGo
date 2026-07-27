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

    def test_one_way_and_with_driver_pricing(self) -> None:
        v = self._vehicle(
            one_way_surcharge_eur=25,
            with_driver_daily_eur=40,
            daily_rate_eur=90,
        )
        rows = store.check_availability(
            self.tid,
            start_time="2026-10-01T10:00:00+00:00",
            end_time="2026-10-03T10:00:00+00:00",
            pickup_location="Αθήνα",
            dropoff_location="Θεσσαλονίκη",
            driver_mode="WITH_DRIVER",
        )
        hit = next(r for r in rows if r["id"] == v["id"])
        self.assertEqual(hit["suggested_days"], 2)
        self.assertEqual(hit["base_total"], 180.0)
        self.assertEqual(hit["driver_surcharge"], 80.0)
        self.assertEqual(hit["one_way_surcharge"], 25.0)
        self.assertEqual(hit["suggested_total"], 285.0)
        self.assertTrue(hit["is_one_way"])

        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Γιώργος",
                "client_email": "giorgos@example.com",
                "start_time": "2026-10-01T10:00:00+00:00",
                "end_time": "2026-10-03T10:00:00+00:00",
                "pickup_location": "Αθήνα",
                "dropoff_location": "Θεσσαλονίκη",
                "driver_mode": "WITH_DRIVER",
            },
        )
        self.assertEqual(booking["total_cost"], 285.0)
        mine = store.list_bookings_for_email(self.tid, "giorgos@example.com")
        self.assertEqual(len(mine), 1)

    def test_list_clients_aggregates_wallet_and_desk(self) -> None:
        v = self._vehicle(plate_number="ΡΕΝΤ-CL")
        store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Μαρία Wallet",
                "client_email": "maria@example.com",
                "channel": "WALLET",
                "start_time": "2026-12-10T10:00:00+00:00",
                "end_time": "2026-12-11T10:00:00+00:00",
                "pickup_location": "Γραφείο",
                "id_document_url": "/api/site/rental-id/id-maria.jpg",
                "driving_license_url": "/api/site/rental-id/lic-maria.jpg",
                "date_of_birth": "1992-01-01",
                "license_number": "ML-1",
                "license_expires_at": "2030-01-01",
                "contract_accepted": True,
                "contract_signature_url": "/api/site/rental-photos/contract-maria.png",
                "contract_signer_name": "Μαρία Wallet",
            },
        )
        store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Νίκος Desk",
                "client_phone": "6900000000",
                "channel": "DESK",
                "start_time": "2026-12-20T10:00:00+00:00",
                "end_time": "2026-12-21T10:00:00+00:00",
                "pickup_location": "Αεροδρόμιο",
            },
        )
        clients = store.list_clients(self.tid)
        self.assertEqual(len(clients), 2)
        emails = {c.get("client_email") for c in clients}
        self.assertIn("maria@example.com", emails)
        maria = next(c for c in clients if c.get("client_email") == "maria@example.com")
        self.assertIn("WALLET", maria["channels"])

    def test_customer_cancel_confirmed_only(self) -> None:
        v = self._vehicle(plate_number="ΡΕΝΤ-CXL")
        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Κώστας",
                "client_email": "kostas@example.com",
                "start_time": "2026-12-01T10:00:00+00:00",
                "end_time": "2026-12-02T10:00:00+00:00",
                "pickup_location": "Γραφείο",
            },
        )
        with self.assertRaises(ValueError):
            store.cancel_booking_for_customer(self.tid, booking["id"], email="other@example.com")
        cancelled = store.cancel_booking_for_customer(
            self.tid, booking["id"], email="kostas@example.com"
        )
        self.assertEqual(cancelled["rental_status"], "CANCELLED")
        vehicle = store.get_vehicle(self.tid, v["id"])
        self.assertEqual(vehicle["current_status"], "AVAILABLE")

        again = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Κώστας",
                "client_email": "kostas@example.com",
                "start_time": "2026-12-05T10:00:00+00:00",
                "end_time": "2026-12-06T10:00:00+00:00",
                "pickup_location": "Γραφείο",
            },
        )
        store.create_inspection(
            self.tid,
            {
                "rental_booking_id": again["id"],
                "inspection_type": "PICKUP_CHECK",
                "fuel_level": 80,
                "mileage": 1000,
            },
        )
        with self.assertRaises(ValueError):
            store.cancel_booking_for_customer(self.tid, again["id"], email="kostas@example.com")

    def test_active_rental_overlays(self) -> None:
        v = self._vehicle(gps_device_id="GPS-99", plate_number="ΡΕΝΤ-GPS")
        store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Ελένη",
                "start_time": "2026-11-01T10:00:00+00:00",
                "end_time": "2026-11-02T10:00:00+00:00",
                "pickup_location": "Γραφείο",
            },
        )
        overlays = store.active_rental_overlays(self.tid)
        self.assertEqual(len(overlays), 1)
        self.assertEqual(overlays[0]["gps_device_id"], "GPS-99")
        self.assertIn("Ελένη", overlays[0]["label"])

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
        pickup = store.create_inspection(
            self.tid,
            {
                "rental_booking_id": booking["id"],
                "inspection_type": "PICKUP_CHECK",
                "fuel_level": 90,
                "mileage": 12000,
                "signature_url": "/api/site/rental-photos/sig-in.png",
                "photo_urls": ["/api/site/rental-photos/dmg-1.jpg"],
            },
        )
        self.assertEqual(pickup["signature_url"], "/api/site/rental-photos/sig-in.png")
        self.assertEqual(pickup["photo_urls"], ["/api/site/rental-photos/dmg-1.jpg"])
        store.create_inspection(
            self.tid,
            {
                "rental_booking_id": booking["id"],
                "inspection_type": "RETURN_CHECK",
                "fuel_level": 40,
                "mileage": 12450,
                "signature_url": "/api/site/rental-photos/sig-out.png",
            },
        )
        bookings = store.list_bookings(self.tid)
        self.assertEqual(bookings[0]["rental_status"], "COMPLETED")
        vehicle = store.get_vehicle(self.tid, v["id"])
        self.assertEqual(vehicle["current_status"], "AVAILABLE")
        self.assertEqual(vehicle["current_mileage"], 12450)
        inspections = store.list_inspections(self.tid, booking_id=booking["id"])
        self.assertEqual(len(inspections), 2)
        self.assertTrue(any(i.get("signature_url") for i in inspections))


if __name__ == "__main__":
    unittest.main()
