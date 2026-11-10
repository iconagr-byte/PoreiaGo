"""Rental trip safety — SOS, share token, checklist, insurance, contacts."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import travel_platform.rental.rental_store as store


class RentalTripSafetyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "rental_store.json"
        self.safety_path = Path(self.tmp.name) / "rental_safety_settings.json"
        self._patch = patch.object(store, "STORE_FILE", self.path)
        self._patch.start()
        self._safety = patch(
            "travel_platform.rental.rental_safety_settings._SETTINGS_FILE",
            self.safety_path,
        )
        self._safety.start()
        self.tid = "11111111-1111-1111-1111-111111111111"
        self._pg = patch("travel_platform.rental.rental_pg_sync.sync_booking_to_pg")
        self._pg_v = patch("travel_platform.rental.rental_pg_sync.sync_vehicle_to_pg")
        self._pg_i = patch("travel_platform.rental.rental_pg_sync.sync_inspection_to_pg")
        self._pg.start()
        self._pg_v.start()
        self._pg_i.start()
        self._fiscal = patch(
            "travel_platform.rental.rental_fiscal.mark_rental_receipt",
            side_effect=lambda booking, **kw: {
                **booking,
                "fiscal_mark": "LOCAL-TEST",
                "fiscal_status": "issued",
                "fiscal_kind": "local_receipt",
            },
        )
        self._fiscal.start()

    def tearDown(self) -> None:
        self._fiscal.stop()
        self._pg.stop()
        self._pg_v.stop()
        self._pg_i.stop()
        self._safety.stop()
        self._patch.stop()
        self.tmp.cleanup()

    def _vehicle(self):
        return store.upsert_vehicle(
            self.tid,
            {
                "plate_number": "SAFE-01",
                "category": "CAR",
                "model": "Yaris",
                "seating_capacity": 5,
                "daily_rate_eur": 40,
            },
        )

    def _booking(self, email: str = "owner@example.com", **extra):
        v = self._vehicle()
        body = {
            "vehicle_id": v["id"],
            "client_name": "Owner",
            "client_email": email,
            "start_time": "2026-12-01T10:00:00+00:00",
            "end_time": "2026-12-03T10:00:00+00:00",
            "pickup_location": "Γραφείο",
        }
        body.update(extra)
        return store.create_booking(self.tid, body)

    def test_safety_contacts_defaults(self) -> None:
        from travel_platform.rental.rental_safety_settings import (
            DEFAULT_SAFETY_SETTINGS,
            resolve_safety_contacts,
        )

        contacts = resolve_safety_contacts()
        self.assertEqual(
            contacts["roadside_phone_24_7"],
            DEFAULT_SAFETY_SETTINGS["roadside_phone_24_7"],
        )
        self.assertIn("Οδική", contacts["roadside_label"])
        self.assertEqual(contacts["cdw_franchise_eur"], 600.0)
        self.assertEqual(contacts["scdw_franchise_eur"], 0.0)

    def test_insurance_cover_returns_franchises(self) -> None:
        from travel_platform.rental.rental_safety_settings import (
            insurance_cover_payload,
            update_safety_settings,
        )

        update_safety_settings({"cdw_franchise_eur": 750, "scdw_franchise_eur": 50})
        cover = insurance_cover_payload()
        self.assertEqual(cover["cdw_franchise_eur"], 750.0)
        self.assertEqual(cover["scdw_franchise_eur"], 50.0)
        self.assertTrue(cover["cdw"]["covers"])
        self.assertTrue(cover["cdw"]["excludes"])
        self.assertIn("750", cover["cdw"]["franchise_note"])
        self.assertIn("ack_label", cover)

    def test_sos_stores_location_and_ownership(self) -> None:
        booking = self._booking()
        updated = store.record_booking_sos(
            self.tid,
            booking["id"],
            email="owner@example.com",
            lat=37.9838,
            lng=23.7275,
            note="Need help",
        )
        sos = updated.get("last_sos") or {}
        self.assertAlmostEqual(sos["lat"], 37.9838)
        self.assertAlmostEqual(sos["lng"], 23.7275)
        self.assertEqual(sos["note"], "Need help")
        self.assertTrue(sos.get("at"))

        with self.assertRaises(ValueError) as ctx:
            store.record_booking_sos(
                self.tid,
                booking["id"],
                email="other@example.com",
                lat=1.0,
                lng=2.0,
            )
        self.assertIn("δικαίωμα", str(ctx.exception).lower())

        store.update_booking_status(self.tid, booking["id"], "CANCELLED")
        with self.assertRaises(ValueError):
            store.record_booking_sos(
                self.tid,
                booking["id"],
                email="owner@example.com",
                lat=1.0,
                lng=2.0,
            )

    def test_share_token_roundtrip(self) -> None:
        from travel_platform.telemetry.rental_share_token import (
            create_rental_share_token,
            verify_rental_share_token,
        )

        booking = self._booking()
        token = create_rental_share_token(booking_id=booking["id"], tenant_id=self.tid, ttl_hours=2)
        payload = verify_rental_share_token(token, booking_id=booking["id"])
        self.assertEqual(payload["scope"], "rental_share")
        self.assertEqual(payload["booking_id"], booking["id"])
        self.assertEqual(payload["tenant_id"], self.tid)

        with self.assertRaises(Exception):
            verify_rental_share_token(token, booking_id="wrong-id")

        store.update_booking_live_location(
            self.tid,
            booking["id"],
            email="owner@example.com",
            lat=38.0,
            lng=23.5,
        )
        row = store.get_booking(self.tid, booking["id"])
        pin = row.get("last_share_location") or {}
        self.assertAlmostEqual(pin["lat"], 38.0)

    def test_checklist_required_on_pickup(self) -> None:
        booking = self._booking()
        with self.assertRaises(ValueError) as ctx:
            store.create_inspection(
                self.tid,
                {
                    "rental_booking_id": booking["id"],
                    "inspection_type": "PICKUP_CHECK",
                    "fuel_level": 80,
                    "mileage": 1000,
                    "require_pickup_checklist": True,
                    "checklist": {"tires_ok": True, "lights_ok": True},
                },
            )
        self.assertIn("έλεγχο", str(ctx.exception).lower())

        insp = store.create_inspection(
            self.tid,
            {
                "rental_booking_id": booking["id"],
                "inspection_type": "PICKUP_CHECK",
                "fuel_level": 80,
                "mileage": 1000,
                "require_pickup_checklist": True,
                "checklist": {
                    "tires_ok": True,
                    "lights_ok": True,
                    "fluids_ok": True,
                    "documents_ok": True,
                    "spare_wheel_ok": True,
                    "damages_noted": False,
                },
            },
        )
        self.assertTrue(insp["checklist"]["tires_ok"])
        self.assertFalse(insp["checklist"]["damages_noted"])
        active = store.get_booking(self.tid, booking["id"])
        self.assertEqual(active["rental_status"], "ACTIVE")

    def test_sos_push_skipped_without_vapid(self) -> None:
        booking = self._booking()
        updated = store.record_booking_sos(
            self.tid,
            booking["id"],
            email="owner@example.com",
            lat=37.9,
            lng=23.7,
        )
        import asyncio

        with patch(
            "travel_platform.notifications.web_push_service.web_push_configured",
            return_value=False,
        ), patch(
            "travel_platform.notifications.web_push_service.ensure_web_push_keys",
        ):
            from travel_platform.notifications.rental_sos_push import notify_rental_sos_to_office

            result = asyncio.run(notify_rental_sos_to_office(updated, updated["last_sos"]))
            self.assertTrue(result.get("skipped"))


if __name__ == "__main__":
    unittest.main()
