"""Τελευταίο GPS heartbeat ανά οδηγό — stale offline detection."""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any

from travel_platform.telemetry.driver_shift_tracker import driver_connection_key

_lock = threading.Lock()
_heartbeats: dict[str, dict[str, Any]] = {}


def _parse_ts(value: datetime | str | None) -> datetime:
    if isinstance(value, datetime):
        ts = value
    elif isinstance(value, str) and value:
        ts = datetime.fromisoformat(value.replace("Z", "+00:00"))
    else:
        ts = datetime.now(timezone.utc)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts


def touch_driver_gps(
    session: dict[str, Any],
    *,
    vehicle_id: str | None = None,
    recorded_at: datetime | str | None = None,
) -> bool:
    """
    Ενημέρωση heartbeat. Επιστρέφει True αν ο οδηγός ήταν stale και επανήλθε.
    """
    key = driver_connection_key(session)
    ts = _parse_ts(recorded_at)
    with _lock:
        prev = _heartbeats.get(key, {})
        was_stale = bool(prev.get("stale_notified"))
        _heartbeats[key] = {
            "session": dict(session),
            "last_at": ts,
            "vehicle_id": vehicle_id or prev.get("vehicle_id"),
            "stale_notified": False,
        }
        return was_stale


def collect_stale_sessions(*, stale_seconds: int) -> list[dict[str, Any]]:
    """Οδηγοί χωρίς GPS > stale_seconds — μία φορά ανά stale περίοδο."""
    now = datetime.now(timezone.utc)
    stale: list[dict[str, Any]] = []
    with _lock:
        for row in _heartbeats.values():
            last_at = row.get("last_at")
            if not isinstance(last_at, datetime):
                continue
            age = (now - last_at).total_seconds()
            if age <= stale_seconds:
                continue
            if row.get("stale_notified"):
                continue
            row["stale_notified"] = True
            stale.append(dict(row.get("session") or {}))
    return stale


def clear_driver_gps(session: dict[str, Any]) -> None:
    key = driver_connection_key(session)
    with _lock:
        _heartbeats.pop(key, None)
