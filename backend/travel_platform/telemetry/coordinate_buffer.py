"""In-memory buffer for trip_coordinates — flushed periodically to PostGIS."""

from __future__ import annotations

import threading
from collections import deque
from dataclasses import dataclass
from datetime import datetime
from typing import Any

_MAX_POINTS = 50_000


@dataclass
class BufferedCoordinate:
    tenant_id: str
    trip_id: int | None
    driver_id: str | None
    vehicle_id: str | None
    lat: float
    lng: float
    speed_kmh: float
    heading_deg: float | None
    recorded_at: datetime
    raw: dict[str, Any]


_lock = threading.Lock()
_buffer: deque[BufferedCoordinate] = deque(maxlen=_MAX_POINTS)


def push_coordinate(row: BufferedCoordinate) -> None:
    with _lock:
        _buffer.append(row)


def drain_batch(limit: int = 500) -> list[BufferedCoordinate]:
    batch: list[BufferedCoordinate] = []
    with _lock:
        while _buffer and len(batch) < limit:
            batch.append(_buffer.popleft())
    return batch


def pending_count() -> int:
    with _lock:
        return len(_buffer)


def peek_matching(
    *,
    tenant_id: str,
    trip_id: int | None = None,
    driver_id: str | None = None,
    from_time: datetime | None = None,
    to_time: datetime | None = None,
    limit: int = 5000,
) -> list[BufferedCoordinate]:
    """Return pending (not yet flushed) GPS points for playback — does not drain."""
    tid = str(tenant_id or "").strip()
    did = str(driver_id or "").strip() or None
    matched: list[BufferedCoordinate] = []
    with _lock:
        for row in _buffer:
            if str(row.tenant_id) != tid:
                continue
            if trip_id is not None and row.trip_id != trip_id:
                continue
            if did and str(row.driver_id or "") != did:
                # Also accept raw payload driver_id (master-qr / legacy keys).
                raw_did = str((row.raw or {}).get("driver_id") or "")
                if raw_did != did:
                    continue
            try:
                if from_time is not None and row.recorded_at < from_time:
                    continue
                if to_time is not None and row.recorded_at > to_time:
                    continue
            except TypeError:
                # Aware/naive mismatch — keep the point rather than drop live GPS.
                pass
            matched.append(row)
            if len(matched) >= limit:
                break
    return matched


def clear_buffer_for_tests() -> None:
    with _lock:
        _buffer.clear()
