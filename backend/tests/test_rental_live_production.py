"""Rental live-production v1 — age by category, refunds, bank confirm, reviews, deposit, celery."""

from __future__ import annotations

import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import travel_platform.rental.rental_store as store


class RentalLiveProductionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "rental_store.json"
        self._patch = patch.object(store, "STORE_FILE", self.path)
        self._patch.start()
        self.tid = "11111111-1111-1111-1111-111111111111"
        self._pg = patch("travel_platform.rental.rental_pg_sync.sync_booking_to_pg")
        self._pg_v = patch("travel_platform.rental.rental_pg_sync.sync_vehicle_to_pg")
        self._pg_i = patch("travel_platform.rental.rental_pg_sync.sync_inspection_to_pg")
        self._pg.start()
        self._pg_v.start()
        self._pg_i.start()
        # Avoid AADE/DB side effects during create_booking auto fiscal.
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
        self._patch.stop()
        self.tmp.cleanup()

    def _vehicle(self, **extra):
        body = {
            "plate_number": "LIVE-01",
            "category": "CAR",
            "model": "Yaris",
            "seating_capacity": 5,
            "daily_rate_eur": 40,
            "current_status": "AVAILABLE",
        }
        body.update(extra)
        return store.upsert_vehicle(self.tid, body)

    def _wallet_docs(self, dob: str = "2000-01-01") -> dict:
        return {
            "id_document_url": "/api/site/rental-id/id.jpg",
            "driving_license_url": "/api/site/rental-id/lic.jpg",
            "date_of_birth": dob,
            "license_number": "AB123456",
            "license_expires_at": "2030-01-01",
            "contract_accepted": True,
            "contract_signature_url": "/api/site/rental-photos/sig.png",
            "contract_signer_name": "Test",
        }

    def test_age_by_category_van_under_23_fails(self) -> None:
        v = self._vehicle(category="VAN", plate_number="VAN-23")
        # Age ~22 at rental end 2026-09-01 if DOB 2004-06-01
        with self.assertRaises(ValueError) as ctx:
            store.create_booking(
                self.tid,
                {
                    "vehicle_id": v["id"],
                    "client_name": "Young",
                    "client_email": "young@example.com",
                    "start_time": "2026-09-01T10:00:00+00:00",
                    "end_time": "2026-09-03T10:00:00+00:00",
                    "pickup_location": "Office",
                    "channel": "WALLET",
                    "driver_mode": "SELF_DRIVE",
                    "payment_plan": "full",
                    "payment_method": "card",
                    **self._wallet_docs(dob="2004-06-01"),
                },
            )
        self.assertIn("23", str(ctx.exception))

        # Same person OK on CAR (min 21)
        car = self._vehicle(category="CAR", plate_number="CAR-21")
        ok = store.create_booking(
            self.tid,
            {
                "vehicle_id": car["id"],
                "client_name": "Young",
                "client_email": "young2@example.com",
                "start_time": "2026-09-10T10:00:00+00:00",
                "end_time": "2026-09-12T10:00:00+00:00",
                "pickup_location": "Office",
                "channel": "WALLET",
                "driver_mode": "SELF_DRIVE",
                "payment_plan": "full",
                "payment_method": "bank_transfer",
                **self._wallet_docs(dob="2004-06-01"),
            },
        )
        self.assertEqual(ok["vehicle_category"], "CAR")

    def test_refund_sets_refunded_when_stripe_mocked(self) -> None:
        v = self._vehicle()
        start = datetime.now(timezone.utc) + timedelta(days=5)
        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Νίκος",
                "client_email": "nikos@example.com",
                "start_time": start.isoformat(),
                "end_time": (start + timedelta(days=2)).isoformat(),
                "pickup_location": "Office",
                "channel": "DESK",
                "payment_plan": "full",
                "payment_method": "card",
            },
        )
        store.patch_booking_fields(
            self.tid,
            booking["id"],
            {
                "payment_intent_id": "pi_test_1",
                "amount_paid": 80.0,
                "payment_status": "paid",
            },
        )
        fake_refund = MagicMock()
        fake_refund.id = "re_test_1"
        with patch.dict("os.environ", {"STRIPE_SECRET_KEY": "sk_test_x"}):
            with patch("stripe.Refund.create", return_value=fake_refund) as mock_refund:
                # stripe module may not exist — inject via import path used in cancel
                import sys

                fake_stripe = MagicMock()
                fake_stripe.Refund.create = mock_refund
                sys.modules["stripe"] = fake_stripe
                try:
                    cancelled = store.cancel_booking_for_customer(
                        self.tid,
                        booking["id"],
                        email="nikos@example.com",
                    )
                finally:
                    sys.modules.pop("stripe", None)
        self.assertEqual(cancelled["rental_status"], "CANCELLED")
        # Re-read after status update
        row = store.get_booking(self.tid, booking["id"])
        self.assertEqual(row["payment_status"], "refunded")
        self.assertEqual(row["refund_id"], "re_test_1")

    def test_bank_confirm_marks_paid(self) -> None:
        v = self._vehicle()
        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Μαρία",
                "client_email": "maria@example.com",
                "start_time": "2026-10-01T10:00:00+00:00",
                "end_time": "2026-10-03T10:00:00+00:00",
                "pickup_location": "Office",
                "channel": "DESK",
                "payment_plan": "full",
                "payment_method": "bank_transfer",
            },
        )
        self.assertEqual(booking["payment_status"], "pending")
        with patch(
            "travel_platform.settings.payment_settings_store.read_payment_settings",
            return_value={"security": {"require_amount_on_confirm": True, "require_reference_on_confirm": False}},
        ):
            updated = store.confirm_bank_deposit_for_rental(
                self.tid,
                booking["id"],
                confirmed_amount=float(booking["amount_due_now"]),
                reference_code="REF1",
            )
        self.assertEqual(updated["payment_status"], "paid")
        self.assertGreater(float(updated["amount_paid"]), 0)

    def test_review_create_and_aggregate(self) -> None:
        v = self._vehicle(plate_number="REV-01")
        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Κώστας",
                "client_email": "kostas@example.com",
                "start_time": "2026-05-01T10:00:00+00:00",
                "end_time": "2026-05-03T10:00:00+00:00",
                "pickup_location": "Office",
                "channel": "DESK",
            },
        )
        store.update_booking_status(self.tid, booking["id"], "COMPLETED")
        review = store.create_review(
            self.tid,
            booking["id"],
            email="kostas@example.com",
            rating=5,
            comment="Excellent",
        )
        self.assertEqual(review["rating"], 5)
        agg = store.vehicle_rating_aggregate(self.tid, v["id"])
        self.assertIsNotNone(agg)
        self.assertEqual(agg["rating"], 5.0)
        self.assertEqual(agg["count"], 1)
        catalog = store.public_catalog(self.tid)
        card = next(c for c in catalog if c["id"] == v["id"])
        self.assertTrue(card.get("trust", {}).get("real"))
        self.assertEqual(card["rating_avg"], 5.0)

    def test_damage_deposit_fields_default(self) -> None:
        v = self._vehicle(plate_number="DEP-01")
        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Άννα",
                "client_email": "anna@example.com",
                "start_time": "2026-11-01T10:00:00+00:00",
                "end_time": "2026-11-02T10:00:00+00:00",
                "pickup_location": "Office",
                "channel": "DESK",
                "payment_plan": "full",
                "payment_method": "card",
            },
        )
        self.assertEqual(float(booking["damage_deposit_eur"]), store.DEFAULT_DAMAGE_DEPOSIT_EUR)
        self.assertIn(booking["damage_deposit_status"], ("pending_hold", "none", "held"))
        released = store.set_damage_deposit_status(self.tid, booking["id"], action="release")
        self.assertEqual(released["damage_deposit_status"], "released")

    def test_reminder_celery_task_importable(self) -> None:
        from workers.tasks import scan_rental_reminders
        from workers.celery_app import celery_app

        self.assertTrue(callable(scan_rental_reminders))
        self.assertIn("rental-upcoming-reminders", celery_app.conf.beat_schedule)
        entry = celery_app.conf.beat_schedule["rental-upcoming-reminders"]
        self.assertEqual(entry["task"], "workers.tasks.scan_rental_reminders")

    def test_min_age_helpers(self) -> None:
        self.assertEqual(store.min_driver_age_for_category("CAR"), 21)
        self.assertEqual(store.min_driver_age_for_category("VAN"), 23)
        self.assertEqual(store.min_driver_age_for_category("MINIBUS"), 25)


if __name__ == "__main__":
    unittest.main()
