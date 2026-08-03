"""Bookings menu always opens list home; admin back buttons stay visible."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class BookingsHomeBackContractTests(unittest.TestCase):
    def test_buses_hub_bookings_clears_selection(self) -> None:
        page = (ROOT / "src" / "pages" / "BackOffice.jsx").read_text(encoding="utf-8")
        self.assertIn("goToBookingsHome", page)
        self.assertIn("if (next === 'bookings')", page)
        self.assertIn("if (tab === 'bookings')", page)
        self.assertIn("setSelectedBooking(null)", page)

    def test_booking_detail_admin_back_is_visible(self) -> None:
        panel = (
            ROOT / "src" / "components" / "booking" / "BookingDetailPanel.jsx"
        ).read_text(encoding="utf-8")
        self.assertIn("Πίσω στις Κρατήσεις", panel)
        # Admin (not fullPage) must use dark text — not white-on-white.
        self.assertIn("text-zinc-800", panel)
        self.assertIn("border-zinc-200", panel)

    def test_customer_detail_has_back_button(self) -> None:
        crm = (
            ROOT / "src" / "components" / "admin" / "CustomersCrmPanel.jsx"
        ).read_text(encoding="utf-8")
        self.assertIn("Πίσω", crm)
        self.assertIn("arrow_back", crm)
        self.assertIn("onBack={() => setSelectedCustomer(null)}", crm)


if __name__ == "__main__":
    unittest.main()
