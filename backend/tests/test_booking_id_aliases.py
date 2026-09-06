"""Canonical booking ids for wallet QR ↔ driver scan."""

from __future__ import annotations

import unittest

from api.admin_booking_mapper import booking_id_aliases, local_id_from_reference, normalize_reference
from ticketing.scan_service import is_paid


class BookingIdAliasTests(unittest.TestCase):
    def test_local_id_from_bk_reference(self):
        self.assertEqual(local_id_from_reference("BK-B95F8658"), "B-B95F8658")

    def test_local_id_strips_legacy_b_bk_prefix(self):
        self.assertEqual(local_id_from_reference("B-BK-B95F8658"), "B-B95F8658")

    def test_local_id_idempotent(self):
        self.assertEqual(local_id_from_reference("B-B95F8658"), "B-B95F8658")

    def test_aliases_cover_wallet_and_office_forms(self):
        aliases = booking_id_aliases("B-BK-B95F8658")
        self.assertIn("B-B95F8658", aliases)
        self.assertIn("BK-B95F8658", aliases)
        self.assertIn("B-BK-B95F8658", aliases)

    def test_normalize_reference(self):
        self.assertEqual(normalize_reference("B95F8658"), "BK-B95F8658")
        self.assertEqual(normalize_reference("B-B95F8658"), "BK-B95F8658")

    def test_deposit_counts_as_paid_for_boarding(self):
        self.assertTrue(is_paid("DEPOSIT"))
        self.assertTrue(is_paid("PAID (SaaS)"))
        self.assertTrue(is_paid("PARTIAL"))
        self.assertFalse(is_paid("PENDING"))
        self.assertFalse(is_paid("CANCELLED"))


if __name__ == "__main__":
    unittest.main()
