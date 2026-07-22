"""Driver ↔ office chat — durable JSON store under POREIAGO_DATA_DIR."""

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

Sender = Literal["driver", "office"]

_DATA_DIR = Path(os.getenv("POREIAGO_DATA_DIR") or Path(__file__).resolve().parents[2] / "data")
STORE_PATH = Path(os.getenv("DRIVER_OFFICE_CHAT_STORE") or (_DATA_DIR / "driver_office_chat.json"))
_MAX_MESSAGES = 8_000
_lock = threading.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _empty() -> dict[str, Any]:
    return {"messages": []}


def _load() -> dict[str, Any]:
    if not STORE_PATH.exists():
        return _empty()
    try:
        data = json.loads(STORE_PATH.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("messages"), list):
            return data
    except (json.JSONDecodeError, OSError, TypeError) as exc:
        logger.warning("driver chat load failed: %s", exc)
    return _empty()


def _save(data: dict[str, Any]) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = STORE_PATH.with_suffix(".tmp")
    payload = {"messages": list(data.get("messages") or [])[-_MAX_MESSAGES:]}
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(STORE_PATH)


def reset_chat_store_for_tests(path: Path | None = None) -> None:
    global STORE_PATH
    if path is not None:
        STORE_PATH = Path(path)
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _lock:
        _save(_empty())


def append_message(
    *,
    tenant_id: str,
    driver_id: str,
    sender: Sender,
    body: str,
    trip_id: int | None = None,
    sender_name: str | None = None,
    sender_user_id: str | None = None,
) -> dict[str, Any]:
    tid = str(tenant_id or "").strip()
    did = str(driver_id or "").strip()
    text = " ".join(str(body or "").split()).strip()
    if not tid or not did:
        raise ValueError("tenant_id and driver_id required")
    if not text:
        raise ValueError("Το μήνυμα είναι κενό")
    if len(text) > 2000:
        raise ValueError("Το μήνυμα είναι πολύ μεγάλο (μέγ. 2000 χαρακτήρες)")
    if sender not in ("driver", "office"):
        raise ValueError("invalid sender")

    row = {
        "id": uuid.uuid4().hex[:16],
        "tenant_id": tid,
        "driver_id": did,
        "trip_id": int(trip_id) if trip_id is not None else None,
        "sender": sender,
        "sender_name": (sender_name or "").strip() or None,
        "sender_user_id": (sender_user_id or "").strip() or None,
        "body": text,
        "created_at": _now_iso(),
        # Own side already has the message; peer delivery/read start empty.
        "delivered_to_driver_at": _now_iso() if sender == "driver" else None,
        "delivered_to_office_at": _now_iso() if sender == "office" else None,
        "read_by_driver_at": _now_iso() if sender == "driver" else None,
        "read_by_office_at": _now_iso() if sender == "office" else None,
    }
    with _lock:
        data = _load()
        data["messages"].append(row)
        _save(data)
    # Sender-facing receipt starts as "sent" (peer not yet delivered/read).
    return enrich_message(row, sender)


def receipt_status_for_viewer(row: dict[str, Any], viewer: Sender) -> str | None:
    """iMessage-style status for the sender's own bubble: sent | delivered | read."""
    if not row or row.get("sender") != viewer:
        return None
    if viewer == "driver":
        if row.get("read_by_office_at"):
            return "read"
        if row.get("delivered_to_office_at"):
            return "delivered"
        return "sent"
    if row.get("read_by_driver_at"):
        return "read"
    if row.get("delivered_to_driver_at"):
        return "delivered"
    return "sent"


def enrich_message(row: dict[str, Any], viewer: Sender | None = None) -> dict[str, Any]:
    out = dict(row)
    # Always expose both perspectives; ``receipt`` is viewer-specific.
    out["receipt_driver"] = receipt_status_for_viewer(out, "driver")
    out["receipt_office"] = receipt_status_for_viewer(out, "office")
    if viewer in ("driver", "office"):
        out["receipt"] = receipt_status_for_viewer(out, viewer)
    return out


def list_messages(
    *,
    tenant_id: str,
    driver_id: str,
    after_id: str | None = None,
    limit: int = 100,
    viewer: Sender | None = None,
) -> list[dict[str, Any]]:
    tid = str(tenant_id or "").strip()
    did = str(driver_id or "").strip()
    if not tid or not did:
        return []
    if viewer in ("driver", "office"):
        mark_thread_delivered(tenant_id=tid, driver_id=did, recipient=viewer)
    cap = max(1, min(int(limit), 500))
    with _lock:
        rows = [
            dict(m)
            for m in (_load().get("messages") or [])
            if str(m.get("tenant_id") or "") == tid and str(m.get("driver_id") or "") == did
        ]

    if after_id:
        idx = next((i for i, m in enumerate(rows) if m.get("id") == after_id), None)
        if idx is not None:
            rows = rows[idx + 1 :]
        else:
            rows = rows[-cap:]

    if len(rows) > cap:
        rows = rows[-cap:]
    return [enrich_message(m, viewer) for m in rows]


def mark_thread_delivered(
    *,
    tenant_id: str,
    driver_id: str,
    recipient: Sender,
) -> int:
    """Peer fetched the thread → mark undelivered messages as delivered (iMessage style)."""
    tid = str(tenant_id or "").strip()
    did = str(driver_id or "").strip()
    if not tid or not did or recipient not in ("driver", "office"):
        return 0
    field = "delivered_to_driver_at" if recipient == "driver" else "delivered_to_office_at"
    peer = "office" if recipient == "driver" else "driver"
    now = _now_iso()
    changed = 0
    with _lock:
        data = _load()
        for row in data.get("messages") or []:
            if str(row.get("tenant_id") or "") != tid or str(row.get("driver_id") or "") != did:
                continue
            if row.get("sender") != peer:
                continue
            if row.get(field):
                continue
            row[field] = now
            changed += 1
        if changed:
            _save(data)
    return changed


def mark_thread_read(
    *,
    tenant_id: str,
    driver_id: str,
    reader: Sender,
) -> int:
    """Mark all peer messages in the thread as read (also implies delivered)."""
    tid = str(tenant_id or "").strip()
    did = str(driver_id or "").strip()
    if not tid or not did or reader not in ("driver", "office"):
        return 0
    read_field = "read_by_driver_at" if reader == "driver" else "read_by_office_at"
    delivered_field = "delivered_to_driver_at" if reader == "driver" else "delivered_to_office_at"
    peer = "office" if reader == "driver" else "driver"
    now = _now_iso()
    changed = 0
    with _lock:
        data = _load()
        for row in data.get("messages") or []:
            if str(row.get("tenant_id") or "") != tid or str(row.get("driver_id") or "") != did:
                continue
            if row.get("sender") != peer:
                continue
            if not row.get(delivered_field):
                row[delivered_field] = now
            if row.get(read_field):
                continue
            row[read_field] = now
            changed += 1
        if changed:
            _save(data)
    return changed


def list_threads(*, tenant_id: str, limit: int = 50) -> list[dict[str, Any]]:
    tid = str(tenant_id or "").strip()
    if not tid:
        return []
    cap = max(1, min(int(limit), 200))
    with _lock:
        rows = [
            m
            for m in (_load().get("messages") or [])
            if str(m.get("tenant_id") or "") == tid
        ]

    by_driver: dict[str, dict[str, Any]] = {}
    for m in rows:
        did = str(m.get("driver_id") or "")
        if not did:
            continue
        prev = by_driver.get(did)
        if not prev or str(m.get("created_at") or "") >= str(prev.get("last_at") or ""):
            by_driver[did] = {
                "driver_id": did,
                "trip_id": m.get("trip_id"),
                "last_message": m.get("body"),
                "last_sender": m.get("sender"),
                "last_at": m.get("created_at"),
                "sender_name": m.get("sender_name"),
            }

    for did, thread in by_driver.items():
        unread = 0
        for m in rows:
            if str(m.get("driver_id") or "") != did:
                continue
            if m.get("sender") == "driver" and not m.get("read_by_office_at"):
                unread += 1
        thread["unread_office"] = unread

    threads = sorted(
        by_driver.values(),
        key=lambda t: str(t.get("last_at") or ""),
        reverse=True,
    )
    return threads[:cap]


def unread_counts(*, tenant_id: str, driver_id: str | None = None) -> dict[str, int]:
    tid = str(tenant_id or "").strip()
    did = str(driver_id or "").strip() or None
    office = 0
    driver = 0
    with _lock:
        for m in _load().get("messages") or []:
            if str(m.get("tenant_id") or "") != tid:
                continue
            if did and str(m.get("driver_id") or "") != did:
                continue
            if m.get("sender") == "driver" and not m.get("read_by_office_at"):
                office += 1
            if m.get("sender") == "office" and not m.get("read_by_driver_at"):
                driver += 1
    return {"office": office, "driver": driver}
