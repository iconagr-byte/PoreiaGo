"""Audience segments — μέτρηση & επίλυση παραληπτών."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ticketing.customer_bookings import list_all_bookings
from ticketing.db import get_db

from email_client.store import list_subscribers

from .constants import (
    AUDIENCE_ACTIVE_30D,
    AUDIENCE_ALL,
    AUDIENCE_INACTIVE_6M,
    AUDIENCE_NEVER_BOUGHT,
    AUDIENCE_NEW_30D,
    AUDIENCE_RECENT_BUYERS,
    AUDIENCE_SUBSCRIBED_ONLY,
    AUDIENCE_WITH_PURCHASE,
)

SEGMENT_META = [
    {"id": AUDIENCE_ALL, "label": "Όλοι οι πελάτες", "description": "Όλοι με λογαριασμό & email (GDPR έλεγχος στη αποστολή)"},
    {
        "id": AUDIENCE_SUBSCRIBED_ONLY,
        "label": "Newsletter (εγγεγραμμένοι)",
        "description": "Μόνο λίστα εγγραφών newsletter — GDPR",
    },
    {
        "id": AUDIENCE_ACTIVE_30D,
        "label": "Ενεργοί (< 30 ημέρες)",
        "description": "Αγορά / κράτηση τις τελευταίες 30 ημέρες",
    },
    {
        "id": AUDIENCE_RECENT_BUYERS,
        "label": "Πρόσφατες κρατήσεις (90 ημ.)",
        "description": "Κράτηση τις τελευταίες 90 ημέρες",
    },
    {
        "id": AUDIENCE_NEW_30D,
        "label": "Νέοι πελάτες (30 ημ.)",
        "description": "Πρώτη κράτηση τις τελευταίες 30 ημέρες",
    },
    {
        "id": AUDIENCE_WITH_PURCHASE,
        "label": "Με τουλάχιστον 1 αγορά",
        "description": "Έχουν κάνει έστω μία κράτηση στο παρελθόν",
    },
    {
        "id": AUDIENCE_NEVER_BOUGHT,
        "label": "Χωρίς αγορά",
        "description": "Λογαριασμός αλλά χωρίς κράτηση — re-engagement",
    },
    {
        "id": AUDIENCE_INACTIVE_6M,
        "label": "Ανενεργοί (> 6 μήνες)",
        "description": "Τελευταία αγορά πριν από 6+ μήνες",
    },
]


def _today() -> datetime:
    return datetime.now(timezone.utc)


async def _emails_with_last_purchase() -> dict[str, dict]:
    """email -> {name, last_purchase_iso or None}"""
    db = get_db()
    cur = await db.execute(
        "SELECT email, name FROM customer_accounts WHERE email IS NOT NULL AND email != ''"
    )
    accounts = await cur.fetchall()
    by_email: dict[str, dict] = {}
    for row in accounts:
        email = str(row["email"]).strip().lower()
        if not email or "@" not in email:
            continue
        by_email[email] = {
            "email": email,
            "name": row["name"] or email.split("@")[0],
            "last_purchase": None,
        }

    bookings = await list_all_bookings()
    for b in bookings:
        email = str(b.get("email") or "").strip().lower()
        if not email or email not in by_email:
            continue
        bdate = str(b.get("date") or "")
        if not bdate:
            continue
        prev = by_email[email]["last_purchase"]
        if not prev or bdate > prev:
            by_email[email]["last_purchase"] = bdate
            name = b.get("customerName") or b.get("customer_name")
            if name:
                by_email[email]["name"] = name
    return by_email


async def _first_purchase_by_email() -> dict[str, str | None]:
    """email -> earliest booking date (ISO)."""
    bookings = await list_all_bookings()
    first: dict[str, str | None] = {}
    for b in bookings:
        email = str(b.get("email") or "").strip().lower()
        bdate = str(b.get("date") or "")
        if not email or not bdate:
            continue
        if email not in first or bdate < first[email]:
            first[email] = bdate
    return first


async def resolve_audience_segment(segment_id: str) -> list[dict]:
    key = (segment_id or AUDIENCE_ALL).strip().lower()

    if key == AUDIENCE_SUBSCRIBED_ONLY:
        subs = await list_subscribers(subscribed_only=True)
        return [
            {"email": s["email"], "name": s.get("name") or s["email"].split("@")[0]}
            for s in subs
            if s.get("email")
        ]

    customers = await _emails_with_last_purchase()
    first_purchase = await _first_purchase_by_email()
    today = _today().date()
    cutoff_30 = (today - timedelta(days=30)).isoformat()
    cutoff_90 = (today - timedelta(days=90)).isoformat()
    cutoff_180 = (today - timedelta(days=180)).isoformat()

    out: list[dict] = []
    for c in customers.values():
        last = c.get("last_purchase")
        email = c["email"]
        first = first_purchase.get(email)
        if key == AUDIENCE_ALL:
            out.append({"email": email, "name": c["name"]})
        elif key == AUDIENCE_ACTIVE_30D:
            if last and last >= cutoff_30:
                out.append({"email": email, "name": c["name"]})
        elif key == AUDIENCE_INACTIVE_6M:
            if last and last < cutoff_180:
                out.append({"email": email, "name": c["name"]})
        elif key == AUDIENCE_RECENT_BUYERS:
            if last and last >= cutoff_90:
                out.append({"email": email, "name": c["name"]})
        elif key == AUDIENCE_NEVER_BOUGHT:
            if not last:
                out.append({"email": email, "name": c["name"]})
        elif key == AUDIENCE_WITH_PURCHASE:
            if last:
                out.append({"email": email, "name": c["name"]})
        elif key == AUDIENCE_NEW_30D:
            if first and first >= cutoff_30:
                out.append({"email": email, "name": c["name"]})
        else:
            out.append({"email": email, "name": c["name"]})
    return out


async def count_segment(segment_id: str) -> int:
    try:
        return len(await resolve_audience_segment(segment_id))
    except Exception:
        return 0


async def list_segments_with_counts() -> list[dict]:
    result = []
    for meta in SEGMENT_META:
        count = await count_segment(meta["id"])
        result.append({**meta, "count": count, "label_count": f"{meta['label']}: {count} πελάτες"})
    return result
