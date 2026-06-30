"""Cancel ticket bookings in SQLite."""

from .db import get_db, row_to_booking, transaction


async def cancel_ticket_booking(booking_id: str) -> dict | None:
    async with transaction() as db:
        cur = await db.execute(
            "SELECT * FROM ticket_bookings WHERE id = ? OR saas_booking_id = ? LIMIT 1",
            (booking_id, booking_id),
        )
        row = await cur.fetchone()
        if not row:
            return None
        await db.execute(
            """
            UPDATE ticket_bookings
            SET payment_status = 'CANCELLED', check_in_status = 'CANCELLED'
            WHERE id = ?
            """,
            (row["id"],),
        )
        cur2 = await db.execute("SELECT * FROM ticket_bookings WHERE id = ?", (row["id"],))
        updated = await cur2.fetchone()
        return row_to_booking(updated) if updated else None
