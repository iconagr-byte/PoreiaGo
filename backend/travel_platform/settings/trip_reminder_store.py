"""Per-office trip reminder email settings — minimal JSON store."""

from __future__ import annotations

import json
import os
import re
import threading
from copy import deepcopy
from pathlib import Path
from typing import Any

from travel_platform.settings.drivers_store import DEMO_TENANT_ID

_LOCK = threading.Lock()
_SAFE_TENANT = re.compile(r"[^a-zA-Z0-9_-]+")

DEFAULT_TRIP_REMINDER: dict[str, Any] = {
    "enabled": True,
    "days_before": 3,
    "send_hour": 9,
    "subject": "Η εκδρομή σου πλησιάζει · {trip}",
    "headline": "Σε {days} μέρες φεύγεις",
    "body": (
        "Υπενθύμιση για την επερχόμενη εκδρομή σου. "
        "Έλεγξε ώρα και θέσεις — το εισιτήριό σου είναι στο My Wallet."
    ),
}


def _data_dir() -> Path:
    raw = (os.getenv("POREIAGO_DATA_DIR") or "").strip()
    if raw:
        return Path(raw)
    return Path(__file__).resolve().parents[2] / "data"


def _safe_tenant_key(tenant_id: str | None) -> str:
    tid = str(tenant_id or "").strip() or DEMO_TENANT_ID
    cleaned = _SAFE_TENANT.sub("_", tid)
    return (cleaned[:120] or DEMO_TENANT_ID)


def _path_for(tenant_id: str | None) -> Path:
    return _data_dir() / "trip_reminders" / f"{_safe_tenant_key(tenant_id)}.json"


def _normalize(raw: dict[str, Any] | None) -> dict[str, Any]:
    base = deepcopy(DEFAULT_TRIP_REMINDER)
    if not isinstance(raw, dict):
        return base
    if "enabled" in raw:
        base["enabled"] = bool(raw.get("enabled"))
    try:
        days = int(raw.get("days_before", base["days_before"]))
        base["days_before"] = max(1, min(30, days))
    except (TypeError, ValueError):
        pass
    try:
        hour = int(raw.get("send_hour", base["send_hour"]))
        base["send_hour"] = max(0, min(23, hour))
    except (TypeError, ValueError):
        pass
    for key in ("subject", "headline", "body"):
        val = raw.get(key)
        if isinstance(val, str) and val.strip():
            base[key] = val.strip()[:2000 if key == "body" else 200]
    return base


def read_trip_reminder_settings(tenant_id: str | None = None) -> dict[str, Any]:
    path = _path_for(tenant_id)
    if not path.is_file():
        return deepcopy(DEFAULT_TRIP_REMINDER)
    try:
        with _LOCK:
            data = json.loads(path.read_text(encoding="utf-8"))
        return _normalize(data if isinstance(data, dict) else {})
    except Exception:
        return deepcopy(DEFAULT_TRIP_REMINDER)


def write_trip_reminder_settings(
    data: dict[str, Any],
    tenant_id: str | None = None,
) -> dict[str, Any]:
    normalized = _normalize(data)
    path = _path_for(tenant_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with _LOCK:
        path.write_text(
            json.dumps(normalized, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return normalized


def list_trip_reminder_tenant_ids() -> list[str]:
    """Tenant keys that have a saved reminder file (plus callers may scan all tenants)."""
    root = _data_dir() / "trip_reminders"
    if not root.is_dir():
        return []
    out: list[str] = []
    for path in root.glob("*.json"):
        key = path.stem.strip()
        if key:
            out.append(key)
    return out
