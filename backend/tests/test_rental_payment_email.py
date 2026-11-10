"""Rental payment split + extras pricing + confirmation email helpers."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import travel_platform.rental.rental_store as store


class RentalPaymentStoreTests(unittest.TestCase):
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
            "plate_number": "PAY-001",
            "category": "CAR",
            "model": "Yaris",
            "seating_capacity": 5,
            "daily_rate_eur": 40,
            "current_status": "AVAILABLE",
        }
        body.update(extra)
        return store.upsert_vehicle(self.tid, body)

    def test_compute_payment_split_deposit_card(self) -> None:
        pay = store.compute_payment_split(
            100,
            payment_plan="deposit",
            payment_method="card",
            deposit_percent=30,
        )
        self.assertEqual(pay["amount_due_now"], 30.0)
        self.assertEqual(pay["amount_paid"], 30.0)
        self.assertEqual(pay["balance_due"], 70.0)
        self.assertEqual(pay["payment_status"], "partial")

    def test_compute_payment_split_bank_pending(self) -> None:
        pay = store.compute_payment_split(
            200,
            payment_plan="full",
            payment_method="bank_transfer",
        )
        self.assertEqual(pay["amount_paid"], 0.0)
        self.assertEqual(pay["payment_status"], "pending")
        self.assertIn("PENDING", pay["payment_label"])

    def test_extras_added_to_total_and_payment(self) -> None:
        v = self._vehicle()
        booking = store.create_booking(
            self.tid,
            {
                "vehicle_id": v["id"],
                "client_name": "Άννα",
                "client_email": "anna@example.com",
                "start_time": "2026-08-01T10:00:00+00:00",
                "end_time": "2026-08-03T10:00:00+00:00",
                "pickup_location": "Γραφείο",
                "extras": {"extra_insurance": True, "gps_pack": True},
                "payment_plan": "deposit",
                "payment_method": "card",
                "deposit_percent": 30,
            },
        )
        # 2 days * 40 + insurance 12*2 + gps 5*2 = 80 + 24 + 10 = 114
        self.assertEqual(booking["total_cost"], 114.0)
        self.assertEqual(booking["pricing"]["extras_total"], 34.0)
        self.assertEqual(booking["amount_due_now"], 34.2)
        self.assertEqual(booking["amount_paid"], 34.2)
        self.assertEqual(booking["balance_due"], 79.8)
        self.assertEqual(booking["payment_status"], "partial")
        self.assertIn("CDW", booking["notes"])


class RentalConfirmationEmailTests(unittest.IsolatedAsyncioTestCase):
    async def test_sends_customer_email(self) -> None:
        from ticketing.rental_confirmation_email import send_rental_confirmation_email

        booking = {
            "id": "rent-1",
            "client_name": "Μαρία",
            "client_email": "maria@example.com",
            "vehicle_model": "Transit",
            "vehicle_plate": "ΡΕΝΤ-1",
            "start_time": "2026-08-01T10:00:00+00:00",
            "end_time": "2026-08-02T10:00:00+00:00",
            "pickup_location": "Αθήνα",
            "dropoff_location": "Αθήνα",
            "total_cost": 100,
            "amount_due_now": 100,
            "amount_paid": 100,
            "balance_due": 0,
            "payment_status": "paid",
            "payment_label": "PAID (Credit Card)",
            "payment_plan": "full",
            "payment_method": "card",
            "driver_mode": "SELF_DRIVE",
            "pricing": {},
        }
        with (
            patch(
                "ticketing.rental_confirmation_email._read_notification_settings",
                return_value={
                    "notify_customer": True,
                    "notify_admin": False,
                    "admin_email": "",
                },
            ),
            patch(
                "ticketing.rental_confirmation_email.send_email",
                new_callable=AsyncMock,
                return_value="ok",
            ) as send_mock,
        ):
            result = await send_rental_confirmation_email(booking)
        self.assertEqual(result["customer"], "ok")
        send_mock.assert_awaited_once()
        args = send_mock.await_args.args
        self.assertEqual(args[0], "maria@example.com")
        self.assertIn("Επιβεβαίωση", args[1])
        self.assertIn("Transit", args[2])


if __name__ == "__main__":
    unittest.main()
