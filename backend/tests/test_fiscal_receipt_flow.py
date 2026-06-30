"""Integration-style tests: payment capture → fiscal receipt → MARK."""

from __future__ import annotations

import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.fiscal_invoice import FiscalInvoiceKind, FiscalInvoiceStatus


class FiscalReceiptFlowTests(unittest.IsolatedAsyncioTestCase):
    async def test_process_fiscal_receipt_persists_mark(self):
        from app.models.booking import PaymentStatus
        from app.workers.fiscal_receipt_worker import process_fiscal_receipt

        tenant_id = uuid4()
        booking_id = uuid4()
        invoice_id = uuid4()
        submission_id = uuid4()

        invoice = SimpleNamespace(
            id=invoice_id,
            tenant_id=tenant_id,
            booking_id=booking_id,
            status=FiscalInvoiceStatus.QUEUED,
            invoice_kind=SimpleNamespace(value=FiscalInvoiceKind.FULL_PAYMENT.value),
            amount=Decimal("80"),
            aade_submission_id=submission_id,
            aade_mark=None,
            error_message=None,
            metadata_json={"channel": "stripe"},
        )
        booking = SimpleNamespace(
            id=booking_id,
            reference_code="BK-FLOW1",
            passenger_email="guest@example.com",
            payment_status=PaymentStatus.PAID,
            fiscal_mark=None,
        )
        tenant = SimpleNamespace(settings_json='{"fiscal":{"issuer_vat":"123456789"}}')

        inv_result = MagicMock()
        inv_result.scalar_one_or_none.return_value = invoice
        tenant_result = MagicMock()
        tenant_result.scalar_one_or_none.return_value = tenant

        session = AsyncMock()
        session.execute = AsyncMock(side_effect=[inv_result, tenant_result])

        session.refresh = AsyncMock()
        session.flush = AsyncMock()

        factory = MagicMock()
        factory.provider = SimpleNamespace(value="native_aade")

        async def _transmit_side_effect(sub_id):
            invoice.status = FiscalInvoiceStatus.ISSUED
            invoice.aade_mark = "MARK-FLOW-99"
            booking.fiscal_mark = "MARK-FLOW-99"
            invoice.metadata_json = {
                **(invoice.metadata_json or {}),
                "fiscal_provider": "native_aade",
            }
            return {
                "success": True,
                "mark": "MARK-FLOW-99",
                "uid": "UID-1",
                "provider": "native_aade",
            }

        with (
            patch("app.workers.fiscal_receipt_worker.apply_tenant_rls", new_callable=AsyncMock),
            patch(
                "app.workers.fiscal_receipt_worker.load_native_aade_credentials",
                new_callable=AsyncMock,
                return_value={},
            ),
            patch("app.workers.fiscal_receipt_worker.FiscalFactory") as factory_cls,
            patch("app.workers.fiscal_receipt_worker.FiscalInvoiceService") as invoice_svc_cls,
            patch("app.workers.fiscal_receipt_worker.FiscalTransmissionService") as tx_svc_cls,
            patch(
                "app.workers.fiscal_receipt_worker._notify_fiscal_receipt_issued",
                new_callable=AsyncMock,
            ),
        ):
            factory_cls.from_tenant_settings.return_value = factory
            invoice_svc_cls.return_value.issue_to_aade = AsyncMock(return_value=invoice)
            tx_svc_cls.return_value.transmit_submission = AsyncMock(side_effect=_transmit_side_effect)

            result = await process_fiscal_receipt(session, invoice_id)

        self.assertEqual(result["status"], "issued")
        self.assertEqual(result["mark"], "MARK-FLOW-99")
        self.assertEqual(booking.fiscal_mark, "MARK-FLOW-99")
        tx_svc_cls.return_value.transmit_submission.assert_awaited_once_with(submission_id)

    async def test_capture_payment_creates_fiscal_invoice(self):
        from app.models.booking import Booking, BookingStatus, PaymentStatus
        from app.services.booking_payment_service import BookingPaymentService

        booking = Booking(
            id=uuid4(),
            tenant_id=uuid4(),
            passenger_name="Flow Guest",
            passenger_email="flow@example.com",
            reference_code="BK-FLOW2",
            total_price=Decimal("120"),
            amount_paid=Decimal("0"),
            amount_eur=Decimal("120"),
            status=BookingStatus.PENDING,
            payment_status=PaymentStatus.PENDING,
            metadata_json={"trip_title": "Test Trip"},
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
        async def _flush():
            added = session.add.call_args[0][0]
            if getattr(added, "id", None) is None:
                added.id = uuid4()

        session.flush = AsyncMock(side_effect=_flush)

        with patch("app.services.booking_payment_service.apply_tenant_rls", new_callable=AsyncMock):
            svc = BookingPaymentService(session)
            capture = await svc._capture_payment(
                tenant_id=booking.tenant_id,
                booking_id=booking.id,
                amount=Decimal("120"),
                idempotency_key="stripe-pi:pi_flow",
                stripe_payment_intent_id="pi_flow",
                channel="stripe",
                actor_id=None,
                note=None,
            )

        self.assertEqual(capture.status, "captured")
        self.assertIsNotNone(capture.fiscal_invoice_id)
        added = session.add.call_args[0][0]
        self.assertEqual(added.invoice_kind, FiscalInvoiceKind.FULL_PAYMENT)


class CustomerFiscalFieldsTests(unittest.TestCase):
    def test_build_fiscal_customer_fields_omits_internal_details(self):
        from api.admin_booking_mapper import build_fiscal_customer_fields
        from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceKind

        booking = SimpleNamespace(
            fiscal_mark=None,
            reference_code="BK-T1",
            passenger_name="Test User",
            metadata_json={"trip_title": "Trip"},
        )
        invoice = FiscalInvoice(
            tenant_id=uuid4(),
            booking_id=uuid4(),
            invoice_kind=FiscalInvoiceKind.FULL_PAYMENT,
            status=FiscalInvoiceStatus.ISSUED,
            amount=Decimal("50"),
            aade_mark="MARK-CUST-1",
            idempotency_key="idem-cust",
            error_message="should not leak",
            metadata_json={"fiscal_provider": "native_aade"},
        )

        fields = build_fiscal_customer_fields(booking, [invoice])
        self.assertEqual(fields["fiscalMark"], "MARK-CUST-1")
        self.assertEqual(fields["fiscalReceipts"][0]["mark"], "MARK-CUST-1")
        self.assertNotIn("error_message", fields["fiscalReceipts"][0])
        self.assertNotIn("id", fields["fiscalReceipts"][0])
        self.assertEqual(len(fields["fiscalDocuments"]), 1)
        self.assertEqual(fields["fiscalDocuments"][0]["mark"], "MARK-CUST-1")

    def test_build_fiscal_customer_fields_includes_issuer_for_print(self):
        from api.admin_booking_mapper import build_fiscal_customer_fields
        from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceKind

        booking = SimpleNamespace(
            fiscal_mark="MARK-X",
            reference_code="BK-T2",
            passenger_name="Anna",
            metadata_json={"trip_title": "Athens"},
        )
        tenant = SimpleNamespace(
            legal_name="Travel AE",
            settings_json='{"fiscal":{"issuer_vat":"123456789"}}',
        )
        invoice = FiscalInvoice(
            tenant_id=uuid4(),
            booking_id=uuid4(),
            invoice_kind=FiscalInvoiceKind.FULL_PAYMENT,
            status=FiscalInvoiceStatus.ISSUED,
            amount=Decimal("80"),
            aade_mark="MARK-X",
            idempotency_key="idem-x",
            metadata_json={},
        )
        fields = build_fiscal_customer_fields(booking, [invoice], tenant=tenant)
        self.assertEqual(fields["issuerName"], "Travel AE")
        self.assertEqual(fields["issuerVat"], "123456789")
        self.assertEqual(fields["fiscalDocuments"][0]["amount_eur"], 80.0)


if __name__ == "__main__":
    unittest.main()
