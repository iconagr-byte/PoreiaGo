"""Tests for fiscal SMS + ERP webhook notifications."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from ticketing.fiscal_notifications import (
    FISCAL_WEBHOOK_EVENT,
    build_fiscal_sms_message,
    build_fiscal_webhook_payload,
    dispatch_fiscal_receipt_webhook,
    normalize_phone,
)


class FiscalNotificationTests(unittest.TestCase):
    def test_normalize_greek_mobile(self):
        self.assertEqual(normalize_phone("694 123 4567"), "+306941234567")

    def test_build_sms_message_contains_mark(self):
        msg = build_fiscal_sms_message(
            {"tripTitle": "Μετέωρα", "pnr": "BK-1", "id": "B-1"},
            mark="MARK-9",
            amount=45.5,
            invoice_kind_label="Πλήρης πληρωμή",
        )
        self.assertIn("MARK-9", msg)
        self.assertIn("Μετέωρα", msg)

    def test_webhook_payload_shape(self):
        payload = build_fiscal_webhook_payload(
            {
                "id": "B-1",
                "saasBookingId": "uuid-1",
                "pnr": "BK-1",
                "email": "a@b.com",
                "phone": "+306941234567",
                "tripTitle": "Trip",
                "customerName": "Nikos",
            },
            tenant_id="tenant-1",
            invoice_id="inv-1",
            mark="MARK-1",
            amount=80.0,
            invoice_kind="full_payment",
            provider="native_aade",
        )
        self.assertEqual(payload["mark"], "MARK-1")
        self.assertEqual(payload["invoice_kind"], "full_payment")
        self.assertEqual(payload["tenant_id"], "tenant-1")

    def test_dispatch_webhook_queues_event(self):
        with (
            patch("ticketing.fiscal_notifications._read_fiscal_notification_settings", return_value={"notify_webhook": True}),
            patch("app.services.payment_dispatch.dispatch_partner_webhook") as dispatch,
        ):
            result = dispatch_fiscal_receipt_webhook(
                "tenant-1",
                {"mark": "MARK-1"},
            )
        dispatch.assert_called_once_with("tenant-1", FISCAL_WEBHOOK_EVENT, {"mark": "MARK-1"})
        self.assertTrue(result["queued"])


class FiscalSmsGateTests(unittest.IsolatedAsyncioTestCase):
    async def test_sms_skipped_without_phone(self):
        from ticketing.fiscal_notifications import notify_fiscal_receipt_sms

        with (
            patch("ticketing.fiscal_notifications._read_fiscal_notification_settings", return_value={
                "notify_customer": True,
                "notify_sms": True,
            }),
            patch("ticketing.fiscal_notifications._sms_enabled", return_value=True),
        ):
            result = await notify_fiscal_receipt_sms(
                {"phone": ""},
                mark="MARK-1",
                amount=10.0,
                invoice_kind_label="Απόδειξη",
            )
        self.assertEqual(result["reason"], "no_phone")

    async def test_push_skipped_without_email(self):
        from ticketing.fiscal_notifications import notify_fiscal_receipt_push

        with patch(
            "ticketing.fiscal_notifications._read_fiscal_notification_settings",
            return_value={"notify_customer": True, "notify_push": True},
        ):
            result = await notify_fiscal_receipt_push(
                {"email": ""},
                mark="MARK-1",
                amount=10.0,
                invoice_kind_label="Απόδειξη",
                invoice_id="inv-1",
            )
        self.assertEqual(result["reason"], "no_email")

    async def test_push_sent_when_enabled(self):
        from ticketing.fiscal_notifications import notify_fiscal_receipt_push

        with (
            patch(
                "ticketing.fiscal_notifications._read_fiscal_notification_settings",
                return_value={"notify_customer": True, "notify_push": True},
            ),
            patch(
                "travel_platform.notifications.web_push_service.send_push_to_email",
                new_callable=AsyncMock,
                return_value={"sent": 1, "attempted": 1},
            ),
        ):
            result = await notify_fiscal_receipt_push(
                {"email": "a@b.com", "id": "B-1", "pnr": "BK-1", "tripTitle": "Trip"},
                mark="MARK-3",
                amount=30.0,
                invoice_kind_label="Πλήρης πληρωμή",
                invoice_id="inv-3",
            )
        self.assertEqual(result["sent"], 1)

    async def test_sms_sent_when_enabled(self):
        from ticketing.fiscal_notifications import notify_fiscal_receipt_sms

        with (
            patch("ticketing.fiscal_notifications._read_fiscal_notification_settings", return_value={
                "notify_customer": True,
                "notify_sms": True,
            }),
            patch("ticketing.fiscal_notifications._sms_enabled", return_value=True),
            patch("travel_platform.notifications.dispatcher.send_sms", new_callable=AsyncMock, return_value="sms-1"),
        ):
            result = await notify_fiscal_receipt_sms(
                {"phone": "6941234567", "tripTitle": "Trip", "pnr": "BK-1"},
                mark="MARK-2",
                amount=20.0,
                invoice_kind_label="Προκαταβολή",
            )
        self.assertEqual(result["reference"], "sms-1")


if __name__ == "__main__":
    unittest.main()
