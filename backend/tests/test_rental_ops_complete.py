"""Rental ops complete — extras, AFM, modify, fiscal, compliance."""

from __future__ import annotations

import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import travel_platform.rental.rental_store as store


class RentalOpsCompleteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "rental_store.json"
        self._patch = patch.object(store, "STORE_FILE", self.path)
        self._patch.start()
        self.tid = "11111111-1111-1111-1111-111111111111"
        # Avoid side-effect threads during tests.
        self._pg = patch("travel_platform.rental.rental_pg_sync.sync_booking_to_pg")
        self._pg_v = patch("travel_platform.rental.rental_pg_sync.sync_vehicle_to_pg")
        self._pg_i = patch("travel_platform.rental.rental_pg_sync.sync_inspection_to_pg")
        self._pg.start()
        self._pg_v.start()
        self._pg_i.start()

    def tearDown(self) -> None:
        self._pg.stop()
        self._pg_v.stop()
        self._pg_i.stop()
        self._patch.stop()
        self.tmp.cleanup()

    def _vehicle(self, **extra):
        body = {
            "plate_number": "ΡΕΝΤ-OPS",
            "category": "CAR",
            "model": "Yaris",
            "seating_capacity": 5,
            "daily_rate_eur": 40,
            "current_status": "AVAILABLE",
        }
        body.update(extra)
        return store.upsert_vehicle(self.tid, body)

    def test_extras_airport_flat_and_young_driver_daily(self) -> None:
        total, lines = store.compute_extras_total(
            3,
            {"airport_pickup": True, "young_driver": True, "gps_pack": True},
        )
        # airport 25 flat + young 15*3 + gps 5*3 = 25+45+15 = 85
        self.assertEqual(total, 85.0)
        self.assertIn("Airport pickup", lines)
        self.assertIn("Young driver (<25)", lines)
        self.assertIn("GPS pack", lines)

    def test_quote_auto_airport_from_pickup(self) -> None:
        v = self._vehicle()
        start = datetime(2026, 8, 1, 10, tzinfo=timezone.utc)
        end = datetime(2026, 8, 3, 10, tzinfo=timezone.utc)
        quote = store.quote_vehicle(
            v,
            start=start,
            end=end,
            pickup_location="Αεροδρόμιο Αθηνών (ATH)",
            dropoff_location="Αεροδρόμιο Αθηνών (ATH)",
            extras={},
        )
        self.assertTrue(quote["is_airport_pickup"])
        self.assertEqual(quote["extras_total"], 25.0)
        # 2 days * 40 + 25 airport
        self.assertEqual(quote["suggested_total"], 105.0)

    def test_afm_validation(self) -> None:
        self.assertIsNone(store.validate_client_afm(""))
        self.assertEqual(store.validate_client_afm("123456789"), "123456789")
        with self.assertRaises(ValueError):
            store.validate_client_afm("12345")
        with self.assertRaises(ValueError):
            store.validate_client_afm("abcdefghı")

        v = self._vehicle()
        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Νίκος",
                "client_email": "nikos@example.com",
                "client_afm": "987654321",
                "start_time": "2026-09-01T10:00:00+00:00",
                "end_time": "2026-09-02T10:00:00+00:00",
                "pickup_location": "Γραφείο",
            },
        )
        self.assertEqual(booking["client_afm"], "987654321")

        with self.assertRaises(ValueError):
            store.create_booking(
                self.tid,
                {
                    "vehicle_id": v["id"],
                    "client_name": "Μαρία",
                    "client_afm": "12",
                    "start_time": "2026-09-10T10:00:00+00:00",
                    "end_time": "2026-09-11T10:00:00+00:00",
                    "pickup_location": "Γραφείο",
                },
            )

    def test_modify_booking_happy_path(self) -> None:
        v = self._vehicle()
        now = datetime(2026, 7, 1, 12, tzinfo=timezone.utc)
        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Νίκος",
                "client_email": "nikos@example.com",
                "start_time": "2026-08-10T10:00:00+00:00",
                "end_time": "2026-08-12T10:00:00+00:00",
                "pickup_location": "Γραφείο",
                "payment_plan": "full",
                "payment_method": "card",
                "channel": "DESK",
            },
        )
        updated = store.modify_booking_for_customer(
            self.tid,
            booking["id"],
            email="nikos@example.com",
            start_time="2026-08-15T10:00:00+00:00",
            end_time="2026-08-18T10:00:00+00:00",
            pickup="Airport ATH",
            now=now,
        )
        self.assertEqual(updated["start_time"][:10], "2026-08-15")
        # 3 days * 40 + airport 25
        self.assertEqual(updated["total_cost"], 145.0)
        self.assertTrue(updated["pricing"].get("is_airport_pickup"))

    def test_free_cancel_blocks_modify_inside_24h(self) -> None:
        v = self._vehicle()
        start = datetime(2026, 8, 1, 12, tzinfo=timezone.utc)
        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Νίκος",
                "client_email": "nikos@example.com",
                "start_time": start.isoformat(),
                "end_time": (start + timedelta(days=2)).isoformat(),
                "pickup_location": "Γραφείο",
                "channel": "DESK",
                "payment_plan": "full",
                "payment_method": "card",
            },
        )
        now = start - timedelta(hours=12)
        with self.assertRaises(ValueError) as ctx:
            store.modify_booking_for_customer(
                self.tid,
                booking["id"],
                email="nikos@example.com",
                start_time=(start + timedelta(days=1)).isoformat(),
                end_time=(start + timedelta(days=3)).isoformat(),
                now=now,
            )
        self.assertIn("24", str(ctx.exception))

    def test_fiscal_mark_local(self) -> None:
        from travel_platform.rental.rental_fiscal import mark_rental_receipt

        v = self._vehicle()
        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Νίκος",
                "client_email": "nikos@example.com",
                "start_time": "2026-10-01T10:00:00+00:00",
                "end_time": "2026-10-02T10:00:00+00:00",
                "pickup_location": "Γραφείο",
                "payment_method": "bank_transfer",
                "payment_plan": "full",
                "channel": "DESK",
            },
        )
        # bank transfer → unpaid; no auto fiscal
        self.assertIsNone(booking.get("fiscal_mark"))
        marked = mark_rental_receipt(booking, kind="local_receipt", amount=40.0)
        self.assertEqual(marked["fiscal_status"], "issued")
        self.assertTrue(str(marked["fiscal_mark"]).startswith("LOCAL-"))
        self.assertEqual(marked["fiscal_kind"], "local_receipt")
        self.assertEqual(marked["fiscal_amount"], 40.0)

    def test_compliance_unknown_plate_allows(self) -> None:
        with patch(
            "travel_platform.fleet.service_service.service_service.check_dispatch_availability",
            return_value={"available": True, "unknown_plate": True, "plate": "UNKNOWN1"},
        ) as mock_check:
            ok, reason = store.fleet_dispatch_ok("UNKNOWN1")
            self.assertTrue(ok)
            self.assertIsNone(reason)
            mock_check.assert_called()

        with patch(
            "travel_platform.fleet.service_service.service_service.check_dispatch_availability",
            return_value={"available": False, "reason": "ΚΤΕΟ ληγμένο", "plate": "BAD-1"},
        ):
            ok, reason = store.fleet_dispatch_ok("BAD-1")
            self.assertFalse(ok)
            self.assertIn("ΚΤΕΟ", reason or "")

        v = self._vehicle(plate_number="BAD-99")
        with patch.object(store, "fleet_dispatch_ok", return_value=(False, "Ασφάλεια ληγμένη")):
            with self.assertRaises(ValueError) as ctx:
                store.create_booking(
                    self.tid,
                    {
                        "vehicle_id": v["id"],
                        "client_name": "Νίκος",
                        "start_time": "2026-11-01T10:00:00+00:00",
                        "end_time": "2026-11-02T10:00:00+00:00",
                        "pickup_location": "Γραφείο",
                    },
                )
            self.assertIn("Ασφάλεια", str(ctx.exception))

        with patch.object(store, "fleet_dispatch_ok", return_value=(False, "blocked")):
            rows = store.check_availability(
                self.tid,
                start_time="2026-11-01T10:00:00+00:00",
                end_time="2026-11-02T10:00:00+00:00",
            )
            self.assertEqual(rows, [])


if __name__ == "__main__":
    unittest.main()
