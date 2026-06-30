"""Driver expense uploads — local filesystem + JSON index (mock S3)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
UPLOAD_DIR = DATA_DIR / "uploads" / "driver_expenses"
INDEX_PATH = DATA_DIR / "driver_expenses.json"

ALLOWED_CATEGORIES = frozenset({"fuel", "tolls", "maintenance", "other"})


def _load_index() -> list[dict[str, Any]]:
    if not INDEX_PATH.exists():
        return []
    try:
        return json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def _save_index(rows: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def save_driver_expense_upload(
    *,
    amount: float,
    category: str,
    trip_id: int,
    driver_id: str,
    tenant_id: str,
    description: str | None,
    receipt_bytes: bytes | None,
    receipt_filename: str | None,
    content_type: str | None,
) -> dict[str, Any]:
    cat = (category or "other").lower().strip()
    if cat not in ALLOWED_CATEGORIES:
        raise ValueError(f"Invalid category: {category}")

    now = datetime.now(timezone.utc)
    expense_id = str(uuid.uuid4())
    receipt_path: str | None = None

    if receipt_bytes:
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        ext = _guess_ext(receipt_filename, content_type)
        fname = f"{expense_id}{ext}"
        path = UPLOAD_DIR / fname
        path.write_bytes(receipt_bytes)
        receipt_path = str(path.relative_to(DATA_DIR)).replace("\\", "/")

    row = {
        "id": expense_id,
        "amount": round(float(amount), 2),
        "category": cat,
        "trip_id": trip_id,
        "driver_id": driver_id,
        "tenant_id": tenant_id,
        "description": description,
        "receipt_path": receipt_path,
        "created_at": now.isoformat(),
    }
    rows = _load_index()
    rows.append(row)
    _save_index(rows[-2000:])
    return row


def _guess_ext(filename: str | None, content_type: str | None) -> str:
    if filename and "." in filename:
        return Path(filename).suffix.lower()[:8]
    if content_type and "png" in content_type:
        return ".png"
    if content_type and "webp" in content_type:
        return ".webp"
    return ".jpg"
