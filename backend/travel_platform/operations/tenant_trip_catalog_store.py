"""Per-tenant public trip catalog — durable under POREIAGO_DATA_DIR.

Keeps office storefronts isolated: Achillio trips must never appear on PoreiaGo
(or any other office) when resolving by Host → tenant_id.
"""

from __future__ import annotations

import json
import logging
import os
import re
import threading
from copy import deepcopy
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_LOCK = threading.Lock()
_SAFE_TENANT = re.compile(r"[^a-zA-Z0-9_-]+")


def _data_dir() -> Path:
    raw = (os.getenv("POREIAGO_DATA_DIR") or "").strip()
    if raw:
        return Path(raw)
    return Path(__file__).resolve().parents[2] / "data"


def _catalog_dir() -> Path:
    return _data_dir() / "tenant_trip_catalog"


def _safe_tenant_key(tenant_id: str | None) -> str | None:
    tid = str(tenant_id or "").strip()
    if not tid:
        return None
    cleaned = _SAFE_TENANT.sub("_", tid)
    return cleaned[:120] or None


def _path_for(tenant_id: str) -> Path | None:
    key = _safe_tenant_key(tenant_id)
    if not key:
        return None
    return _catalog_dir() / f"{key}.json"


def _normalize_public_trip(raw: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    try:
        trip_id = int(raw.get("id"))
    except (TypeError, ValueError):
        return None
    if trip_id <= 0:
        return None

    status = str(raw.get("status") or "published").strip().lower()
    if status == "draft":
        # Still store drafts for office sync, but public list filters them out.
        pass

    def _num(key_a: str, key_b: str | None = None, default: float | int | None = 0):
        val = raw.get(key_a)
        if val is None and key_b:
            val = raw.get(key_b)
        if val is None or val == "":
            return default
        try:
            return type(default)(val) if default is not None else float(val)
        except (TypeError, ValueError):
            return default

    child_raw = raw.get("childPrice", raw.get("child_price"))
    child_price = None
    if child_raw not in (None, ""):
        try:
            child_price = float(child_raw)
        except (TypeError, ValueError):
            child_price = None

    return {
        "id": trip_id,
        "title": str(raw.get("title") or "").strip()[:500],
        "destination": str(raw.get("destination") or "").strip()[:500],
        "departureTime": str(raw.get("departureTime") or raw.get("departure_time") or "").strip(),
        "arrivalTime": str(raw.get("arrivalTime") or raw.get("arrival_time") or "").strip(),
        "price": float(_num("price", "base_price", 0) or 0),
        "childPrice": child_price,
        "availableSeats": int(_num("availableSeats", "available_seats", 0) or 0),
        "totalSeats": int(
            _num("totalSeats", "total_seats", _num("availableSeats", "available_seats", 30)) or 30
        ),
        "description": str(raw.get("description") or "").strip(),
        "image": str(raw.get("image") or raw.get("image_url") or "").strip(),
        "hook": str(raw.get("hook") or "").strip(),
        "durationLabel": str(raw.get("durationLabel") or raw.get("duration_label") or "").strip(),
        "badge": str(raw.get("badge") or "").strip(),
        "featured": bool(raw.get("featured")),
        "status": "draft" if status == "draft" else "published",
        "meetingPoint": str(raw.get("meetingPoint") or raw.get("meeting_point") or "").strip(),
        "highlights": raw.get("highlights") if isinstance(raw.get("highlights"), list) else [],
        "stops": raw.get("stops") if isinstance(raw.get("stops"), list) else [],
        "market": str(raw.get("market") or "").strip() or None,
        "vehicleType": str(raw.get("vehicleType") or raw.get("vehicle_type") or "").strip(),
        "currency": str(raw.get("currency") or "EUR").strip() or "EUR",
    }


def replace_tenant_catalog(tenant_id: str, trips: list[dict[str, Any]]) -> int:
    """Replace the full catalog for one tenant (source of truth after office sync)."""
    path = _path_for(tenant_id)
    if path is None:
        return 0
    normalized: list[dict[str, Any]] = []
    seen: set[int] = set()
    for raw in trips or []:
        row = _normalize_public_trip(raw if isinstance(raw, dict) else {})
        if not row or row["id"] in seen:
            continue
        seen.add(row["id"])
        normalized.append(row)
    with _LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".json.tmp")
        payload = {"tenant_id": str(tenant_id).strip(), "trips": normalized}
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(path)
    return len(normalized)


def upsert_tenant_trips(tenant_id: str, trips: list[dict[str, Any]]) -> int:
    """Merge/upsert trips into an existing tenant catalog (partial sync)."""
    path = _path_for(tenant_id)
    if path is None:
        return 0
    with _LOCK:
        current: dict[int, dict[str, Any]] = {}
        if path.is_file():
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
                for item in (raw.get("trips") if isinstance(raw, dict) else []) or []:
                    row = _normalize_public_trip(item)
                    if row:
                        current[row["id"]] = row
            except Exception as exc:
                logger.warning("Failed reading tenant trip catalog: %s", exc)
        saved = 0
        for raw in trips or []:
            row = _normalize_public_trip(raw if isinstance(raw, dict) else {})
            if not row:
                continue
            current[row["id"]] = row
            saved += 1
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".json.tmp")
        payload = {
            "tenant_id": str(tenant_id).strip(),
            "trips": sorted(current.values(), key=lambda t: t["id"]),
        }
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(path)
    return saved


def list_tenant_trips(tenant_id: str | None, *, published_only: bool = True) -> list[dict[str, Any]]:
    path = _path_for(tenant_id)
    if path is None or not path.is_file():
        return []
    with _LOCK:
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Failed reading tenant trip catalog: %s", exc)
            return []
    trips = raw.get("trips") if isinstance(raw, dict) else []
    if not isinstance(trips, list):
        return []
    out: list[dict[str, Any]] = []
    for item in trips:
        row = _normalize_public_trip(item)
        if not row:
            continue
        if published_only and row.get("status") == "draft":
            continue
        out.append(deepcopy(row))
    return out
