"""
Teltonika-first live map priority with soft phone GPS fallback.

Soft-ack phone GPS only when a Teltonika pin is already on the live fleet
(recent hardware fix). Device-store last_seen alone is not enough — the TCP
path can touch last_seen without a map pin, which would blank the live map.

Multi-worker Redis can leave a phone pin and a Teltonika pin for the same
plate — list/egress must collapse to one pin (hardware wins while fresh).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

TRACKER_LIVE_SOURCES = frozenset(
    {"teltonika", "teltonika_test_ping", "tracker", "test_ping"},
)

# Prefer tracker while a live pin reports within this window (seconds).
DEFAULT_TRACKER_ALIVE_SECONDS = 90


def normalize_vehicle_plate(value: Any) -> str:
    return str(value or "").strip().upper()


def is_tracker_source(source: Any) -> bool:
    raw = str(source or "").strip().lower()
    if not raw:
        return False
    if raw in TRACKER_LIVE_SOURCES:
        return True
    return raw.startswith("teltonika")


def is_phone_source(source: Any) -> bool:
    raw = str(source or "").strip().lower()
    if not raw:
        return False
    if is_tracker_source(raw):
        return False
    return (
        "driver" in raw
        or "pwa" in raw
        or "phone" in raw
        or raw in {"app", "gps", "browser"}
    )


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
    if meta.get("lat") is None or meta.get("lng") is None:
        return False
    age = age_seconds(meta.get("updated_at") or meta.get("timestamp"), now=now)
    if age is None:
        return False
    return age <= max(1, int(max_age_sec))


def resolve_tracker_alive_seconds(tenant_id: str | None = None) -> int:
    try:
        from travel_platform.telemetry.settings_store import get_telemetry_settings

        settings = get_telemetry_settings(tenant_id or None)
        return max(
            15,
            int(
                getattr(settings, "driver_stale_seconds", DEFAULT_TRACKER_ALIVE_SECONDS)
                or DEFAULT_TRACKER_ALIVE_SECONDS
            ),
        )
    except Exception:
        return DEFAULT_TRACKER_ALIVE_SECONDS


def _live_fleet_tracker_meta(tenant_id: str, vehicle_code: str | None) -> dict[str, Any] | None:
    plate = normalize_vehicle_plate(vehicle_code)
    if not plate:
        return None
    try:
        from travel_platform.telemetry.processor import get_live_fleet

        fleet = get_live_fleet()
        tid = str(tenant_id)
        candidates: list[dict[str, Any]] = []
        vid = fleet.find_vehicle_id(tid, plate)
        if vid:
            meta = fleet._vehicles.get(vid)  # noqa: SLF001 — shared live cache
            if isinstance(meta, dict):
                candidates.append(meta)
        # Scan all live rows for this plate — Redis duplicates may use another UUID.
        for meta in fleet._vehicles.values():  # noqa: SLF001
            if str(meta.get("tenant_id") or "") != tid:
                continue
            if meta_plate(meta) != plate:
                continue
            if meta not in candidates:
                candidates.append(meta)
        best: dict[str, Any] | None = None
        for meta in candidates:
            if not is_tracker_source(meta.get("source")) and not (
                meta.get("imei") and not is_phone_source(meta.get("source"))
            ):
                continue
            best = prefer_meta_for_plate(best, meta) or meta
        return best
    except Exception:
        return None


def meta_plate(meta: dict[str, Any] | None) -> str:
    meta = meta or {}
    return normalize_vehicle_plate(meta.get("vehicle_code") or meta.get("bus_plate"))


def _meta_updated_rank(meta: dict[str, Any] | None) -> float:
    age = age_seconds((meta or {}).get("updated_at") or (meta or {}).get("timestamp"))
    if age is None:
        return float("-inf")
    return -age


def prefer_meta_for_plate(
    a: dict[str, Any] | None,
    b: dict[str, Any] | None,
    *,
    max_age_sec: int = DEFAULT_TRACKER_ALIVE_SECONDS,
    now: datetime | None = None,
) -> dict[str, Any] | None:
    """
    Pick the winning live pin for one plate.

    Fresh Teltonika always beats phone/app. When hardware is stale, phone
    fallback wins. Otherwise keep the newer fix.
    """
    if not a:
        return b
    if not b:
        return a
    a_fresh = is_live_meta_tracker_fresh(a, max_age_sec=max_age_sec, now=now)
    b_fresh = is_live_meta_tracker_fresh(b, max_age_sec=max_age_sec, now=now)
    if a_fresh and not b_fresh:
        return a
    if b_fresh and not a_fresh:
        return b
    a_tracker = is_tracker_source(a.get("source")) or bool(
        a.get("imei") and not is_phone_source(a.get("source"))
    )
    b_tracker = is_tracker_source(b.get("source")) or bool(
        b.get("imei") and not is_phone_source(b.get("source"))
    )
    a_phone = is_phone_source(a.get("source")) or (not a_tracker and not a.get("imei"))
    b_phone = is_phone_source(b.get("source")) or (not b_tracker and not b.get("imei"))
    # Soft fallback: stale Teltonika + live phone → phone paints the map.
    if a_tracker and not a_fresh and b_phone:
        return b
    if b_tracker and not b_fresh and a_phone:
        return a
    if a_tracker and not b_tracker:
        return a
    if b_tracker and not a_tracker:
        return b
    return a if _meta_updated_rank(a) >= _meta_updated_rank(b) else b


def dedupe_live_metas_by_plate(
    metas: list[dict[str, Any]],
    *,
    max_age_sec: int = DEFAULT_TRACKER_ALIVE_SECONDS,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    """Collapse duplicate pins for the same plate (Teltonika wins while fresh)."""
    winners: dict[str, dict[str, Any]] = {}
    orphans: list[dict[str, Any]] = []
    for meta in metas or []:
        if not isinstance(meta, dict):
            continue
        plate = meta_plate(meta)
        if not plate:
            orphans.append(meta)
            continue
        prev = winners.get(plate)
        winners[plate] = prefer_meta_for_plate(prev, meta, max_age_sec=max_age_sec, now=now) or meta
    return list(winners.values()) + orphans


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
    Only when a fresh Teltonika pin exists on the live fleet — never based on
    device last_seen alone (that can blank the map when the queue lags).
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
    meta = _live_fleet_tracker_meta(str(tenant_id), vehicle_code)
    if is_live_meta_tracker_fresh(meta, max_age_sec=alive_sec, now=now):
        return True, tracker

    return False, tracker
