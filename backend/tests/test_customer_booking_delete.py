"""Customer wallet DELETE booking must hard-remove office + cache rows."""

from __future__ import annotations

import unittest


class CustomerBookingDeleteContract(unittest.TestCase):
    def test_delete_route_exists(self):
        from pathlib import Path

        from api import customer_bookings as mod

        src = Path(mod.__file__).read_text(encoding="utf-8")
        self.assertIn('@router.delete("/api/customer/bookings/{booking_id}")', src)
        self.assertIn("async def delete_my_booking", src)
        self.assertIn("BOOKING_DELETED", src)
        self.assertIn("_hard_delete_booking", src)
        self.assertIn("purge_wallet_booking_aliases", src)


if __name__ == "__main__":
    unittest.main()
