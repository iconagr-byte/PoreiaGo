"""Resolve excursion/trip titles for live fleet labels."""

from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

_CACHE: dict[int, tuple[float, str]] = {}
_CACHE_TTL_SEC = 120.0


def format_trip_fallback(trip_id: int | None) -> str:
    if trip_id is None:
        return ""
    try:
        tid = int(trip_id)
    except (TypeError, ValueError):
        return ""
    return f"Εκδρομή #{tid}" if tid > 0 else ""


def _cache_get(trip_id: int) -> str | None:
    row = _CACHE.get(trip_id)
    if not row:
        return None
    ts, title = row
    if time.monotonic() - ts > _CACHE_TTL_SEC:
        _CACHE.pop(trip_id, None)
        return None
    return title


def _cache_set(trip_id: int, title: str) -> str:
    clean = str(title or "").strip()
    if not clean:
        clean = format_trip_fallback(trip_id)
    _CACHE[trip_id] = (time.monotonic(), clean)
    return clean


async def resolve_trip_title(trip_id: Any, *, preferred: str | None = None) -> str:
    """Return a human trip/excursion title for map labels."""
    preferred_clean = str(preferred or "").strip()
    try:
        tid = int(trip_id)
    except (TypeError, ValueError):
        return preferred_clean

    if tid <= 0:
        return preferred_clean

    if preferred_clean and not preferred_clean.startswith("Εκδρομή #") and preferred_clean.lower() != f"trip #{tid}":
        return _cache_set(tid, preferred_clean)

    cached = _cache_get(tid)
    if cached:
        return cached

    try:
        from sqlalchemy import text

        from database import AsyncSessionLocal

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text("SELECT title FROM trips WHERE id = :id LIMIT 1"),
                {"id": tid},
            )
            row = result.first()
            if row and row[0]:
                return _cache_set(tid, str(row[0]))
    except Exception:
        logger.debug("trip title lookup failed for %s", tid, exc_info=True)

    return _cache_set(tid, preferred_clean or format_trip_fallback(tid))


def resolve_trip_title_sync(trip_id: Any, *, preferred: str | None = None) -> str:
    """Sync helper for non-async paths — prefers payload/cache, else fallback."""
    preferred_clean = str(preferred or "").strip()
    try:
        tid = int(trip_id)
    except (TypeError, ValueError):
        return preferred_clean
    if tid <= 0:
        return preferred_clean
    if preferred_clean:
        return _cache_set(tid, preferred_clean)
    cached = _cache_get(tid)
    if cached:
        return cached
    return format_trip_fallback(tid)
