"""Tests for cash payment validation."""

import unittest

from travel_platform.payments.cash_payment_confirm import (
    CashPaymentChannel,
    validate_cash_payment_request,
)


class CashPaymentValidationTests(unittest.TestCase):
    def _booking(self, **overrides):
        base = {
            "id": "B-123",
            "pnr": "BK-123",
            "price": 100.0,
            "amountPaid": 30.0,
            "balanceDue": 70.0,
            "status": "Επιβεβαιωμένη",
        }
        base.update(overrides)
        return base

    def test_office_counter_valid(self):
        channel = validate_cash_payment_request(
            self._booking(),
            {"amount": 70.0, "channel": "office_counter", "reference_code": "BK-123"},
        )
        self.assertEqual(channel, CashPaymentChannel.OFFICE_COUNTER)

    def test_driver_valid_partial(self):
        channel = validate_cash_payment_request(
            self._booking(amountPaid=0, balanceDue=100.0),
            {"amount": 30.0, "channel": "driver_on_bus"},
        )
        self.assertEqual(channel, CashPaymentChannel.DRIVER_ON_BUS)

    def test_rejects_overpayment(self):
        with self.assertRaises(ValueError):
            validate_cash_payment_request(
                self._booking(),
                {"amount": 99.0, "channel": "office_counter"},
            )

    def test_rejects_cancelled(self):
        with self.assertRaises(ValueError):
            validate_cash_payment_request(
                self._booking(status="Ακυρωμένη"),
                {"amount": 10.0, "channel": "office_counter"},
            )


if __name__ == "__main__":
    unittest.main()
