"""Ενεργές συνδέσεις οδηγού — online/offline transitions."""

from __future__ import annotations

import threading

_lock = threading.Lock()
_connections: dict[str, set[int]] = {}


def driver_connection_key(session: dict) -> str:
    tenant_id = str(session.get("tenant_id") or "")
    driver_id = str(session.get("sub") or session.get("driver_id") or "driver")
    trip_id = str(session.get("trip_id") or "")
    return f"{tenant_id}:{driver_id}:{trip_id}"


def on_driver_connected(session: dict, connection_id: int) -> bool:
    """True όταν ο οδηγός γίνεται online (πρώτη ενεργή σύνδεση)."""
    key = driver_connection_key(session)
    with _lock:
        bucket = _connections.setdefault(key, set())
        was_offline = len(bucket) == 0
        bucket.add(connection_id)
        return was_offline


def on_driver_disconnected(session: dict, connection_id: int) -> bool:
    """True όταν ο οδηγός γίνεται offline (τελευταία σύνδεση έκλεισε)."""
    key = driver_connection_key(session)
    with _lock:
        bucket = _connections.get(key)
        if not bucket:
            return False
        bucket.discard(connection_id)
        if bucket:
            return False
        _connections.pop(key, None)
        return True


def force_driver_offline(session: dict) -> bool:
    """Clear all tracked connections for this driver/trip. True if they were online."""
    key = driver_connection_key(session)
    with _lock:
        bucket = _connections.pop(key, None)
        return bool(bucket)


def active_connection_count() -> int:
    with _lock:
        return sum(len(bucket) for bucket in _connections.values())
