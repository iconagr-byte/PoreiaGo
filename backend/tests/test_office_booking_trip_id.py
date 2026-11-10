"""Cash upsert mapper — office trip ids are integers (never UUID)."""

from __future__ import annotations

import unittest
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Integer

from api.admin_booking_mapper import _coerce_office_trip_id, ensure_booking_from_admin_dict
from app.models.booking import Booking


class OfficeTripIdCoercionTests(unittest.TestCase):
    def test_booking_trip_id_column_is_integer(self):
        self.assertIsInstance(Booking.__table__.c.trip_id.type, Integer)

    def test_coerce_from_trip_id_and_external(self):
        self.assertEqual(_coerce_office_trip_id({"tripId": 12}, {}), 12)
        self.assertEqual(_coerce_office_trip_id({"external_trip_id": "9"}, {}), 9)
        meta: dict = {}
        self.assertEqual(_coerce_office_trip_id({}, {"external_trip_id": 3}), 3)
        self.assertEqual(meta.get("external_trip_id"), None)
        meta2: dict = {}
        self.assertEqual(_coerce_office_trip_id({"trip_id": 5}, meta2), 5)
        self.assertEqual(meta2.get("external_trip_id"), 5)
        self.assertIsNone(_coerce_office_trip_id({"tripId": "abc"}, {}))
        self.assertIsNone(_coerce_office_trip_id({}, {}))

    def test_ensure_booking_sets_integer_trip_id(self):
        booking = ensure_booking_from_admin_dict(
            uuid4(),
            {
                "pnr": "BK-MG43T7G367",
                "price": 64.6,
                "amountPaid": 0,
                "customerName": "Μαρία",
                "email": "maria@example.com",
                "tripId": 1,
                "seats": ["12A", "12B"],
            },
        )
        self.assertEqual(booking.trip_id, 1)
        self.assertEqual(booking.metadata_json.get("external_trip_id"), 1)
        self.assertEqual(booking.total_price, Decimal("64.6"))


if __name__ == "__main__":
    unittest.main()
