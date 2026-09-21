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
) -> None:
    key = normalize_imei(imei)
    with _LOCK:
        data = _read()
        changed = False
        for row in data.get("devices") or []:
            if normalize_imei(row.get("imei")) != key:
                continue
            row["last_seen_at"] = _now()
            if lat is not None:
                row["last_lat"] = lat
            if lng is not None:
                row["last_lng"] = lng
            if speed_kmh is not None:
                row["last_speed_kmh"] = speed_kmh
            if points:
                row["points_accepted"] = int(row.get("points_accepted") or 0) + int(points)
            changed = True
            break
        if changed:
            _write(data)
