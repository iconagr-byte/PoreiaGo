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

    def test_accepts_party_passengers(self):
        body = GuestBookingCreate(
            tenant_id=uuid4(),
            passenger_name="Μαρία Παπαδοπούλου",
            amount_eur=Decimal("64.60"),
            total_eur=Decimal("64.60"),
            seats=["5A", "5B"],
            passengers=[
                {"seat": "5A", "name": "Μαρία Παπαδοπούλου", "role": "booker"},
                {"seat": "5B", "name": "Γιάννης Παπαδόπουλος", "role": "companion"},
            ],
        )
        self.assertEqual(len(body.passengers), 2)
        self.assertEqual(body.passengers[1]["role"], "companion")


if __name__ == "__main__":
    unittest.main()
