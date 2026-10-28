"""IMEI → office/vehicle bindings for Teltonika TCP ingest."""

from __future__ import annotations

import json
import os
import threading
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

_LOCK = threading.RLock()


def _data_dir() -> Path:
    raw = (os.getenv("POREIAGO_DATA_DIR") or "").strip()
    if raw:
        return Path(raw)
    return Path(__file__).resolve().parents[3] / "data"


def _store_path() -> Path:
    override = (os.getenv("TELTONIKA_DEVICES_STORE") or "").strip()
    if override:
        return Path(override)
    return _data_dir() / "teltonika_devices.json"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _empty() -> dict[str, Any]:
    return {"version": 1, "devices": []}


def _read() -> dict[str, Any]:
    path = _store_path()
    if not path.is_file():
        return _empty()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("devices"), list):
            return data
    except Exception:
        pass
    return _empty()


def _write(data: dict[str, Any]) -> None:
    path = _store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def normalize_imei(value: str | None) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    return digits


def list_devices(tenant_id: str | None = None) -> list[dict[str, Any]]:
    with _LOCK:
        rows = list(_read().get("devices") or [])
    if tenant_id:
        tid = str(tenant_id)
        rows = [r for r in rows if str(r.get("tenant_id") or "") == tid]
    return deepcopy(rows)


def get_device_by_imei(imei: str) -> dict[str, Any] | None:
    key = normalize_imei(imei)
    if not key:
        return None
    with _LOCK:
        for row in _read().get("devices") or []:
            if normalize_imei(row.get("imei")) == key:
                return deepcopy(row)
    return None


def get_enabled_device_by_vehicle_code(
    tenant_id: str,
    vehicle_code: str | None,
) -> dict[str, Any] | None:
    """Return the enabled Teltonika binding for this office plate, if any."""
    from travel_platform.telemetry.tracker_priority import normalize_vehicle_plate

    plate = normalize_vehicle_plate(vehicle_code)
    if not plate or not tenant_id:
        return None
    tid = str(tenant_id)
    with _LOCK:
        for row in _read().get("devices") or []:
            if not row.get("enabled"):
                continue
            if str(row.get("tenant_id") or "") != tid:
                continue
            if normalize_vehicle_plate(row.get("vehicle_code")) == plate:
                return deepcopy(row)
    return None


def upsert_device(body: dict[str, Any], *, tenant_id: str) -> dict[str, Any]:
    imei = normalize_imei(body.get("imei"))
    if len(imei) < 14 or len(imei) > 16:
        raise ValueError("Το IMEI πρέπει να έχει 14–16 ψηφία")
    vehicle_code = str(body.get("vehicle_code") or "").strip()
    if not vehicle_code:
        raise ValueError("Απαιτείται κωδικός / πινακίδα οχήματος (vehicle_code)")
    label = str(body.get("label") or "").strip() or f"Teltonika {imei[-6:]}"
    driver_id = str(body.get("driver_id") or "").strip() or None
    enabled = bool(body.get("enabled", True))
    device_id = str(body.get("id") or "").strip() or None

    with _LOCK:
        data = _read()
        devices = list(data.get("devices") or [])
        existing = None
        for row in devices:
            if device_id and str(row.get("id")) == device_id:
                existing = row
                break
            if normalize_imei(row.get("imei")) == imei:
                existing = row
                break
        if existing and str(existing.get("tenant_id")) != str(tenant_id):
            raise ValueError("Αυτό το IMEI ανήκει ήδη σε άλλο γραφείο")

        # Unique IMEI globally
        for row in devices:
            if row is existing:
                continue
            if normalize_imei(row.get("imei")) == imei:
                raise ValueError("Το IMEI υπάρχει ήδη")

        if existing:
            existing["imei"] = imei
            existing["vehicle_code"] = vehicle_code
            existing["label"] = label
            existing["driver_id"] = driver_id
            existing["enabled"] = enabled
            existing["updated_at"] = _now()
            row_out = existing
        else:
            row_out = {
                "id": str(uuid4()),
                "imei": imei,
                "tenant_id": str(tenant_id),
                "vehicle_code": vehicle_code,
                "driver_id": driver_id,
                "label": label,
                "enabled": enabled,
                "created_at": _now(),
                "updated_at": _now(),
                "last_seen_at": None,
                "last_lat": None,
                "last_lng": None,
                "last_speed_kmh": None,
                "points_accepted": 0,
            }
            devices.append(row_out)
        data["devices"] = devices
        _write(data)
        return deepcopy(row_out)


# Known production trackers that must not vanish from Achillio Travel admin.
# (IMEI was bound before; empty dropdown after redeploy / wrong-tenant bind.)
ACHILLIO_DEFAULT_TRACKERS: tuple[dict[str, str], ...] = (
    {
        "imei": "861076085468260",
        "vehicle_code": "EEX5670",
        "label": "Λεωφορείο με GPS",
    },
)


def rebind_device_to_tenant(
    imei: str,
    tenant_id: str,
    *,
    vehicle_code: str | None = None,
    label: str | None = None,
    enabled: bool = True,
) -> dict[str, Any] | None:
    """Move an existing IMEI binding to ``tenant_id`` (fix platform mis-bind)."""
    key = normalize_imei(imei)
    tid = str(tenant_id or "").strip()
    if not key or not tid:
        return None
    with _LOCK:
        data = _read()
        for row in data.get("devices") or []:
            if normalize_imei(row.get("imei")) != key:
                continue
            row["tenant_id"] = tid
            if vehicle_code:
                row["vehicle_code"] = str(vehicle_code).strip()
            if label is not None and str(label).strip():
                row["label"] = str(label).strip()
            row["enabled"] = bool(enabled)
            row["updated_at"] = _now()
            _write(data)
            return deepcopy(row)
    return None


def ensure_office_default_trackers(
    tenant_id: str,
    *,
    trackers: tuple[dict[str, str], ...] | list[dict[str, str]] | None = None,
) -> list[dict[str, Any]]:
    """If this office has no devices, restore known IMEI bindings (rebind or create).

    Does nothing when the office already has ≥1 device — never clobber a custom fleet.
    """
    tid = str(tenant_id or "").strip()
    if not tid:
        return []
    existing = list_devices(tid)
    if existing:
        return existing

    restored: list[dict[str, Any]] = []
    for spec in trackers or ACHILLIO_DEFAULT_TRACKERS:
        imei = normalize_imei(spec.get("imei"))
        plate = str(spec.get("vehicle_code") or "").strip()
        label = str(spec.get("label") or "").strip() or f"Teltonika {imei[-6:]}"
        if not imei or not plate:
            continue
        found = get_device_by_imei(imei)
        if found:
            if str(found.get("tenant_id") or "") == tid:
                restored.append(found)
                continue
            moved = rebind_device_to_tenant(
                imei,
                tid,
                vehicle_code=plate,
                label=label or found.get("label"),
                enabled=True,
            )
            if moved:
                restored.append(moved)
            continue
        try:
            restored.append(
                upsert_device(
                    {
                        "imei": imei,
                        "vehicle_code": plate,
                        "label": label,
                        "enabled": True,
                    },
                    tenant_id=tid,
                )
            )
        except ValueError:
            continue
    return restored or list_devices(tid)


def delete_device(device_id: str, *, tenant_id: str) -> bool:
    did = str(device_id or "").strip()
    tid = str(tenant_id)
    with _LOCK:
        data = _read()
        before = list(data.get("devices") or [])
        after = [
            r
            for r in before
            if not (str(r.get("id")) == did and str(r.get("tenant_id")) == tid)
        ]
        if len(after) == len(before):
            return False
        data["devices"] = after
        _write(data)
        return True


def touch_device(
    imei: str,
    *,
    lat: float | None = None,
    lng: float | None = None,
    speed_kmh: float | None = None,
    points: int = 0,
    from_hardware: bool = False,
) -> None:
    """Update last-seen / last fix.

    ``from_hardware=True`` (Codec TCP) also stamps ``last_hw_lat/lng`` so admin
    «Δοκιμαστικό pin» can prefer the tracker, not a browser «Η θέση μου» ping.
    """
    key = normalize_imei(imei)
    with _LOCK:
        data = _read()
        changed = False
        for row in data.get("devices") or []:
            if normalize_imei(row.get("imei")) != key:
                continue
            now = _now()
            row["last_seen_at"] = now
            # Browser «Η θέση μου» must never write lat/lng into the device store —
            # that polluted Δοκιμαστικό pin with the PC location.
            if from_hardware and lat is not None:
                row["last_lat"] = lat
                row["last_hw_lat"] = lat
                row["last_hw_at"] = now
                row["last_fix_source"] = "teltonika"
                if not row.get("first_fix_at"):
                    row["first_fix_at"] = now
                    row["tracking_started_at"] = now
            if from_hardware and lng is not None:
                row["last_lng"] = lng
                row["last_hw_lng"] = lng
            if from_hardware and speed_kmh is not None:
                row["last_speed_kmh"] = speed_kmh
            if points:
                row["points_accepted"] = int(row.get("points_accepted") or 0) + int(points)
            changed = True
            break
        if changed:
            _write(data)


def hardware_last_fix(device: dict | None) -> tuple[float, float] | None:
    """Return last Codec/hardware lat/lng only — never browser/manual last_lat."""
    if not isinstance(device, dict):
        return None
    hw_lat = device.get("last_hw_lat")
    hw_lng = device.get("last_hw_lng")
    if hw_lat is not None and hw_lng is not None:
        try:
            return float(hw_lat), float(hw_lng)
        except (TypeError, ValueError):
            return None
    # Accept last_lat only when we know it came from Codec (never when source missing —
    # missing used to mean «polluted by Η θέση μου»).
    src = str(device.get("last_fix_source") or "").strip().lower()
    if src not in ("teltonika", "tracker", "hardware"):
        return None
    lat = device.get("last_lat")
    lng = device.get("last_lng")
    if lat is None or lng is None:
        return None
    try:
        return float(lat), float(lng)
    except (TypeError, ValueError):
        return None


def live_teltonika_fix(
    tenant_id: str,
    *,
    imei: str | None = None,
    vehicle_code: str | None = None,
) -> tuple[float, float] | None:
    """Read the current live-fleet pin when it is Teltonika/Codec-sourced."""
    tid = str(tenant_id or "").strip()
    if not tid:
        return None
    try:
        from travel_platform.telemetry.processor import get_live_fleet
        from travel_platform.telemetry.tracker_priority import normalize_vehicle_plate
    except Exception:
        return None

    want_imei = normalize_imei(imei)
    want_plate = normalize_vehicle_plate(vehicle_code)
    fleet = get_live_fleet()
    metas = list((getattr(fleet, "_vehicles", None) or {}).values())

    def _is_tracker_meta(meta: dict) -> bool:
        src = str(meta.get("source") or "").strip().lower()
        if src.startswith("teltonika") or src in {"tracker", "hardware"}:
            return True
        # Dual-badge / soft-ack: imei present and not a pure phone source.
        if meta.get("imei") and src and ("driver" in src or "pwa" in src or src == "app"):
            sources = meta.get("gps_sources") or []
            return "teltonika" in [str(s).lower() for s in sources]
        return bool(meta.get("imei") and not src)

    for meta in metas:
        if not isinstance(meta, dict):
            continue
        if str(meta.get("tenant_id") or "") != tid:
            continue
        if not _is_tracker_meta(meta):
            continue
        meta_imei = normalize_imei(meta.get("imei"))
        meta_plate = normalize_vehicle_plate(
            meta.get("vehicle_code") or meta.get("bus_plate")
        )
        matched = False
        if want_imei and meta_imei and meta_imei == want_imei:
            matched = True
        elif want_plate and meta_plate and meta_plate == want_plate and (
            meta_imei or str(meta.get("source") or "").lower().startswith("teltonika")
        ):
            matched = True
        if not matched:
            continue
        try:
            lat = float(meta.get("lat"))
            lng = float(meta.get("lng"))
        except (TypeError, ValueError):
            continue
        if abs(lat) < 0.01 and abs(lng) < 0.01:
            continue
        return lat, lng
    return None


def resolve_hardware_fix(
    device: dict | None,
    *,
    tenant_id: str | None = None,
) -> tuple[float, float, str] | None:
    """Prefer durable Codec last_hw, then live Teltonika fleet pin.

    Returns ``(lat, lng, origin)`` where origin is ``last_hw`` or ``live_fleet``.
    """
    if not isinstance(device, dict):
        return None
    hw = hardware_last_fix(device)
    if hw:
        return hw[0], hw[1], "last_hw"
    tid = str(tenant_id or device.get("tenant_id") or "").strip()
    live = live_teltonika_fix(
        tid,
        imei=str(device.get("imei") or ""),
        vehicle_code=str(device.get("vehicle_code") or ""),
    )
    if live:
        return live[0], live[1], "live_fleet"
    return None
