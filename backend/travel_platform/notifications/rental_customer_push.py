"""Web Push reminders for customer rental pickups."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


def _clip(text: str, limit: int = 140) -> str:
    clean = " ".join(str(text or "").split())
    if len(clean) <= limit:
        return clean
    return clean[: max(0, limit - 1)].rstrip() + "…"


def _parse_dt(value: Any) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _hours_until(start: datetime, *, now: datetime | None = None) -> float:
    ref = now or datetime.now(timezone.utc)
    return (start - ref).total_seconds() / 3600.0


async def notify_rental_reminder_to_customer(booking: dict[str, Any]) -> dict[str, Any]:
    """Send a pickup reminder Web Push to the booking customer email."""
    from travel_platform.notifications.web_push_service import (
        ensure_web_push_keys,
        send_push_to_email,
        web_push_configured,
    )

    ensure_web_push_keys()
    if not web_push_configured():
        return {"skipped": True, "reason": "vapid_not_configured"}

    email = str(booking.get("client_email") or "").strip().lower()
    if not email or "@" not in email:
        return {"skipped": True, "reason": "no_customer_email"}

    booking_id = str(booking.get("id") or "")
    plate = str(booking.get("vehicle_plate") or booking.get("vehicle_model") or "Όχημα")
    start = booking.get("start_time") or ""
    pickup = str(booking.get("pickup_location") or "—")
    body = _clip(f"{plate} · {pickup} · {start}")
    payload = {
        "title": "Υπενθύμιση παραλαβής οχήματος",
        "body": body or f"Κράτηση {booking_id}",
        "url": "/rent?tab=wallet",
        "tag": f"rental-reminder-{booking_id or 'x'}",
        "renotify": True,
        "data": {
            "type": "rental_reminder",
            "booking_id": booking_id or None,
            "url": "/rent?tab=wallet",
        },
    }
    result = await send_push_to_email(email, payload)
    logger.info(
        "rental-customer reminder booking=%s email=%s sent=%s",
        booking_id,
        email,
        result.get("sent"),
    )
    return {"ok": bool(result.get("sent")), **result, "title": payload["title"]}


async def scan_and_notify_upcoming_rentals(*, within_hours: float = 24) -> dict[str, Any]:
    """Scan JSON store for CONFIRMED bookings starting within within_hours."""
    from travel_platform.rental import rental_store as store

    now = datetime.now(timezone.utc)
    window = float(within_hours or 24)
    attempted = 0
    sent = 0
    matched = 0
    with store._LOCK:
        bookings = list(store._read().get("bookings") or [])

    for booking in bookings:
        if str(booking.get("rental_status") or "").upper() != "CONFIRMED":
            continue
        start = _parse_dt(booking.get("start_time"))
        if not start:
            continue
        hours = _hours_until(start, now=now)
        if hours < 0 or hours > window:
            continue
        matched += 1
        attempted += 1
        try:
            result = await notify_rental_reminder_to_customer(booking)
            if result.get("sent") or result.get("ok"):
                sent += 1
        except Exception:
            logger.exception("rental reminder scan failed booking=%s", booking.get("id"))

    return {
        "ok": True,
        "matched": matched,
        "attempted": attempted,
        "sent": sent,
        "within_hours": window,
    }


async def maybe_remind_if_soon(
    booking: dict[str, Any],
    *,
    within_hours: float = 48,
) -> dict[str, Any]:
    """Send reminder if booking starts within within_hours (opt-in after create / wallet)."""
    start = _parse_dt(booking.get("start_time"))
    if not start:
        return {"skipped": True, "reason": "no_start"}
    if str(booking.get("rental_status") or "").upper() != "CONFIRMED":
        return {"skipped": True, "reason": "not_confirmed"}
    hours = _hours_until(start)
    if hours < 0 or hours > float(within_hours or 48):
        return {"skipped": True, "reason": "outside_window", "hours_until_start": round(hours, 2)}
    return await notify_rental_reminder_to_customer(booking)
