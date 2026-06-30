"""Επίλυση audience_filter → λίστα παραληπτών."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ticketing.customer_bookings import list_all_bookings
from ticketing.db import get_db

from .constants import AUDIENCE_ALL, AUDIENCE_RECENT_BUYERS
from .segments import resolve_audience_segment


async def resolve_audience(audience_filter: str) -> list[dict]:
    """
    Επιστρέφει [{email, name}, ...] για μαζική αποστολή.
    """
    key = (audience_filter or AUDIENCE_ALL).strip().lower()
    return await resolve_audience_segment(key)


async def _all_customers_with_email() -> list[dict]:
    db = get_db()
    cur = await db.execute(
        """
        SELECT email, name FROM customer_accounts
        WHERE email IS NOT NULL AND email != ''
        ORDER BY name
        """
    )
    rows = await cur.fetchall()
    seen: set[str] = set()
    out: list[dict] = []
    for row in rows:
        email = str(row["email"]).strip().lower()
        if not email or "@" not in email or email in seen:
            continue
        seen.add(email)
        out.append({"email": email, "name": row["name"] or email.split("@")[0]})
    return out


async def _recent_buyers(days: int = 90) -> list[dict]:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    bookings = await list_all_bookings()
    by_email: dict[str, dict] = {}

    for b in bookings:
        email = str(b.get("email") or "").strip().lower()
        if not email or "@" not in email:
            continue
        bdate = str(b.get("date") or "")
        if bdate and bdate < cutoff:
            continue
        name = b.get("customerName") or b.get("customer_name") or email.split("@")[0]
        by_email[email] = {"email": email, "name": name}

    if by_email:
        return list(by_email.values())

    accounts = await _all_customers_with_email()
    return accounts[:50]
