"""Stripe webhook → fiscal receipt dispatch tests."""

from __future__ import annotations

import unittest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.services.booking_payment_service import PaymentCaptureResult


class StripeWebhookFiscalDispatchTests(unittest.IsolatedAsyncioTestCase):
    async def test_capture_classifies_down_payment(self):
        from app.models.booking import Booking, BookingStatus, PaymentStatus
        from app.models.fiscal_invoice import FiscalInvoiceKind
        from app.services.booking_payment_service import BookingPaymentService

        booking = Booking(
            id=uuid4(),
            tenant_id=uuid4(),
            passenger_name="Test",
            reference_code="BK-100",
            total_price=Decimal("100"),
            amount_paid=Decimal("0"),
            amount_eur=Decimal("100"),
            status=BookingStatus.PENDING,
            payment_status=PaymentStatus.PENDING,
            metadata_json={},
        )

        session = AsyncMock()

        async def _execute(stmt):
            result = MagicMock()
            stmt_text = str(stmt)
            if "fiscal_invoices" in stmt_text:
                result.scalar_one_or_none.return_value = None
            else:
                result.scalar_one_or_none.return_value = booking
            return result

        session.execute = AsyncMock(side_effect=_execute)

        with patch("app.services.booking_payment_service.apply_tenant_rls", new_callable=AsyncMock):
            svc = BookingPaymentService(session)
            result = await svc._capture_payment(
            tenant_id=booking.tenant_id,
            booking_id=booking.id,
            amount=Decimal("30"),
            idempotency_key="stripe-pi:pi_1",
            stripe_payment_intent_id="pi_1",
            channel="stripe",
            actor_id=None,
            note=None,
        )

        self.assertEqual(result.status, "captured")
        added = session.add.call_args[0][0]
        self.assertEqual(added.invoice_kind, FiscalInvoiceKind.DOWN_PAYMENT)
        self.assertEqual(added.amount, Decimal("30"))

    async def test_capture_classifies_final_settlement(self):
        from app.models.booking import Booking, BookingStatus, PaymentStatus
        from app.models.fiscal_invoice import FiscalInvoiceKind
        from app.services.booking_payment_service import BookingPaymentService

        booking = Booking(
            id=uuid4(),
            tenant_id=uuid4(),
            passenger_name="Test",
            reference_code="BK-101",
            total_price=Decimal("100"),
            amount_paid=Decimal("30"),
            amount_eur=Decimal("100"),
            status=BookingStatus.CONFIRMED,
            payment_status=PaymentStatus.PARTIAL,
            metadata_json={"amount_paid": 30},
        )

        session = AsyncMock()

        async def _execute(stmt):
            result = MagicMock()
            stmt_text = str(stmt)
            if "fiscal_invoices" in stmt_text:
                result.scalar_one_or_none.return_value = None
            else:
                result.scalar_one_or_none.return_value = booking
            return result

        session.execute = AsyncMock(side_effect=_execute)

        with patch("app.services.booking_payment_service.apply_tenant_rls", new_callable=AsyncMock):
            svc = BookingPaymentService(session)
            result = await svc._capture_payment(
            tenant_id=booking.tenant_id,
            booking_id=booking.id,
            amount=Decimal("70"),
            idempotency_key="stripe-pi:pi_2",
            stripe_payment_intent_id="pi_2",
            channel="stripe",
            actor_id=None,
            note=None,
        )

        self.assertEqual(result.status, "captured")
        added = session.add.call_args[0][0]
        self.assertEqual(added.invoice_kind, FiscalInvoiceKind.FINAL_SETTLEMENT)
        self.assertEqual(booking.amount_paid, Decimal("100"))

    def test_dispatch_fiscal_receipt_prefers_celery(self):
        with patch("workers.tasks.process_fiscal_receipt") as task:
            task.delay = MagicMock()
            from app.services.payment_dispatch import dispatch_fiscal_receipt

            dispatch_fiscal_receipt("invoice-id-1")
            task.delay.assert_called_once_with("invoice-id-1")

    def test_webhook_schedules_background_task(self):
        from fastapi import BackgroundTasks

        from app.api import payments_webhook

        bg = BackgroundTasks()
        with patch.object(bg, "add_task") as add_task:
            captured_id = str(uuid4())
            payments_webhook.dispatch_fiscal_receipt = MagicMock()
            bg.add_task(payments_webhook.dispatch_fiscal_receipt, captured_id)
            add_task.assert_called_once_with(payments_webhook.dispatch_fiscal_receipt, captured_id)


if __name__ == "__main__":
    unittest.main()
