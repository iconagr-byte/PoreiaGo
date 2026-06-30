"""Persistent queue for emails that failed after SMTP retries."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_QUEUE_FILE = Path(__file__).resolve().parents[1] / "data" / "email_retry_queue.json"
_MAX_QUEUE = 200


def _read_queue() -> list[dict[str, Any]]:
    if not _QUEUE_FILE.exists():
        return []
    try:
        raw = json.loads(_QUEUE_FILE.read_text(encoding="utf-8"))
        return raw if isinstance(raw, list) else []
    except (json.JSONDecodeError, OSError, TypeError):
        return []


def _write_queue(rows: list[dict[str, Any]]) -> None:
    _QUEUE_FILE.parent.mkdir(parents=True, exist_ok=True)
    _QUEUE_FILE.write_text(json.dumps(rows[:_MAX_QUEUE], indent=2, ensure_ascii=False), encoding="utf-8")


def enqueue_failed_email(
    *,
    to: str,
    subject: str,
    body_html: str,
    error: str,
    attempts: int,
) -> dict[str, Any]:
    entry = {
        "id": uuid.uuid4().hex[:16],
        "at": datetime.now(timezone.utc).isoformat(),
        "to": to,
        "subject": subject,
        "body_html": body_html,
        "last_error": error,
        "attempts": attempts,
        "queue_attempts": 0,
    }
    rows = _read_queue()
    rows.insert(0, entry)
    _write_queue(rows)
    return entry


def list_queued_emails(*, limit: int = 50) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 200))
    return _read_queue()[:limit]


def remove_from_queue(entry_id: str) -> bool:
    rows = _read_queue()
    remaining = [r for r in rows if r.get("id") != entry_id]
    if len(remaining) == len(rows):
        return False
    _write_queue(remaining)
    return True


def increment_queue_attempt(entry_id: str, error: str) -> None:
    rows = _read_queue()
    for row in rows:
        if row.get("id") == entry_id:
            row["queue_attempts"] = int(row.get("queue_attempts") or 0) + 1
            row["last_error"] = error
            row["last_try_at"] = datetime.now(timezone.utc).isoformat()
            break
    _write_queue(rows)
