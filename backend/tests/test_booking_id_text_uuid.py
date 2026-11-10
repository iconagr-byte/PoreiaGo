"""Cash find must compare bookings.id as text (Contabo TEXT PK vs ORM UUID)."""

from __future__ import annotations

import unittest
from uuid import uuid4

from api.admin_bookings_router import _is_booking_id_type_mismatch
from app.services.booking_payment_service import _booking_id_eq


class BookingIdTextUuidTests(unittest.TestCase):
    def test_detects_text_eq_uuid_operator_error(self):
        exc = Exception(
            "ProgrammingError: operator does not exist: text = uuid "
            "HINT: No operator matches the given name and argument types."
        )
        self.assertTrue(_is_booking_id_type_mismatch(exc))

    def test_ignores_unrelated(self):
        self.assertFalse(_is_booking_id_type_mismatch(RuntimeError("timeout")))

    def test_booking_id_eq_casts_to_string(self):
        clause = _booking_id_eq(uuid4())
        sql = str(clause)
        self.assertIn("CAST", sql.upper())
        self.assertIn("bookings.id", sql)


if __name__ == "__main__":
    unittest.main()
