"""Admin booking hard-delete endpoint must exist for office Διαγραφή."""

from __future__ import annotations

import ast
import inspect
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]


class AdminBookingDeleteContractTests(unittest.TestCase):
    def test_delete_route_present(self) -> None:
        src = (ROOT / "backend" / "api" / "admin_bookings_router.py").read_text(
            encoding="utf-8"
        )
        self.assertIn('@router.delete("/api/admin/platform/bookings/{booking_key}")', src)
        self.assertIn("async def delete_admin_booking", src)
        self.assertIn("_hard_delete_booking", src)
        self.assertIn("id::text", src)
        # Must not use ORM session.delete (binds UUID against Contabo TEXT PK).
        self.assertNotIn("await db.delete(booking)", src)

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

    def test_hard_delete_uses_text_cast_not_orm_uuid(self) -> None:
        from api.admin_bookings_router import _hard_delete_booking

        src = inspect.getsource(_hard_delete_booking)
        self.assertIn("cast(Booking.id, String)", src)
        self.assertIn("expunge", src)
        tree = ast.parse(src)
        # No bare session.delete / await session.delete in the helper body.
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute) and node.attr == "delete":
                # allow sqlalchemy.delete(...) import usage via Name, not session.delete
                if isinstance(node.value, ast.Name) and node.value.id in {
                    "session",
                    "db",
                }:
                    self.fail("ORM session.delete must not be used for Contabo TEXT PK")


class HardDeleteBookingUnitTests(unittest.IsolatedAsyncioTestCase):
    async def test_hard_delete_executes_cast_delete(self) -> None:
        from api.admin_bookings_router import _hard_delete_booking

        session = AsyncMock()
        result = MagicMock()
        result.rowcount = 1
        session.execute = AsyncMock(return_value=result)
        session.expunge = MagicMock()

        booking = MagicMock()
        booking.id = uuid4()
        tid = uuid4()

        await _hard_delete_booking(session, booking, tid)

        session.expunge.assert_called_once_with(booking)
        session.execute.assert_awaited()
        # Only the sqlalchemy delete(...cast...) path — no raw fallback.
        self.assertEqual(session.execute.await_count, 1)


if __name__ == "__main__":
    unittest.main()
