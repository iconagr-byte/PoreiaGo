"""Tests for fiscal fields in admin booking mapper."""

from __future__ import annotations

import unittest
from types import SimpleNamespace

from uuid import uuid4

from api.admin_booking_mapper import build_fiscal_admin_fields
from app.models.fiscal_invoice import FiscalInvoiceKind, FiscalInvoiceStatus


def _invoice(
    *,
    status: FiscalInvoiceStatus,
    mark: str | None = None,
    provider: str | None = None,
    kind: FiscalInvoiceKind = FiscalInvoiceKind.FULL_PAYMENT,
    amount: float = 50.0,
):
    return SimpleNamespace(
        id=uuid4(),
        status=status,
        aade_mark=mark,
        invoice_kind=kind,
        amount=amount,
        error_message=None,
        metadata_json={"fiscal_provider": provider} if provider else {},
    )


class BuildFiscalAdminFieldsTests(unittest.TestCase):
    def test_issued_invoice_exposes_mark_and_provider(self):
        booking = SimpleNamespace(fiscal_mark=None)
        invoices = [
            _invoice(status=FiscalInvoiceStatus.ISSUED, mark="MARK-1", provider="prosvasis"),
        ]
        fields = build_fiscal_admin_fields(booking, invoices)  # type: ignore[arg-type]
        self.assertEqual(fields["fiscal_mark"], "MARK-1")
        self.assertEqual(fields["fiscal_provider"], "prosvasis")
        self.assertEqual(fields["fiscal_status"], "issued")

    def test_pending_without_mark(self):
        booking = SimpleNamespace(fiscal_mark=None)
        invoices = [_invoice(status=FiscalInvoiceStatus.QUEUED)]
        fields = build_fiscal_admin_fields(booking, invoices)  # type: ignore[arg-type]
        self.assertIsNone(fields["fiscal_mark"])
        self.assertEqual(fields["fiscal_status"], "pending")

    def test_multiple_marks_for_partial_payments(self):
        booking = SimpleNamespace(fiscal_mark="MARK-2")
        invoices = [
            _invoice(status=FiscalInvoiceStatus.ISSUED, mark="MARK-1", provider="epsilon"),
            _invoice(status=FiscalInvoiceStatus.ISSUED, mark="MARK-2", provider="epsilon"),
        ]
        fields = build_fiscal_admin_fields(booking, invoices)  # type: ignore[arg-type]
        self.assertEqual(fields["fiscal_marks"], ["MARK-1", "MARK-2"])
        self.assertEqual(fields["fiscal_mark"], "MARK-2")
        self.assertEqual(len(fields["fiscal_receipts"]), 2)


if __name__ == "__main__":
    unittest.main()
