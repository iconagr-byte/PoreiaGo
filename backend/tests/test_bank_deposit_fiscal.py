"""Bank deposit → fiscal capture tests."""

from __future__ import annotations

import unittest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.fiscal_invoice import FiscalInvoiceKind


class BankDepositFiscalTests(unittest.IsolatedAsyncioTestCase):
    async def test_record_bank_deposit_creates_full_payment_invoice(self):
        from app.models.booking import Booking, BookingStatus, PaymentStatus
        from app.services.booking_payment_service import BookingPaymentService

        booking = Booking(
            id=uuid4(),
            tenant_id=uuid4(),
            passenger_name="Test",
            reference_code="BK-BANK1",
            total_price=Decimal("120"),
            amount_paid=Decimal("0"),
            amount_eur=Decimal("120"),
            status=BookingStatus.PENDING,
            payment_status=PaymentStatus.PENDING,
            metadata_json={"payment_method": "Τραπεζική μεταφορά"},
        )

        session = AsyncMock()

        async def _execute(stmt):
            result = MagicMock()
            if "fiscal_invoices" in str(stmt):
                result.scalar_one_or_none.return_value = None
            else:
                result.scalar_one_or_none.return_value = booking
            return result

        session.execute = AsyncMock(side_effect=_execute)

        with patch("app.services.booking_payment_service.apply_tenant_rls", new_callable=AsyncMock):
            svc = BookingPaymentService(session)
            result = await svc.record_bank_deposit(
                tenant_id=booking.tenant_id,
                booking_id=booking.id,
                amount=Decimal("120"),
                reference_code="VOY-BANK1",
            )

        self.assertEqual(result.status, "captured")
        invoice = session.add.call_args[0][0]
        self.assertEqual(invoice.invoice_kind, FiscalInvoiceKind.FULL_PAYMENT)
        self.assertEqual(invoice.amount, Decimal("120"))
        meta = booking.metadata_json or {}
        self.assertEqual(meta.get("payment_method"), "Τραπεζική μεταφορά")


class FiscalReceiptEmailTests(unittest.IsolatedAsyncioTestCase):
    async def test_fiscal_receipt_email_event(self):
        from ticketing.payment_confirmation_email import (
            EVENT_FISCAL_RECEIPT,
            build_customer_payment_email,
            notify_fiscal_receipt_issued,
        )

        booking = {
            "customerName": "Maria",
            "email": "maria@example.com",
            "pnr": "BK-1",
            "tripTitle": "Μετέωρα",
            "price": 100,
        }
        subject, html = build_customer_payment_email(
            {
                **booking,
                "fiscalMark": "MARK-999",
                "fiscalKindLabel": "Πλήρης πληρωμή",
                "fiscalReceiptAmount": 100,
            },
            EVENT_FISCAL_RECEIPT,
        )
        self.assertIn("MARK-999", subject)
        self.assertIn("MARK-999", html)

        with patch(
            "ticketing.payment_confirmation_email.send_payment_confirmation_notifications",
            new_callable=AsyncMock,
        ) as send:
            send.return_value = {"event": EVENT_FISCAL_RECEIPT}
            result = await notify_fiscal_receipt_issued(
                booking,
                mark="MARK-999",
                invoice_kind="full_payment",
                amount=100.0,
                provider="native_aade",
            )
        send.assert_awaited_once()
        self.assertEqual(result["event"], EVENT_FISCAL_RECEIPT)


if __name__ == "__main__":
    unittest.main()
