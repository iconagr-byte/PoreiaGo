"""Guest booking helpers — safe audit IP + trip match for occupied seats."""

from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.api.bookings import _safe_audit_ip
from app.services.seat_occupancy import booking_matches_external_trip


class GuestBookingAuditIpTests(unittest.TestCase):
    def test_accepts_ipv4(self):
        self.assertEqual(_safe_audit_ip("1.2.3.4"), "1.2.3.4")

    def test_rejects_hostname(self):
        self.assertIsNone(_safe_audit_ip("proxy.internal"))
        self.assertIsNone(_safe_audit_ip("unknown"))

    def test_accepts_ipv6(self):
        self.assertEqual(_safe_audit_ip("2001:db8::1"), "2001:db8::1")


class BookingTripMatchTests(unittest.TestCase):
    def test_matches_metadata_external_trip_id(self):
        booking = SimpleNamespace(
            trip_id=None,
            metadata_json={"external_trip_id": 91001},
        )
        self.assertTrue(booking_matches_external_trip(booking, 91001))
        self.assertFalse(booking_matches_external_trip(booking, 91002))

    def test_matches_orm_trip_id_column(self):
        booking = SimpleNamespace(trip_id=91001, metadata_json={})
        self.assertTrue(booking_matches_external_trip(booking, 91001))

    def test_matches_string_metadata(self):
        booking = SimpleNamespace(
            trip_id=None,
            metadata_json={"external_trip_id": "91001"},
        )
        self.assertTrue(booking_matches_external_trip(booking, 91001))


if __name__ == "__main__":
    unittest.main()
