"""
Teltonika-first live map priority with soft phone GPS fallback.

When a plate has an enabled Teltonika binding and the tracker was seen recently,
driver phone GPS must not paint the live map. If the tracker goes quiet, phone
GPS may paint as fallback until hardware resumes.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

TRACKER_LIVE_SOURCES = frozenset(
    {"teltonika", "teltonika_test_ping", "tracker", "test_ping"},
)

# Prefer tracker while it reports within this window (seconds).
DEFAULT_TRACKER_ALIVE_SECONDS = 90


def is_tracker_source(source: Any) -> bool:
    raw = str(source or "").strip().lower()
    if not raw:
        return False
    if raw in TRACKER_LIVE_SOURCES:
        return True
    return raw.startswith("teltonika")


def _parse_ts(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def age_seconds(value: Any, *, now: datetime | None = None) -> float | None:
    dt = _parse_ts(value)
    if not dt:
        return None
    now = now or datetime.now(timezone.utc)
    return max(0.0, (now - dt).total_seconds())


def is_tracker_binding_alive(
    tracker: dict[str, Any] | None,
    *,
    max_age_sec: int = DEFAULT_TRACKER_ALIVE_SECONDS,
    now: datetime | None = None,
) -> bool:
    """True when the IMEI binding saw a recent Teltonika packet (last_seen_at)."""
    if not tracker:
        return False
    age = age_seconds(tracker.get("last_seen_at"), now=now)
    if age is None:
        return False
    return age <= max(1, int(max_age_sec))


def is_live_meta_tracker_fresh(
    meta: dict[str, Any] | None,
    *,
    max_age_sec: int = DEFAULT_TRACKER_ALIVE_SECONDS,
    now: datetime | None = None,
) -> bool:
    """True when live-fleet meta is a recent Teltonika fix."""
    if not meta:
        return False
    if not is_tracker_source(meta.get("source")):
        return False
    age = age_seconds(meta.get("updated_at") or meta.get("timestamp"), now=now)
    if age is None:
        return False
    return age <= max(1, int(max_age_sec))


def resolve_tracker_alive_seconds(tenant_id: str | None = None) -> int:
    try:
        from travel_platform.telemetry.settings_store import get_telemetry_settings

        settings = get_telemetry_settings(tenant_id or None)
        return max(15, int(getattr(settings, "driver_stale_seconds", DEFAULT_TRACKER_ALIVE_SECONDS) or DEFAULT_TRACKER_ALIVE_SECONDS))
    except Exception:
        return DEFAULT_TRACKER_ALIVE_SECONDS


def is_teltonika_preferred_for_plate(
    tenant_id: str,
    vehicle_code: str | None,
    *,
    max_age_sec: int | None = None,
    now: datetime | None = None,
) -> tuple[bool, dict[str, Any] | None]:
    """
    Return (prefer_teltonika, binding).

    prefer_teltonika=True → skip phone GPS on the live map (soft-ack only).
    prefer_teltonika=False with a binding → phone may paint as soft fallback.
    prefer_teltonika=False with no binding → normal phone GPS path.
    """
    try:
        from travel_platform.telemetry.teltonika.device_store import (
            get_enabled_device_by_vehicle_code,
        )
    except Exception:
        return False, None

    tracker = get_enabled_device_by_vehicle_code(str(tenant_id), vehicle_code)
    if not tracker:
        return False, None

    alive_sec = int(max_age_sec if max_age_sec is not None else resolve_tracker_alive_seconds(tenant_id))
    if is_tracker_binding_alive(tracker, max_age_sec=alive_sec, now=now):
        return True, tracker

    # Secondary: in-memory live fleet may still hold a fresh Teltonika pin
    # even if last_seen_at write lagged.
    try:
        from travel_platform.telemetry.processor import get_live_fleet

        fleet = get_live_fleet()
        plate = str(vehicle_code or "").strip()
        vid = fleet.find_vehicle_id(str(tenant_id), plate) if plate else None
        meta = fleet._vehicles.get(vid) if vid else None  # noqa: SLF001 — shared live cache
        if is_live_meta_tracker_fresh(meta, max_age_sec=alive_sec, now=now):
            return True, tracker
    except Exception:
        pass

    return False, tracker
