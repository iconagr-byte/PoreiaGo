"""Tests for fiscal transmission service helpers."""

from __future__ import annotations

import unittest
from datetime import date
from decimal import Decimal
from uuid import uuid4

from app.models.booking import Booking, PaymentStatus
from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceKind, FiscalInvoiceStatus
from app.services.fiscal_transmission_service import (
    build_booking_fiscal_data,
    infer_platform_payment_method,
    stable_serial_number,
)
from travel_platform.compliance.fiscal_models import FiscalDocumentCategory, PlatformPaymentMethod


class FiscalTransmissionHelperTests(unittest.TestCase):
    def test_infer_credit_card_from_metadata(self):
        booking = Booking(
            passenger_name="Test",
            reference_code="BK-1",
            total_price=Decimal("100"),
            amount_paid=Decimal("100"),
            amount_eur=Decimal("100"),
            metadata_json={"payment_method": "Credit Card (Stripe)"},
        )
        self.assertEqual(
            infer_platform_payment_method(booking, {}),
            PlatformPaymentMethod.CREDIT_CARD,
        )

    def test_build_booking_fiscal_data_retail_receipt(self):
        booking = Booking(
            passenger_name="Maria",
            passenger_email="maria@example.com",
            reference_code="BK-99",
            total_price=Decimal("124"),
            amount_paid=Decimal("124"),
            amount_eur=Decimal("124"),
            payment_status=PaymentStatus.PAID,
            metadata_json={"trip_title": "Μετέωρα", "payment_method": "cash"},
        )
        invoice = FiscalInvoice(
            tenant_id=uuid4(),
            booking_id=uuid4(),
            invoice_kind=FiscalInvoiceKind.FULL_PAYMENT,
            status=FiscalInvoiceStatus.PENDING,
            amount=Decimal("124.00"),
            idempotency_key="idem-1",
        )
        payload = {"vat_rate": 24, "amount_eur": 124.0, "line_items": [{"description": "x"}]}

        data = build_booking_fiscal_data(
            booking=booking,
            invoice=invoice,
            payload=payload,
            tenant_settings_json='{"fiscal":{"issuer_vat":"998877665","series_retail":"ΑΠΥ"}}',
        )
        self.assertEqual(data.issuer_vat, "998877665")
        self.assertEqual(data.series, "ΑΠΥ")
        self.assertEqual(data.document_category, FiscalDocumentCategory.RETAIL_RECEIPT)
        self.assertEqual(data.resolved_payment_method, PlatformPaymentMethod.CASH)
        self.assertEqual(data.gross_amount, Decimal("124.00"))

    def test_stable_serial_number_is_deterministic(self):
        invoice_id = uuid4()
        self.assertEqual(
            stable_serial_number(invoice_id),
            stable_serial_number(invoice_id),
        )


if __name__ == "__main__":
    unittest.main()
