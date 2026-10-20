"""Guest booking create — unpaid office holds + amount validation."""

from __future__ import annotations

import unittest
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from pydantic import ValidationError

from app.api.schemas import GuestBookingCreate
from api.admin_booking_mapper import booking_to_admin_dict, local_id_from_reference
from app.models.booking import BookingStatus, PaymentStatus


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

    def test_admin_mapper_surfaces_wallet_account_link(self):
        """Logged-in My Wallet checkout stamps metadata so office CRM sees who booked."""
        booking = SimpleNamespace(
            id=uuid4(),
            reference_code="BK-ACCT1",
            customer_user_id=None,
            passenger_name="Νίκος Πελάτης",
            passenger_email="nikos@example.com",
            passenger_vat_id=None,
            notes=None,
            seat_label="3A",
            status=BookingStatus.CONFIRMED,
            payment_status=PaymentStatus.PAID,
            total_price=Decimal("40"),
            amount_paid=Decimal("40"),
            amount_eur=Decimal("40"),
            created_at=None,
            tenant_id=uuid4(),
            fiscal_mark=None,
            metadata_json={
                "trip_title": "Μετέωρα",
                "seats": ["3A"],
                "phone": "6900000000",
                "account_linked": True,
                "wallet_customer_email": "nikos@example.com",
                "wallet_customer_id": "CUST-42",
                "source": "Web",
            },
        )
        row = booking_to_admin_dict(booking)
        self.assertTrue(row["accountLinked"])
        self.assertEqual(row["customerId"], "CUST-42")
        self.assertEqual(row["walletCustomerId"], "CUST-42")
        self.assertEqual(row["walletCustomerEmail"], "nikos@example.com")
        self.assertEqual(row["email"], "nikos@example.com")


if __name__ == "__main__":
    unittest.main()
