"""Pre-trip safety inspection log — JSON persistence with optional Postgres sync."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
STORE_PATH = DATA_DIR / "driver_inspections.json"

PRE_TRIP_TEMPLATE: tuple[dict[str, str], ...] = (
    {"key": "tires", "label": "Ελαστικά / πιέσεις"},
    {"key": "lights", "label": "Φώτα & φανάρια"},
    {"key": "oil", "label": "Έλαιο / υγρά"},
    {"key": "cabin_cleanliness", "label": "Καθαριότητα καμπίνας"},
)


def _load() -> list[dict[str, Any]]:
    if not STORE_PATH.exists():
        return []
    try:
        return json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def _save(rows: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    STORE_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def save_pre_trip_inspection(
    *,
    trip_id: int,
    driver_id: str,
    tenant_id: str,
    items: dict[str, str],
    notes: str | None = None,
    driver_token_hash: str | None = None,
) -> dict[str, Any]:
    required = {i["key"] for i in PRE_TRIP_TEMPLATE}
    missing = required - set(items.keys())
    if missing:
        raise ValueError(f"Missing checklist items: {sorted(missing)}")

    failed = [k for k, v in items.items() if v == "fail"]
    status = "blocked" if failed else "completed"
    now = datetime.now(timezone.utc)
    row = {
        "id": str(uuid.uuid4()),
        "trip_id": trip_id,
        "driver_id": driver_id,
        "tenant_id": tenant_id,
        "items": items,
        "notes": notes,
        "status": status,
        "completed_at": now.isoformat(),
        "driver_token_hash": driver_token_hash,
        "cleared_for_shift": status == "completed",
    }
    rows = _load()
    rows.append(row)
    _save(rows[-500:])
    return row


def latest_inspection_for_trip(trip_id: int) -> dict[str, Any] | None:
    rows = [r for r in _load() if int(r.get("trip_id", 0)) == int(trip_id)]
    if not rows:
        return None
    return sorted(rows, key=lambda r: r.get("completed_at", ""), reverse=True)[0]
