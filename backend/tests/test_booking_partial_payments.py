"""Unit tests for partial payment + fiscal invoice logic."""

from decimal import Decimal
import unittest

from app.models.booking import Booking, PaymentStatus
from app.services.fiscal_invoice_service import resolve_invoice_kind
from app.models.fiscal_invoice import FiscalInvoiceKind


class PaymentStatusTests(unittest.TestCase):
    def test_sync_pending(self):
        b = Booking(
            passenger_name="Test",
            reference_code="BK-TEST",
            total_price=Decimal("100"),
            amount_paid=Decimal("0"),
            amount_eur=Decimal("100"),
        )
        b.sync_payment_status()
        self.assertEqual(b.payment_status, PaymentStatus.PENDING)

    def test_sync_partial(self):
        b = Booking(
            passenger_name="Test",
            reference_code="BK-TEST",
            total_price=Decimal("100"),
            amount_paid=Decimal("30"),
            amount_eur=Decimal("100"),
        )
        b.sync_payment_status()
        self.assertEqual(b.payment_status, PaymentStatus.PARTIAL)

    def test_sync_paid(self):
        b = Booking(
            passenger_name="Test",
            reference_code="BK-TEST",
            total_price=Decimal("100"),
            amount_paid=Decimal("100"),
            amount_eur=Decimal("100"),
        )
        b.sync_payment_status()
        self.assertEqual(b.payment_status, PaymentStatus.PAID)


class InvoiceKindTests(unittest.TestCase):
    def test_full_payment(self):
        kind = resolve_invoice_kind(
            previous_paid=Decimal("0"),
            new_paid=Decimal("80"),
            total_price=Decimal("80"),
        )
        self.assertEqual(kind, FiscalInvoiceKind.FULL_PAYMENT)

    def test_down_payment(self):
        kind = resolve_invoice_kind(
            previous_paid=Decimal("0"),
            new_paid=Decimal("30"),
            total_price=Decimal("100"),
        )
        self.assertEqual(kind, FiscalInvoiceKind.DOWN_PAYMENT)

    def test_final_settlement(self):
        kind = resolve_invoice_kind(
            previous_paid=Decimal("30"),
            new_paid=Decimal("100"),
            total_price=Decimal("100"),
        )
        self.assertEqual(kind, FiscalInvoiceKind.FINAL_SETTLEMENT)


if __name__ == "__main__":
    unittest.main()
