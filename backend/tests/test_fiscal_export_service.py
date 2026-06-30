"""Tests for fiscal invoice CSV export."""

from __future__ import annotations

import csv
import io
import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from app.models.fiscal_invoice import FiscalInvoiceKind, FiscalInvoiceStatus
from app.services.fiscal_export_service import fiscal_export_row, serialize_fiscal_invoices_csv


class FiscalExportTests(unittest.TestCase):
    def test_export_row_maps_booking_and_invoice(self):
        booking = SimpleNamespace(
            reference_code="BK-EXP1",
            passenger_name="Maria",
            passenger_email="maria@example.com",
            metadata_json={"trip_title": "Δελφοί"},
        )
        invoice = SimpleNamespace(
            id=uuid4(),
            invoice_kind=FiscalInvoiceKind.FULL_PAYMENT,
            status=FiscalInvoiceStatus.ISSUED,
            amount=Decimal("88.00"),
            aade_mark="MARK-EXP",
            error_message=None,
            metadata_json={"fiscal_provider": "native_aade", "channel": "stripe"},
            created_at=SimpleNamespace(isoformat=lambda: "2026-06-09T10:00:00+00:00"),
            updated_at=SimpleNamespace(isoformat=lambda: "2026-06-09T10:05:00+00:00"),
        )
        row = fiscal_export_row(invoice, booking)  # type: ignore[arg-type]
        self.assertEqual(row["booking_id"], "B-EXP1")
        self.assertEqual(row["mark"], "MARK-EXP")
        self.assertEqual(row["provider"], "native_aade")

    def test_csv_has_bom_and_headers(self):
        raw = serialize_fiscal_invoices_csv(
            [
                {
                    "created_at": "2026-06-09",
                    "updated_at": "2026-06-09",
                    "booking_id": "B-1",
                    "pnr": "BK-1",
                    "customer_name": "Test",
                    "customer_email": "t@e.com",
                    "trip_title": "Trip",
                    "invoice_id": "inv-1",
                    "invoice_kind": "Πλήρης πληρωμή",
                    "status": "Εκδόθηκε",
                    "amount_eur": 50.0,
                    "mark": "M1",
                    "provider": "native_aade",
                    "channel": "stripe",
                    "auto_retry_count": 0,
                    "error_message": "",
                },
            ],
        )
        self.assertTrue(raw.startswith(b"\xef\xbb\xbf"))
        rows = list(csv.reader(io.StringIO(raw.decode("utf-8-sig"))))
        self.assertEqual(rows[1][11], "M1")


if __name__ == "__main__":
    unittest.main()
