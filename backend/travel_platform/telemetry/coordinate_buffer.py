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
