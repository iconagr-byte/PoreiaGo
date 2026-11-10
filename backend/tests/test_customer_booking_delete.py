"""Customer wallet DELETE booking must hard-remove office + cache rows."""

from __future__ import annotations

import unittest
from pathlib import Path


class CustomerBookingDeleteContract(unittest.TestCase):
    def test_delete_route_exists(self):
        from api import customer_bookings as mod

        src = Path(mod.__file__).read_text(encoding="utf-8")
        self.assertIn('@router.delete("/api/customer/bookings/{booking_id}")', src)
        self.assertIn("async def delete_my_booking", src)
        self.assertIn("BOOKING_DELETED", src)
        self.assertIn("_hard_delete_booking", src)
        self.assertIn("purge_wallet_booking_aliases", src)

    def test_delete_resolves_saas_uuid_and_wallet_claim(self):
        from api import customer_bookings as mod

        src = Path(mod.__file__).read_text(encoding="utf-8")
        # Must not look up SQLite by primary key alone (UUID ≠ B- id).
        self.assertIn("find_booking_by_aliases", src)
        # Desk bookings claimed into wallet via metadata must be deletable.
        self.assertIn("wallet_customer_email", src)
        self.assertIn("_wallet_owns_booking", src)
        # Never return success when Postgres still holds the row.
        self.assertIn("Η κράτηση υπάρχει ακόμα στο γραφείο", src)
        self.assertIn("Αποτυχία διαγραφής κράτησης από το γραφείο", src)

    def test_find_booking_by_aliases_exported(self):
        from ticketing.customer_bookings import find_booking_by_aliases

        self.assertTrue(callable(find_booking_by_aliases))

    def test_wallet_owns_booking_claim_email(self):
        from types import SimpleNamespace

        from api.customer_bookings import _wallet_owns_booking

        row = SimpleNamespace(
            passenger_email="desk@office.gr",
            metadata_json={"wallet_customer_email": "me@customer.gr"},
        )
        self.assertTrue(
            _wallet_owns_booking(row, email="me@customer.gr", cached={"email": "me@customer.gr"})
        )
        self.assertTrue(_wallet_owns_booking(row, email="desk@office.gr"))
        self.assertFalse(_wallet_owns_booking(row, email="other@x.gr"))

        empty_owner = SimpleNamespace(passenger_email="", metadata_json={})
        self.assertTrue(
            _wallet_owns_booking(
                empty_owner,
                email="me@customer.gr",
                cached={"email": "me@customer.gr"},
            )
        )


if __name__ == "__main__":
    unittest.main()
