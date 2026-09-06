"""Guest booking create — unpaid office holds + amount validation."""

from __future__ import annotations

import unittest
from decimal import Decimal
from uuid import uuid4

from pydantic import ValidationError

from app.api.schemas import GuestBookingCreate
from api.admin_booking_mapper import local_id_from_reference


class GuestBookingCreateTests(unittest.TestCase):
    def test_allows_zero_paid_with_total(self):
        body = GuestBookingCreate(
            tenant_id=uuid4(),
            passenger_name="Office Guest",
            amount_eur=Decimal("0"),
            total_eur=Decimal("120"),
            payment_method="cash_on_bus",
            source="Office Walk-in",
            agent_name="Γραφείο",
        )
        self.assertEqual(body.amount_eur, Decimal("0"))
        self.assertEqual(body.source, "Office Walk-in")

    def test_rejects_zero_total(self):
        with self.assertRaises(ValidationError):
            GuestBookingCreate(
                tenant_id=uuid4(),
                passenger_name="X",
                amount_eur=Decimal("0"),
                total_eur=Decimal("0"),
            )

    def test_local_id_from_bk(self):
        self.assertEqual(local_id_from_reference("BK-0995"), "B-0995")


if __name__ == "__main__":
    unittest.main()
