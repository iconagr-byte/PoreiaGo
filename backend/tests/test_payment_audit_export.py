"""Tests for payment audit CSV export."""

from __future__ import annotations

import csv
import io
import unittest

from travel_platform.settings.payment_audit_store import (
    filter_payment_audit,
    payment_audit_action_label,
    serialize_payment_audit_csv,
)


class PaymentAuditExportTests(unittest.TestCase):
    def test_filter_fiscal_only(self):
        rows = [
            {"action": "fiscal_receipt_issued", "booking_id": "B-1"},
            {"action": "bank_deposit_confirmed", "booking_id": "B-2"},
            {"action": "fiscal_manual_issue", "booking_id": "B-3"},
        ]
        filtered = filter_payment_audit(rows, fiscal_only=True)
        self.assertEqual(len(filtered), 2)
        self.assertEqual({r["booking_id"] for r in filtered}, {"B-1", "B-3"})

    def test_action_label_greek(self):
        self.assertEqual(
            payment_audit_action_label("fiscal_receipt_issued"),
            "Έκδοση φορολογικής απόδειξης",
        )

    def test_csv_contains_rows_and_bom(self):
        rows = [
            {
                "at": "2026-06-09T10:00:00+00:00",
                "action": "fiscal_receipt_issued",
                "booking_id": "B-100",
                "amount_eur": 45.0,
                "reference": "VOY-1",
                "detail": "MARK 123",
                "actor_id": "admin-1",
                "metadata": {"mark": "123", "provider": "native_aade", "invoice_id": "inv-1"},
            },
        ]
        raw = serialize_payment_audit_csv(rows)
        self.assertTrue(raw.startswith(b"\xef\xbb\xbf"))
        text = raw.decode("utf-8-sig")
        parsed = list(csv.reader(io.StringIO(text)))
        self.assertEqual(parsed[0][0], "Ημ/νία UTC")
        self.assertEqual(parsed[1][2], "B-100")
        self.assertEqual(parsed[1][6], "123")
        self.assertEqual(parsed[1][7], "native_aade")


if __name__ == "__main__":
    unittest.main()
