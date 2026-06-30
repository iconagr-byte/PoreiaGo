"""Tests for fiscal payment reconciliation."""

from __future__ import annotations

import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from app.models.fiscal_invoice import FiscalInvoiceKind, FiscalInvoiceStatus
from app.services.fiscal_reconciliation_service import reconciliation_row, serialize_reconciliation_csv


class FiscalReconciliationTests(unittest.TestCase):
    def test_missing_fiscal_when_paid_exceeds_issued(self):
        booking = SimpleNamespace(
            reference_code="BK-REC1",
            passenger_name="Nikos",
            amount_paid=Decimal("100"),
            metadata_json={"trip_title": "Trip"},
            updated_at=SimpleNamespace(isoformat=lambda: "2026-06-09"),
        )
        invoices = [
            SimpleNamespace(
                status=FiscalInvoiceStatus.ISSUED,
                amount=Decimal("30"),
                aade_mark="M1",
                invoice_kind=FiscalInvoiceKind.DOWN_PAYMENT,
            ),
        ]
        row = reconciliation_row(booking, invoices)  # type: ignore[arg-type]
        self.assertEqual(row["status"], "missing_fiscal")
        self.assertEqual(row["gap_eur"], 70.0)

    def test_matched_when_amounts_align(self):
        booking = SimpleNamespace(
            reference_code="BK-REC2",
            passenger_name="Anna",
            amount_paid=Decimal("50"),
            metadata_json={},
            updated_at=None,
        )
        invoices = [
            SimpleNamespace(
                status=FiscalInvoiceStatus.ISSUED,
                amount=Decimal("50"),
                aade_mark="M2",
                invoice_kind=FiscalInvoiceKind.FULL_PAYMENT,
            ),
        ]
        row = reconciliation_row(booking, invoices)  # type: ignore[arg-type]
        self.assertEqual(row["status"], "matched")
        self.assertEqual(row["gap_eur"], 0.0)

    def test_failed_row_includes_invoice_id(self):
        booking = SimpleNamespace(
            reference_code="BK-REC3",
            passenger_name="Kostas",
            amount_paid=Decimal("40"),
            metadata_json={},
            updated_at=None,
        )
        failed_id = uuid4()
        invoices = [
            SimpleNamespace(
                status=FiscalInvoiceStatus.ISSUED,
                amount=Decimal("40"),
                aade_mark="M3",
                invoice_kind=FiscalInvoiceKind.FULL_PAYMENT,
            ),
            SimpleNamespace(
                id=failed_id,
                status=FiscalInvoiceStatus.FAILED,
                amount=Decimal("40"),
                aade_mark=None,
                invoice_kind=FiscalInvoiceKind.FULL_PAYMENT,
            ),
        ]
        row = reconciliation_row(booking, invoices)  # type: ignore[arg-type]
        self.assertEqual(row["status"], "failed_receipt")
        self.assertEqual(row["failed_invoice_id"], str(failed_id))

    def test_pure_failed_prioritized_over_missing_fiscal(self):
        booking = SimpleNamespace(
            reference_code="BK-REC4",
            passenger_name="Maria",
            amount_paid=Decimal("40"),
            metadata_json={},
            updated_at=None,
        )
        failed_id = uuid4()
        invoices = [
            SimpleNamespace(
                id=failed_id,
                status=FiscalInvoiceStatus.FAILED,
                amount=Decimal("40"),
                aade_mark=None,
                invoice_kind=FiscalInvoiceKind.FULL_PAYMENT,
            ),
        ]
        row = reconciliation_row(booking, invoices)  # type: ignore[arg-type]
        self.assertEqual(row["status"], "failed_receipt")
        self.assertEqual(row["gap_eur"], 40.0)
        self.assertEqual(row["failed_invoice_id"], str(failed_id))

    def test_in_progress_before_missing_fiscal(self):
        booking = SimpleNamespace(
            reference_code="BK-REC5",
            passenger_name="Petros",
            amount_paid=Decimal("100"),
            metadata_json={},
            updated_at=None,
        )
        invoices = [
            SimpleNamespace(
                status=FiscalInvoiceStatus.ISSUED,
                amount=Decimal("30"),
                aade_mark="M5",
                invoice_kind=FiscalInvoiceKind.DOWN_PAYMENT,
            ),
            SimpleNamespace(
                status=FiscalInvoiceStatus.QUEUED,
                amount=Decimal("70"),
                aade_mark=None,
                invoice_kind=FiscalInvoiceKind.FINAL_SETTLEMENT,
            ),
        ]
        row = reconciliation_row(booking, invoices)  # type: ignore[arg-type]
        self.assertEqual(row["status"], "in_progress")
        self.assertEqual(row["gap_eur"], 70.0)

    def test_csv_export(self):
        raw = serialize_reconciliation_csv(
            [
                {
                    "booking_id": "B-1",
                    "pnr": "BK-1",
                    "customer_name": "Test",
                    "trip_title": "X",
                    "amount_paid_eur": 100,
                    "issued_fiscal_eur": 30,
                    "gap_eur": 70,
                    "status": "missing_fiscal",
                    "fiscal_invoice_count": 1,
                    "marks": ["M1"],
                },
            ],
        )
        self.assertIn("Λείπει fiscal".encode("utf-8"), raw)


if __name__ == "__main__":
    unittest.main()
