"""Admin booking hard-delete endpoint must exist for office Διαγραφή."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class AdminBookingDeleteContractTests(unittest.TestCase):
    def test_delete_route_present(self) -> None:
        src = (ROOT / "backend" / "api" / "admin_bookings_router.py").read_text(
            encoding="utf-8"
        )
        self.assertIn('@router.delete("/api/admin/platform/bookings/{booking_key}")', src)
        self.assertIn("async def delete_admin_booking", src)
        self.assertIn("await db.delete(booking)", src)

    def test_frontend_wires_delete(self) -> None:
        panel = (ROOT / "src" / "components" / "booking" / "BookingDetailPanel.jsx").read_text(
            encoding="utf-8"
        )
        self.assertIn("onDelete", panel)
        self.assertIn("Διαγραφή", panel)
        api = (ROOT / "src" / "services" / "adminBookingsApi.js").read_text(encoding="utf-8")
        self.assertIn("deleteAdminBooking", api)
        store = (ROOT / "src" / "lib" / "ticketing" / "bookingStore.js").read_text(
            encoding="utf-8"
        )
        self.assertIn("export async function deleteBooking", store)
        back = (ROOT / "src" / "pages" / "BackOffice.jsx").read_text(encoding="utf-8")
        self.assertIn("handleDelete", back)
        self.assertIn("onDelete={handleDelete}", back)


if __name__ == "__main__":
    unittest.main()
