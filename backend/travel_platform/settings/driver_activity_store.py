"""Append-only driver activity log — logins & shifts (JSON under POREIAGO_DATA_DIR)."""

from __future__ import annotations

import json
import logging
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

logger = logging.getLogger(__name__)

ActivityType = Literal["login", "login_master_qr", "shift_start", "shift_end"]

_DATA_DIR = Path(os.getenv("POREIAGO_DATA_DIR") or Path(__file__).resolve().parents[2] / "data")
STORE_PATH = Path(os.getenv("DRIVER_ACTIVITY_STORE") or (_DATA_DIR / "driver_activity.json"))
_MAX_EVENTS = 5_000
_lock = threading.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _empty() -> dict[str, Any]:
    return {"events": [], "open_shifts": {}}


def _load() -> dict[str, Any]:
    if not STORE_PATH.exists():
        return _empty()
    try:
        data = json.loads(STORE_PATH.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return _empty()
        events = data.get("events")
        open_shifts = data.get("open_shifts")
        if not isinstance(events, list):
            events = []
        if not isinstance(open_shifts, dict):
            open_shifts = {}
        return {"events": events, "open_shifts": open_shifts}
    except (json.JSONDecodeError, OSError, TypeError) as exc:
        logger.warning("driver_activity load failed: %s", exc)
        return _empty()


def _save(data: dict[str, Any]) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = STORE_PATH.with_suffix(".tmp")
    payload = {
        "events": list(data.get("events") or [])[:_MAX_EVENTS],
        "open_shifts": dict(data.get("open_shifts") or {}),
    }
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(STORE_PATH)


def reset_activity_store_for_tests(path: Path | None = None) -> None:
    """Point store at a temp file and clear it (unit tests)."""
    global STORE_PATH
    if path is not None:
        STORE_PATH = Path(path)
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _lock:
        _save(_empty())


def record_driver_login(
    *,
    driver_id: str,
    tenant_id: str | None = None,
    trip_id: int | None = None,
    method: Literal["password", "master_qr"] = "password",
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    did = str(driver_id or "").strip()
    if not did or did == "master-qr-driver":
        return {}
    event_type: ActivityType = "login_master_qr" if method == "master_qr" else "login"
    entry = {
        "id": uuid.uuid4().hex[:16],
        "at": _now_iso(),
        "type": event_type,
        "driver_id": did,
        "tenant_id": str(tenant_id or ""),
        "trip_id": int(trip_id) if trip_id is not None else None,
        "method": method,
        "meta": meta or {},
    }
    with _lock:
        data = _load()
        data["events"].insert(0, entry)
        _save(data)
    return entry


def record_shift_start(
    *,
    driver_id: str,
    tenant_id: str | None = None,
    trip_id: int | None = None,
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    did = str(driver_id or "").strip()
    if not did or did == "master-qr-driver":
        return {}
    shift_id = uuid.uuid4().hex[:16]
    entry = {
        "id": uuid.uuid4().hex[:16],
        "at": _now_iso(),
        "type": "shift_start",
        "driver_id": did,
        "tenant_id": str(tenant_id or ""),
        "trip_id": int(trip_id) if trip_id is not None else None,
        "shift_id": shift_id,
        "meta": meta or {},
    }
    with _lock:
        data = _load()
        data["events"].insert(0, entry)
        data["open_shifts"][did] = {
            "shift_id": shift_id,
            "started_at": entry["at"],
            "tenant_id": entry["tenant_id"],
            "trip_id": entry["trip_id"],
        }
        _save(data)
    return entry


def record_shift_end(
    *,
    driver_id: str,
    tenant_id: str | None = None,
    trip_id: int | None = None,
    km: float | None = None,
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    did = str(driver_id or "").strip()
    if not did or did == "master-qr-driver":
        return {}
    ended_at = _now_iso()
    with _lock:
        data = _load()
        open_row = data["open_shifts"].pop(did, None) or {}
        shift_id = open_row.get("shift_id") or uuid.uuid4().hex[:16]
        started_at = open_row.get("started_at")
        duration_min = None
        if started_at:
            try:
                t0 = datetime.fromisoformat(str(started_at).replace("Z", "+00:00"))
                t1 = datetime.fromisoformat(ended_at.replace("Z", "+00:00"))
                duration_min = max(0, round((t1 - t0).total_seconds() / 60.0, 1))
            except (TypeError, ValueError):
                duration_min = None
        entry = {
            "id": uuid.uuid4().hex[:16],
            "at": ended_at,
            "type": "shift_end",
            "driver_id": did,
            "tenant_id": str(tenant_id or open_row.get("tenant_id") or ""),
            "trip_id": (
                int(trip_id)
                if trip_id is not None
                else (int(open_row["trip_id"]) if open_row.get("trip_id") is not None else None)
            ),
            "shift_id": shift_id,
            "started_at": started_at,
            "duration_min": duration_min,
            "km": round(float(km), 2) if km is not None else None,
            "meta": meta or {},
        }
        data["events"].insert(0, entry)
        _save(data)
    return entry


def list_driver_events(
    driver_id: str,
    *,
    limit: int = 200,
    types: set[str] | frozenset[str] | None = None,
) -> list[dict[str, Any]]:
    did = str(driver_id or "").strip()
    if not did:
        return []
    cap = max(1, min(int(limit), 1000))
    with _lock:
        events = list(_load().get("events") or [])

    out: list[dict[str, Any]] = []
    for row in events:
        if str(row.get("driver_id") or "") != did:
            continue
        if types and str(row.get("type") or "") not in types:
            continue
        out.append(dict(row))
        if len(out) >= cap:
            break
    return out


def get_open_shift(driver_id: str) -> dict[str, Any] | None:
    did = str(driver_id or "").strip()
    if not did:
        return None
    with _lock:
        row = (_load().get("open_shifts") or {}).get(did)
    return dict(row) if isinstance(row, dict) else None


def pair_driver_shifts(driver_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
    """Return completed + open shifts newest-first."""
    events = list_driver_events(
        driver_id,
        limit=1000,
        types=frozenset({"shift_start", "shift_end"}),
    )
    # events are newest-first; rebuild chronologically for pairing
    chronological = list(reversed(events))
    by_id: dict[str, dict[str, Any]] = {}
    orphan_ends: list[dict[str, Any]] = []

    for ev in chronological:
        sid = str(ev.get("shift_id") or "")
        if ev.get("type") == "shift_start":
            by_id[sid or ev["id"]] = {
                "shift_id": sid or ev["id"],
                "started_at": ev.get("at"),
                "ended_at": None,
                "trip_id": ev.get("trip_id"),
                "tenant_id": ev.get("tenant_id"),
                "duration_min": None,
                "km": None,
                "status": "open",
            }
        elif ev.get("type") == "shift_end":
            key = sid
            row = by_id.get(key) if key else None
            if row:
                row["ended_at"] = ev.get("at")
                row["duration_min"] = ev.get("duration_min")
                row["km"] = ev.get("km")
                row["status"] = "completed"
                if ev.get("trip_id") is not None:
                    row["trip_id"] = ev.get("trip_id")
            else:
                orphan_ends.append(
                    {
                        "shift_id": sid or ev.get("id"),
                        "started_at": ev.get("started_at"),
                        "ended_at": ev.get("at"),
                        "trip_id": ev.get("trip_id"),
                        "tenant_id": ev.get("tenant_id"),
                        "duration_min": ev.get("duration_min"),
                        "km": ev.get("km"),
                        "status": "completed",
                    }
                )

    open_row = get_open_shift(driver_id)
    if open_row:
        sid = str(open_row.get("shift_id") or "")
        if sid and sid not in by_id:
            by_id[sid] = {
                "shift_id": sid,
                "started_at": open_row.get("started_at"),
                "ended_at": None,
                "trip_id": open_row.get("trip_id"),
                "tenant_id": open_row.get("tenant_id"),
                "duration_min": None,
                "km": None,
                "status": "open",
            }

    shifts = list(by_id.values()) + orphan_ends

    def _sort_key(row: dict[str, Any]) -> str:
        return str(row.get("ended_at") or row.get("started_at") or "")

    shifts.sort(key=_sort_key, reverse=True)
    return shifts[: max(1, min(int(limit), 500))]


def activity_summary(driver_id: str) -> dict[str, Any]:
    logins = list_driver_events(
        driver_id,
        limit=1000,
        types=frozenset({"login", "login_master_qr"}),
    )
    shifts = pair_driver_shifts(driver_id, limit=500)
    completed = [s for s in shifts if s.get("status") == "completed"]
    km_sum = 0.0
    for s in completed:
        if s.get("km") is not None:
            try:
                km_sum += float(s["km"])
            except (TypeError, ValueError):
                pass
    return {
        "login_count": len(logins),
        "shift_count": len(shifts),
        "completed_shifts": len(completed),
        "open_shifts": sum(1 for s in shifts if s.get("status") == "open"),
        "shift_km_total": round(km_sum, 2),
        "last_login_at": logins[0].get("at") if logins else None,
        "last_shift_at": shifts[0].get("ended_at") or shifts[0].get("started_at") if shifts else None,
    }
