"""Unit tests for pre-departure trip reminder helpers."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from ticketing.trip_reminder_email import (
    booking_due_for_reminder,
    build_trip_reminder_html,
)
from travel_platform.settings.trip_reminder_store import (
    DEFAULT_TRIP_REMINDER,
    _normalize,
)

ATHENS = ZoneInfo("Europe/Athens")


def test_due_three_days_before():
    dep = datetime(2026, 11, 5, 8, 0, tzinfo=ATHENS)
    assert booking_due_for_reminder(
        departure=dep,
        days_before=3,
        already_sent_for=None,
        today=date(2026, 11, 2),
    )
    assert not booking_due_for_reminder(
        departure=dep,
        days_before=3,
        already_sent_for=None,
        today=date(2026, 11, 1),
    )


def test_idempotent_same_departure_day():
    dep = datetime(2026, 11, 5, 8, 0, tzinfo=ATHENS)
    assert not booking_due_for_reminder(
        departure=dep,
        days_before=3,
        already_sent_for="2026-11-05",
        today=date(2026, 11, 2),
    )


def test_normalize_clamps_days_and_hour():
    cfg = _normalize({"days_before": 99, "send_hour": 30, "enabled": False})
    assert cfg["days_before"] == 30
    assert cfg["send_hour"] == 23
    assert cfg["enabled"] is False
    assert cfg["subject"] == DEFAULT_TRIP_REMINDER["subject"]


def test_html_minimal_apple():
    html = build_trip_reminder_html(
        headline="Σε 3 μέρες φεύγεις",
        body="Υπενθύμιση για την επερχόμενη εκδρομή σου.",
        trip_title="Ημερήσια στα Μετέωρα",
        when_label="02/11/2026 · 08:00",
        seats="1A, 1B",
        pnr="BK-F15C6C28",
        passenger="Axilleas Charalambidis",
        office_name="Achillio",
    )
    assert "Σε 3 μέρες φεύγεις" in html
    assert "Μετέωρα" in html
    assert "BK-F15C6C28" in html
    assert "#f5f5f7" in html
