"""Επικύρωση & decode συνημμένων email."""

from __future__ import annotations

import base64
from typing import Any

MAX_ATTACHMENTS = 10
MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_TOTAL_BYTES = 20 * 1024 * 1024


def _safe_filename(name: str) -> str:
    base = (name or "attachment").replace("\\", "/").split("/")[-1].strip()
    if not base or base in (".", ".."):
        base = "attachment"
    if len(base) > 200:
        base = base[-200:]
    return base


def normalize_attachments(raw: list[dict] | None) -> list[dict]:
    if not raw:
        return []
    if len(raw) > MAX_ATTACHMENTS:
        raise ValueError(f"Μέγιστο {MAX_ATTACHMENTS} συνημμένα")
    out: list[dict] = []
    total = 0
    for item in raw:
        filename = _safe_filename(str(item.get("filename") or "file"))
        ctype = str(item.get("content_type") or "application/octet-stream").split(";")[0].strip()
        if "/" not in ctype:
            ctype = "application/octet-stream"
        b64 = (item.get("data_base64") or "").strip()
        if not b64:
            raise ValueError(f"Κενό συνημμένο: {filename}")
        try:
            data = base64.b64decode(b64, validate=True)
        except Exception as exc:
            raise ValueError(f"Μη έγκυρο αρχείο: {filename}") from exc
        if len(data) > MAX_FILE_BYTES:
            raise ValueError(f"Το {filename} υπερβαίνει τα 8 MB")
        total += len(data)
        if total > MAX_TOTAL_BYTES:
            raise ValueError("Το συνολικό μέγεθος συνημμένων υπερβαίνει τα 20 MB")
        out.append({"filename": filename, "content_type": ctype, "data": data})
    return out
