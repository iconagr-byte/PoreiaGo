"""Tests for trip ops store + schedule builder."""

from __future__ import annotations

from pathlib import Path

from travel_platform.operations.trip_ops_store import (
    build_schedule_from_ops,
    get_trip_ops,
    upsert_trip_ops,
)


def test_upsert_and_build_schedule_from_stops(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("POREIAGO_DATA_DIR", str(tmp_path))
    upsert_trip_ops(
        1784912369080,
        {
            "title": "Εκδρομή 7-9",
            "destination": "Μετέωρα",
            "meeting_point": "Σύνταγμα",
            "departure_time": "2026-07-25T08:00:00",
            "arrival_time": "2026-07-25T13:00:00",
            "stops": [
                {"name": "Αθήνα — Σύνταγμα", "time": "08:00"},
                {"name": "Μετέωρα", "time": "13:00"},
            ],
            "total_seats": 49,
        },
    )
    ops = get_trip_ops(1784912369080)
    assert ops["destination"] == "Μετέωρα"
    assert ops["title"] == "Εκδρομή 7-9"
    schedule = build_schedule_from_ops(1784912369080)
    assert len(schedule) == 2
    assert schedule[0]["stop"] == "Αθήνα — Σύνταγμα"
    assert schedule[0]["status"] == "current"
    assert schedule[1]["stop"] == "Μετέωρα"


def test_schedule_from_meeting_and_destination(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("POREIAGO_DATA_DIR", str(tmp_path))
    upsert_trip_ops(
        42,
        {
            "title": "Day Trip",
            "destination": "Δελφοί",
            "meeting_point": "Ομόνοια",
            "departure_time": "2026-08-01T07:30:00+03:00",
            "arrival_time": "2026-08-01T11:00:00+03:00",
        },
    )
    schedule = build_schedule_from_ops(42)
    assert len(schedule) == 2
    assert "Ομόνοια" in schedule[0]["stop"]
    assert "Δελφοί" in schedule[1]["stop"]
    assert schedule[0]["time"] == "07:30"


def test_no_fake_athens_meteora_when_empty(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("POREIAGO_DATA_DIR", str(tmp_path))
    assert build_schedule_from_ops(999) == []
