"""Lookup keys for cash capture — PNR vs local booking id."""

from __future__ import annotations

import unittest

from api.payment_settings_router import RecordCashPaymentBody, _cash_booking_lookup_keys


class CashBookingLookupKeysTests(unittest.TestCase):
    def test_includes_url_pnr_and_cache_id(self):
        body = RecordCashPaymentBody(
            amount=64.6,
            channel="office_counter",
            reference_code="BKHYDK37BA",
        )
        booking = {
            "id": "B-1739123456789",
            "pnr": "BKHYDK37BA",
            "ticketRef": "BK-HYDK37BA",
        }
        keys = _cash_booking_lookup_keys("B-1739123456789", booking, body)
        self.assertEqual(keys[0], "B-1739123456789")
        self.assertIn("BKHYDK37BA", keys)
        self.assertIn("BK-HYDK37BA", keys)
        self.assertEqual(len(keys), len(set(keys)))

    def test_skips_blanks(self):
        body = RecordCashPaymentBody(amount=10, channel="driver_on_bus", reference_code="  ")
        keys = _cash_booking_lookup_keys("BK-1", {"pnr": None, "id": ""}, body)
        self.assertEqual(keys, ["BK-1"])


if __name__ == "__main__":
    unittest.main()
