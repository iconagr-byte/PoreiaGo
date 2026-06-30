"""Append-only audit log for payment admin actions (JSON file)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_AUDIT_FILE = Path(__file__).resolve().parent / "payment_audit.json"
_MAX_ENTRIES = 500

FISCAL_AUDIT_ACTIONS = frozenset({
    "fiscal_receipt_issued",
    "fiscal_receipt_failed",
    "fiscal_receipt_retry",
    "fiscal_manual_issue",
    "fiscal_credit_note_queued",
    "fiscal_credit_note_issued",
})

PAYMENT_AUDIT_ACTION_LABELS: dict[str, str] = {
    "bank_deposit_confirmed": "Επιβεβαίωση κατάθεσης",
    "cash_payment_recorded": "Καταχώρηση μετρητών",
    "fiscal_receipt_issued": "Έκδοση φορολογικής απόδειξης",
    "fiscal_receipt_failed": "Αποτυχία φορολογικής",
    "fiscal_receipt_retry": "Επανάληψη έκδοσης",
    "fiscal_manual_issue": "Χειροκίνητη έκδοση",
    "fiscal_credit_note_queued": "Πιστωτικό — ουρά",
    "fiscal_credit_note_issued": "Πιστωτικό — εκδόθηκε",
}


def _read_all() -> list[dict[str, Any]]:
    if not _AUDIT_FILE.exists():
        return []
    try:
        raw = json.loads(_AUDIT_FILE.read_text(encoding="utf-8"))
        return raw if isinstance(raw, list) else []
    except (json.JSONDecodeError, OSError, TypeError):
        return []


def append_payment_audit(
    *,
    action: str,
    booking_id: str,
    amount_eur: float | None = None,
    reference: str | None = None,
    actor_id: str | None = None,
    detail: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    entry = {
        "id": uuid.uuid4().hex[:16],
        "at": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "booking_id": booking_id,
        "amount_eur": amount_eur,
        "reference": reference,
        "actor_id": actor_id,
        "detail": detail,
        "metadata": metadata or {},
    }
    rows = _read_all()
    rows.insert(0, entry)
    rows = rows[:_MAX_ENTRIES]
    _AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    _AUDIT_FILE.write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
    return entry


def list_payment_audit(*, limit: int = 50) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 200))
    return _read_all()[:limit]


def filter_payment_audit(
    rows: list[dict[str, Any]],
    *,
    fiscal_only: bool = False,
    actions: set[str] | frozenset[str] | None = None,
) -> list[dict[str, Any]]:
    if actions:
        allowed = set(actions)
        return [row for row in rows if row.get("action") in allowed]
    if fiscal_only:
        return [row for row in rows if row.get("action") in FISCAL_AUDIT_ACTIONS]
    return list(rows)


def payment_audit_action_label(action: str | None) -> str:
    if not action:
        return ""
    return PAYMENT_AUDIT_ACTION_LABELS.get(action, action)


def serialize_payment_audit_csv(rows: list[dict[str, Any]]) -> bytes:
    import csv
    import io

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "Ημ/νία UTC",
        "Ενέργεια",
        "Κράτηση",
        "Ποσό EUR",
        "Αναφορά",
        "Λεπτομέρεια",
        "MARK",
        "Πάροχος",
        "Invoice ID",
        "Actor ID",
    ])
    for row in rows:
        meta = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
        writer.writerow([
            row.get("at") or "",
            payment_audit_action_label(str(row.get("action") or "")),
            row.get("booking_id") or "",
            row.get("amount_eur") if row.get("amount_eur") is not None else "",
            row.get("reference") or "",
            row.get("detail") or "",
            meta.get("mark") or "",
            meta.get("provider") or "",
            meta.get("invoice_id") or "",
            row.get("actor_id") or "",
        ])
    return ("\ufeff" + buffer.getvalue()).encode("utf-8")
