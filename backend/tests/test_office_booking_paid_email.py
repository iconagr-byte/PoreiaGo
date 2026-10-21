"""Office email on paid excursion booking — recipient resolution + admin payload."""

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from ticketing.payment_confirmation_email import (
    EVENT_ONLINE_FULL,
    build_admin_payment_email,
    is_paid_success_booking,
    resolve_office_recipient,
    send_payment_confirmation_notifications,
)


class OfficeBookingPaidEmailTests(unittest.TestCase):
    def test_is_paid_success_from_amount(self):
        self.assertTrue(is_paid_success_booking({"amountPaid": 40}))
        self.assertTrue(is_paid_success_booking(amount_paid=12.5))
        self.assertFalse(is_paid_success_booking({"amountPaid": 0}))
        self.assertFalse(is_paid_success_booking(amount_paid=0))

    def test_admin_email_includes_payment_and_booking_fields(self):
        booking = {
            "pnr": "BK-TEST01",
            "saasBookingId": "11111111-2222-3333-4444-555555555555",
            "tripTitle": "Μετέωρα",
            "tripId": 91001,
            "seat": "5A, 5B",
            "date": "2026-06-01",
            "time": "08:00",
            "customerName": "Μαρία",
            "email": "maria@example.com",
            "phone": "6900000000",
            "paymentMethod": "card",
            "paymentStatus": "PAID (SaaS)",
            "status": "Επιβεβαιωμένη",
            "amountPaid": 64.6,
            "balanceDue": 0,
            "price": 64.6,
            "paymentPlan": "full",
            "transactionId": "TXN-abc",
            "invoiceNumber": "INV-TEST01",
            "paymentDate": "2026-05-01 12:00:00",
            "bookingSource": "website_checkout",
            "tenant_id": "tenant-achillio",
        }
        subject, html = build_admin_payment_email(booking, EVENT_ONLINE_FULL)
        self.assertIn("BK-TEST01", subject)
        self.assertIn("Γραφείο", subject)
        self.assertIn("Μετέωρα", html)
        self.assertIn("64.60", html)
        self.assertIn("TXN-abc", html)
        self.assertIn("INV-TEST01", html)
        self.assertIn("tenant-achillio", html)
        self.assertIn("maria@example.com", html)
        self.assertIn("5A, 5B", html)

    def test_resolve_office_uses_tenant_payment_settings(self):
        async def run():
            with patch(
                "ticketing.payment_confirmation_email._read_notification_settings",
                return_value={
                    "notify_customer": True,
                    "notify_admin": True,
                    "admin_email": "office@achillio.gr",
                },
            ):
                return await resolve_office_recipient("tenant-1")

        self.assertEqual(asyncio.run(run()), "office@achillio.gr")

    def test_resolve_office_falls_back_to_env(self):
        async def run():
            with (
                patch(
                    "ticketing.payment_confirmation_email._read_notification_settings",
                    return_value={
                        "notify_customer": True,
                        "notify_admin": True,
                        "admin_email": "",
                    },
                ),
                patch(
                    "ticketing.payment_confirmation_email._tenant_office_emails",
                    new_callable=AsyncMock,
                    return_value=[],
                ),
                patch(
                    "ticketing.payment_confirmation_email._admin_recipient",
                    return_value="fallback@poreiago.app",
                ),
            ):
                return await resolve_office_recipient("tenant-empty")

        self.assertEqual(asyncio.run(run()), "fallback@poreiago.app")

    def test_require_office_sends_admin_even_when_flag_off(self):
        booking = {
            "pnr": "BK-REQ",
            "email": "customer@example.com",
            "customerName": "Test",
            "tripTitle": "Δελφοί",
            "amountPaid": 50,
            "price": 50,
            "balanceDue": 0,
            "paymentMethod": "card",
            "paymentStatus": "PAID",
            "status": "Επιβεβαιωμένη",
            "tenant_id": "t1",
        }

        async def run():
            with (
                patch(
                    "ticketing.payment_confirmation_email._read_notification_settings",
                    return_value={
                        "notify_customer": False,
                        "notify_admin": False,
                        "admin_email": "",
                    },
                ),
                patch(
                    "ticketing.payment_confirmation_email.resolve_office_recipient",
                    new_callable=AsyncMock,
                    return_value="desk@office.gr",
                ),
                patch(
                    "ticketing.payment_confirmation_email.send_email",
                    new_callable=AsyncMock,
                    return_value="ref-1",
                ) as send,
                patch(
                    "ticketing.payment_confirmation_email.send_ticket_confirmation_email",
                    new_callable=AsyncMock,
                    return_value={"ok": True},
                ),
            ):
                result = await send_payment_confirmation_notifications(
                    booking,
                    event=EVENT_ONLINE_FULL,
                    require_office=True,
                    notify_customer=False,
                )
                self.assertEqual(send.await_count, 1)
                self.assertEqual(result["admin"]["email"], "desk@office.gr")
                return result

        asyncio.run(run())

    def test_require_office_logs_missing_recipient(self):
        booking = {
            "pnr": "BK-MISS",
            "email": "customer@example.com",
            "amountPaid": 20,
            "price": 20,
            "tenant_id": "t-missing",
        }

        async def run():
            with (
                patch(
                    "ticketing.payment_confirmation_email._read_notification_settings",
                    return_value={
                        "notify_customer": False,
                        "notify_admin": True,
                        "admin_email": "",
                    },
                ),
                patch(
                    "ticketing.payment_confirmation_email.resolve_office_recipient",
                    new_callable=AsyncMock,
                    return_value=None,
                ),
                patch(
                    "ticketing.payment_confirmation_email.logger"
                ) as log,
            ):
                result = await send_payment_confirmation_notifications(
                    booking,
                    require_office=True,
                    notify_customer=False,
                )
                self.assertEqual(result.get("admin_skipped"), "No admin email configured")
                self.assertTrue(log.error.called)
                return result

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
