"""Pre-departure trip reminder emails — minimal Apple HTML, Celery-driven."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from travel_platform.settings.trip_reminder_store import (
    DEFAULT_TRIP_REMINDER,
    read_trip_reminder_settings,
)

logger = logging.getLogger(__name__)

_ATHENS = ZoneInfo("Europe/Athens")


def _esc(value: Any) -> str:
    text = str(value or "")
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _valid_email(value: Any) -> str | None:
    email = str(value or "").strip().lower()
    return email if email and "@" in email and "." in email.split("@", 1)[-1] else None


def _parse_departure(meta: dict[str, Any] | None) -> datetime | None:
    if not isinstance(meta, dict):
        return None
    raw = meta.get("departure_at") or meta.get("departureAt")
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=_ATHENS)
        return dt.astimezone(_ATHENS)
    except Exception:
        return None


def _fill(template: str, *, trip: str, days: int, office: str) -> str:
    return (
        str(template or "")
        .replace("{trip}", trip)
        .replace("{days}", str(days))
        .replace("{office}", office)
    )


def build_trip_reminder_html(
    *,
    headline: str,
    body: str,
    trip_title: str,
    when_label: str,
    seats: str,
    pnr: str,
    passenger: str,
    office_name: str = "PoreiaGo",
) -> str:
    from ticketing.payment_confirmation_email import _kv_row, _wrap_html

    rows = "".join(
        [
            _kv_row("Εκδρομή", trip_title, emphasize=True),
            _kv_row("Αναχώρηση", when_label, mono=True),
            _kv_row("Θέσεις", seats, mono=True) if seats else "",
            _kv_row("Κωδικός", pnr, mono=True, emphasize=True) if pnr else "",
            _kv_row("Επιβάτης", passenger) if passenger else "",
        ]
    )
    inner = f"""
    <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#6e6e73;">
      {_esc(body)}
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="border-collapse:collapse;margin:0 0 8px;">
      {rows}
    </table>
    <p style="margin:20px 0 0;font-size:13px;line-height:1.45;color:#86868b;">
      Άνοιξε το My Wallet για τα εισιτήριά σου · {_esc(office_name)}
    </p>
    """
    # _wrap_html(title, body) — title becomes the H1
    return _wrap_html(headline, inner)


def booking_due_for_reminder(
    *,
    departure: datetime | None,
    days_before: int,
    already_sent_for: str | None,
    today: date | None = None,
) -> bool:
    if departure is None:
        return False
    dep_day = departure.astimezone(_ATHENS).date()
    if already_sent_for and str(already_sent_for).strip() == dep_day.isoformat():
        return False
    now = today or datetime.now(_ATHENS).date()
    return dep_day == now + timedelta(days=max(1, int(days_before)))


async def send_trip_reminder_for_booking(
    booking: Any,
    *,
    settings: dict[str, Any] | None = None,
    office_name: str = "PoreiaGo",
) -> dict[str, Any]:
    """Send one reminder and stamp metadata. Idempotent per departure day."""
    from ticketing.email_dispatch import send_email

    meta = dict(getattr(booking, "metadata_json", None) or {})
    departure = _parse_departure(meta)
    cfg = settings or DEFAULT_TRIP_REMINDER
    days = int(cfg.get("days_before") or 3)
    sent_for = str(meta.get("trip_reminder_sent_for") or "").strip() or None
    if not booking_due_for_reminder(
        departure=departure,
        days_before=days,
        already_sent_for=sent_for,
    ):
        return {"skipped": True, "reason": "not_due"}

    to = _valid_email(getattr(booking, "passenger_email", None) or meta.get("wallet_customer_email"))
    if not to:
        return {"skipped": True, "reason": "no_email"}

    trip = str(meta.get("trip_title") or meta.get("tripTitle") or "Εκδρομή").strip()
    seats = str(getattr(booking, "seat_label", None) or "").strip()
    if not seats:
        seat_list = meta.get("seats") or []
        if isinstance(seat_list, (list, tuple)):
            seats = ", ".join(str(s) for s in seat_list if s)
    pnr = str(getattr(booking, "reference_code", None) or "").strip()
    passenger = str(getattr(booking, "passenger_name", None) or "").strip()
    when_label = departure.strftime("%d/%m/%Y · %H:%M") if departure else "—"
    dep_day = departure.astimezone(_ATHENS).date().isoformat()

    subject = _fill(
        str(cfg.get("subject") or DEFAULT_TRIP_REMINDER["subject"]),
        trip=trip,
        days=days,
        office=office_name,
    )
    headline = _fill(
        str(cfg.get("headline") or DEFAULT_TRIP_REMINDER["headline"]),
        trip=trip,
        days=days,
        office=office_name,
    )
    body = _fill(
        str(cfg.get("body") or DEFAULT_TRIP_REMINDER["body"]),
        trip=trip,
        days=days,
        office=office_name,
    )
    html = build_trip_reminder_html(
        headline=headline,
        body=body,
        trip_title=trip,
        when_label=when_label,
        seats=seats,
        pnr=pnr,
        passenger=passenger,
        office_name=office_name,
    )

    tenant_id = str(getattr(booking, "tenant_id", "") or "")
    ref = await send_email(to, subject, html, tenant_id=tenant_id or None)

    meta["trip_reminder_sent_for"] = dep_day
    meta["trip_reminder_sent_at"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    booking.metadata_json = meta

    return {
        "sent": True,
        "to": to,
        "ref": ref,
        "pnr": pnr,
        "departure": dep_day,
        "tenant_id": tenant_id,
    }


async def scan_and_send_trip_reminders(*, now: datetime | None = None) -> dict[str, Any]:
    """Hourly job: for each tenant at its send_hour, email bookings N days out."""
    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking, BookingStatus
    from app.models.tenant import Tenant

    clock = now.astimezone(_ATHENS) if now else datetime.now(_ATHENS)
    hour = clock.hour
    stats: dict[str, Any] = {
        "hour": hour,
        "tenants": 0,
        "candidates": 0,
        "sent": 0,
        "skipped": 0,
        "errors": 0,
    }

    async with AsyncSessionLocal() as session:
        tenants = (await session.execute(select(Tenant))).scalars().all()
        for tenant in tenants:
            tid = str(tenant.id)
            cfg = read_trip_reminder_settings(tid)
            if not cfg.get("enabled"):
                continue
            if int(cfg.get("send_hour") or 9) != hour:
                continue
            stats["tenants"] += 1
            office = str(getattr(tenant, "legal_name", None) or "PoreiaGo").strip() or "PoreiaGo"
            try:
                import json as _json

                raw_settings = getattr(tenant, "settings_json", None)
                parsed = _json.loads(raw_settings) if isinstance(raw_settings, str) else raw_settings
                if isinstance(parsed, dict):
                    brand = str(
                        parsed.get("brand_name")
                        or parsed.get("office_name")
                        or parsed.get("display_name")
                        or ""
                    ).strip()
                    if brand:
                        office = brand
            except Exception:
                pass

            result = await session.execute(
                select(Booking).where(
                    Booking.tenant_id == tenant.id,
                    Booking.status.in_(
                        [
                            BookingStatus.CONFIRMED,
                            BookingStatus.PAID,
                            BookingStatus.BOARDED,
                        ]
                    ),
                )
            )
            rows = result.scalars().all()
            for booking in rows:
                meta = booking.metadata_json if isinstance(booking.metadata_json, dict) else {}
                dep = _parse_departure(meta)
                if not booking_due_for_reminder(
                    departure=dep,
                    days_before=int(cfg.get("days_before") or 3),
                    already_sent_for=str(meta.get("trip_reminder_sent_for") or "") or None,
                    today=clock.date(),
                ):
                    continue
                stats["candidates"] += 1
                try:
                    out = await send_trip_reminder_for_booking(
                        booking,
                        settings=cfg,
                        office_name=office,
                    )
                    if out.get("sent"):
                        stats["sent"] += 1
                        session.add(booking)
                    else:
                        stats["skipped"] += 1
                except Exception:
                    stats["errors"] += 1
                    logger.exception(
                        "Trip reminder failed booking=%s tenant=%s",
                        getattr(booking, "reference_code", None),
                        tid,
                    )
            await session.commit()

    return stats
