"""Guest B2C checkout returns wallet_activate_token; office desk does not."""

from __future__ import annotations

import unittest
from decimal import Decimal
from uuid import uuid4

from app.api.schemas import GuestBookingResponse


class GuestCheckoutActivateTokenTests(unittest.TestCase):
    def test_guest_response_carries_optional_activate_token(self):
        row = GuestBookingResponse(
            id=uuid4(),
            tenant_id=uuid4(),
            reference_code="BK-GUEST1",
            status="paid",
            payment_status="paid",
            total_price=Decimal("42.75"),
            amount_paid=Decimal("42.75"),
            amount_eur=Decimal("42.75"),
            passenger_email="guest@example.com",
            wallet_activate_token="tok_test_1234567890",
        )
        self.assertEqual(row.wallet_activate_token, "tok_test_1234567890")

    def test_activate_token_optional_for_office_shaped_responses(self):
        row = GuestBookingResponse(
            id=uuid4(),
            tenant_id=uuid4(),
            reference_code="BK-OFFICE1",
            status="confirmed",
            payment_status="pending",
            total_price=Decimal("100"),
            amount_paid=Decimal("0"),
            amount_eur=Decimal("100"),
        )
        self.assertIsNone(row.wallet_activate_token)


if __name__ == "__main__":
    unittest.main()
