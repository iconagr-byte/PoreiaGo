"""Per-driver GPS ingress rate limiting (sliding 60s window)."""

from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    retry_after_sec: float | None = None


_lock = threading.Lock()
_windows: dict[str, deque[float]] = {}
_WINDOW_SEC = 60.0


def driver_ingress_key(*, session: dict[str, Any], body: dict[str, Any]) -> str:
    tenant_id = str(body.get("tenant_id") or session.get("tenant_id") or "unknown")
    driver_id = str(body.get("driver_id") or session.get("driver_id") or session.get("sub") or "driver")
    trip_id = str(body.get("trip_id") or session.get("trip_id") or "")
    return f"{tenant_id}:{driver_id}:{trip_id}"


def check_driver_gps_rate_limit(
    *,
    tenant_id: str,
    session: dict[str, Any],
    body: dict[str, Any],
    max_per_minute: int,
) -> RateLimitResult:
    """Return whether this GPS point may be ingested."""
    if max_per_minute <= 0:
        return RateLimitResult(allowed=True)

    key = driver_ingress_key(session=session, body=body)
    now = time.monotonic()

    with _lock:
        bucket = _windows.setdefault(key, deque())
        while bucket and now - bucket[0] > _WINDOW_SEC:
            bucket.popleft()
        if len(bucket) >= max_per_minute:
            retry_after = _WINDOW_SEC - (now - bucket[0])
            return RateLimitResult(allowed=False, retry_after_sec=max(0.1, retry_after))
        bucket.append(now)
        if not bucket:
            _windows.pop(key, None)
        return RateLimitResult(allowed=True)


def reset_driver_ingress_rate_limits() -> None:
    """Test helper — clear all counters."""
    with _lock:
        _windows.clear()
