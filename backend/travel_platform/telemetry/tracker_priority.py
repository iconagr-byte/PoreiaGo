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
# Badge / «GPS οχήματος» online window — keep aligned with alive.
# Was 900s and kept buses looking active ~15 min after GPS power cut.
# Open Codec TCP still counts as online via is_tracker_binding_alive().
DEVICE_ONLINE_BADGE_SECONDS = 90


# Greek lookalikes → Latin so App/Teltonika plates collapse to one key.
_GREEK_PLATE_FOLD = str.maketrans(
    {
        "Α": "A",
        "Β": "B",
        "Ε": "E",
        "Ζ": "Z",
        "Η": "H",
        "Ι": "I",
        "Κ": "K",
        "Μ": "M",
        "Ν": "N",
        "Ο": "O",
        "Ρ": "P",
        "Τ": "T",
        "Υ": "Y",
        "Χ": "X",
    }
)


def plate_display(value: Any) -> str:
    """Human-facing plate label — keep hyphens, drop only outer whitespace."""
    return str(value or "").strip().upper()


def normalize_vehicle_plate(value: Any) -> str:
    """Stable match key: uppercase, strip separators, fold Greek lookalikes."""
    raw = plate_display(value).translate(_GREEK_PLATE_FOLD)
    return "".join(ch for ch in raw if ch.isalnum())


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


def resolve_live_gps_sources(
    meta: dict[str, Any] | None,
    *,
    max_age_sec: int = DEFAULT_TRACKER_ALIVE_SECONDS,
    now: datetime | None = None,
    tenant_id: str | None = None,
    check_device_store: bool = True,
) -> list[str]:
    """
    Active GPS channels for one live pin (dual badge on the map).

    Stable order: ``teltonika`` then ``app`` — only channels with a fresh signal.
    When the IMEI binding has a fresh ``last_seen_at``, Teltonika is listed even
    if the pin row is temporarily App-sourced (multi-worker race).
    """
    meta = meta or {}
    now = now or datetime.now(timezone.utc)
    alive = max(1, int(max_age_sec))
    out: list[str] = []

    pin_age = age_seconds(meta.get("updated_at") or meta.get("timestamp"), now=now)
    if is_live_meta_tracker_fresh(meta, max_age_sec=alive, now=now):
        out.append("teltonika")
    # Do not treat hydrate-bumped updated_at as an open Teltonika channel.

    app_age = age_seconds(meta.get("app_seen_at"), now=now)
    if app_age is not None and app_age <= alive:
        out.append("app")
    elif is_phone_source(meta.get("source")) and pin_age is not None and pin_age <= alive:
        out.append("app")

    # Device online (fresh last_seen or open Codec TCP) → advertise Teltonika.
    # Keep window = alive so unplugged GPS stops looking "active" within ~90s.
    if check_device_store and "teltonika" not in out:
        tid = str(tenant_id or meta.get("tenant_id") or "").strip()
        plate = meta_plate(meta)
        if tid and plate:
            try:
                from travel_platform.telemetry.teltonika.device_store import (
                    get_enabled_device_by_vehicle_code,
                )

                device = get_enabled_device_by_vehicle_code(tid, plate)
                badge_alive = max(alive, DEVICE_ONLINE_BADGE_SECONDS)
                if is_tracker_binding_alive(device, max_age_sec=badge_alive, now=now):
                    out = ["teltonika", *[s for s in out if s != "teltonika"]]
            except Exception:
                pass

    return out


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
    """True when the IMEI binding is online (fresh last_seen or open Codec TCP)."""
    if not tracker:
        return False
    age = age_seconds(tracker.get("last_seen_at"), now=now)
    if age is not None and age <= max(1, int(max_age_sec)):
        return True
    # Open Codec TCP on this worker counts as online (reconnect before AVL).
    # Keepalive refreshes last_seen only while the socket is open; dead peers
    # after power-cut are closed via SO_KEEPALIVE (~90s), then hydrate drops.
    try:
        from travel_platform.telemetry.teltonika.tcp_server import is_imei_tcp_connected

        if is_imei_tcp_connected(tracker.get("imei")):
            return True
    except Exception:
        pass
    return False


def is_live_meta_tracker_fresh(
    meta: dict[str, Any] | None,
    *,
    max_age_sec: int = DEFAULT_TRACKER_ALIVE_SECONDS,
    now: datetime | None = None,
) -> bool:
    """
    True when live-fleet meta carries a *real* recent Teltonika signal.

    Prefer ``tracker_signal_at`` (last hardware packet). Do not treat hydrate
    refreshes of ``updated_at`` as a live tracker — that made closed devices
    look open forever next to the driver App.
    """
    if not meta:
        return False
    if not is_tracker_source(meta.get("source")):
        return False
    if meta.get("lat") is None or meta.get("lng") is None:
        return False
    # Hydrated parked pins keep updated_at fresh for map TTL but are not "open".
    if meta.get("hydrated_from_store") and not meta.get("tracker_signal_at"):
        return False
    signal = (
        meta.get("tracker_signal_at")
        or meta.get("last_seen_at")
        or meta.get("updated_at")
        or meta.get("timestamp")
    )
    # If the pin was hydrated, ignore the synthetic updated_at bump.
    if meta.get("hydrated_from_store"):
        signal = meta.get("tracker_signal_at") or meta.get("last_seen_at")
    age = age_seconds(signal, now=now)
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


def _pick_best_tracker_meta(
    candidates: list[dict[str, Any]],
    *,
    max_age_sec: int = DEFAULT_TRACKER_ALIVE_SECONDS,
    now: datetime | None = None,
) -> dict[str, Any] | None:
    best: dict[str, Any] | None = None
    for meta in candidates:
        if not isinstance(meta, dict):
            continue
        if not is_tracker_source(meta.get("source")) and not (
            meta.get("imei") and not is_phone_source(meta.get("source"))
        ):
            continue
        best = prefer_meta_for_plate(best, meta, max_age_sec=max_age_sec, now=now) or meta
    return best


def _live_fleet_tracker_meta(tenant_id: str, vehicle_code: str | None) -> dict[str, Any] | None:
    """In-memory only — may miss Teltonika on another Gunicorn worker."""
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
        return _pick_best_tracker_meta(candidates)
    except Exception:
        return None


async def live_fleet_tracker_meta_async(
    tenant_id: str,
    vehicle_code: str | None,
    *,
    max_age_sec: int = DEFAULT_TRACKER_ALIVE_SECONDS,
    now: datetime | None = None,
) -> dict[str, Any] | None:
    """
    Fresh Teltonika meta for a plate — memory first, then Redis.

    Soft-ack on the phone-ingest worker must see the tracker pin written by
    the Teltonika TCP worker; memory alone is not enough with multi-worker.
    """
    plate = normalize_vehicle_plate(vehicle_code)
    if not plate:
        return None
    tid = str(tenant_id)
    local = _live_fleet_tracker_meta(tid, plate)
    if is_live_meta_tracker_fresh(local, max_age_sec=max_age_sec, now=now):
        return local

    candidates: list[dict[str, Any]] = []
    if isinstance(local, dict):
        candidates.append(local)
    try:
        from travel_platform.telemetry.live_fleet_redis import load_live_vehicles
        from travel_platform.telemetry.processor import get_live_fleet

        remote = await load_live_vehicles(tid)
        fleet = get_live_fleet()
        for meta in remote or []:
            if meta_plate(meta) != plate:
                continue
            candidates.append(meta)
            vid = str(meta.get("vehicle_id") or "")
            if vid:
                # Hydrate local cache so purge / heartbeat find the hardware UUID.
                fleet._vehicles[vid] = {**fleet._vehicles.get(vid, {}), **meta}  # noqa: SLF001
                fleet._code_index[f"{tid}:{plate}"] = vid  # noqa: SLF001
    except Exception:
        pass
    return _pick_best_tracker_meta(candidates, max_age_sec=max_age_sec, now=now)


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
    True when a fresh Teltonika live pin exists *or* the IMEI binding is alive
    (last_seen / open TCP). Ingress paints the hardware pin before soft-ack
    so the map is never blanked when only last_seen is fresh.

    Sync path uses in-memory fleet only. Prefer
    ``is_teltonika_preferred_for_plate_async`` on ingress (Redis-aware).
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
    # Fresh IMEI last_seen / open TCP — soft-ack App so dual badge stays up
    # even before the live-fleet meta row is refreshed on this worker.
    if is_tracker_binding_alive(tracker, max_age_sec=alive_sec, now=now):
        return True, tracker

    return False, tracker


async def is_teltonika_preferred_for_plate_async(
    tenant_id: str,
    vehicle_code: str | None,
    *,
    max_age_sec: int | None = None,
    now: datetime | None = None,
) -> tuple[bool, dict[str, Any] | None]:
    """Redis-aware Teltonika prefer — used by driver GPS soft-ack."""
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
    meta = await live_fleet_tracker_meta_async(
        str(tenant_id),
        vehicle_code,
        max_age_sec=alive_sec,
        now=now,
    )
    if is_live_meta_tracker_fresh(meta, max_age_sec=alive_sec, now=now):
        return True, tracker
    if is_tracker_binding_alive(tracker, max_age_sec=alive_sec, now=now):
        return True, tracker

    return False, tracker


def merge_app_signal_into_meta(
    winner: dict[str, Any],
    other: dict[str, Any] | None,
    *,
    max_age_sec: int = DEFAULT_TRACKER_ALIVE_SECONDS,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Copy App heartbeat / dual sources onto the winning Teltonika pin."""
    out = dict(winner or {})
    other = other or {}
    app_seen = out.get("app_seen_at") or other.get("app_seen_at")
    if is_phone_source(other.get("source")):
        app_seen = other.get("updated_at") or other.get("timestamp") or app_seen
    if app_seen:
        out["app_seen_at"] = app_seen
    if other.get("driver_name") and (
        not out.get("driver_name") or out.get("driver_name") in {"—", "-", "Tracker"}
    ):
        out["driver_name"] = other.get("driver_name")
    if other.get("driver_id") and not out.get("driver_id"):
        out["app_driver_id"] = other.get("driver_id")
    sources = resolve_live_gps_sources(out, max_age_sec=max_age_sec, now=now)
    for extra in other.get("gps_sources") or []:
        kind = str(extra or "").strip().lower()
        if kind in {"app", "driver_pwa", "phone"} and "app" not in sources:
            sources = [*sources, "app"]
        if (kind.startswith("teltonika") or kind == "tracker") and "teltonika" not in sources:
            sources = ["teltonika", *sources]
    if is_phone_source(other.get("source")) and "app" not in sources:
        sources = [*sources, "app"]
    out["gps_sources"] = ["teltonika", "app"] if (
        "teltonika" in sources and "app" in sources
    ) else sources
    return out
