"""Tests for fiscal queue listing."""

from __future__ import annotations

import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from app.models.fiscal_invoice import FiscalInvoiceKind, FiscalInvoiceStatus
from app.services.fiscal_queue_service import fiscal_queue_item


class FiscalQueueItemTests(unittest.TestCase):
    def test_maps_invoice_and_booking(self):
        booking_id = uuid4()
        invoice_id = uuid4()
        booking = SimpleNamespace(
            id=booking_id,
            reference_code="BK-QUEUE1",
            passenger_name="Nikos",
            metadata_json={"trip_title": "Δελφοί"},
        )
        invoice = SimpleNamespace(
            id=invoice_id,
            amount=Decimal("45.00"),
            status=FiscalInvoiceStatus.FAILED,
            invoice_kind=FiscalInvoiceKind.DOWN_PAYMENT,
            aade_mark=None,
            error_message="Timeout",
            metadata_json={"channel": "stripe", "fiscal_provider": "native_aade"},
            updated_at=SimpleNamespace(isoformat=lambda: "2026-06-09T12:00:00"),
        )
        item = fiscal_queue_item(invoice, booking)  # type: ignore[arg-type]
        self.assertEqual(item["booking_id"], "B-QUEUE1")
        self.assertEqual(item["status"], "failed")
        self.assertEqual(item["invoice_kind"], "down_payment")
        self.assertEqual(item["channel"], "stripe")


if __name__ == "__main__":
    unittest.main()
