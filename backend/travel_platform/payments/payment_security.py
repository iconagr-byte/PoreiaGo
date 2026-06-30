"""Payment security helpers — IBAN validation, pending deposit checks."""

from __future__ import annotations

import re
from typing import Any


def normalize_iban(value: str) -> str:
    return re.sub(r"\s+", "", str(value or "").strip()).upper()


def validate_iban_checksum(iban: str) -> bool:
    """ISO 13616 mod-97 check."""
    cleaned = normalize_iban(iban)
    if len(cleaned) < 15 or len(cleaned) > 34:
        return False
    if not re.match(r"^[A-Z]{2}\d{2}[A-Z0-9]+$", cleaned):
        return False
    rearranged = cleaned[4:] + cleaned[:4]
    digits = ""
    for ch in rearranged:
        if ch.isdigit():
            digits += ch
        elif "A" <= ch <= "Z":
            digits += str(ord(ch) - 55)
        else:
            return False
    try:
        return int(digits) % 97 == 1
    except ValueError:
        return False


def mask_iban(iban: str, visible_tail: int = 4) -> str:
    cleaned = normalize_iban(iban)
    if len(cleaned) <= visible_tail + 4:
        return cleaned
    head = cleaned[:4]
    tail = cleaned[-visible_tail:]
    masked_len = max(4, len(cleaned) - len(head) - visible_tail)
    return f"{head}{'*' * masked_len}{tail}"


def is_pending_bank_transfer_booking(data: dict[str, Any]) -> bool:
    status = str(data.get("status") or "")
    payment_status = str(data.get("paymentStatus") or data.get("payment_status") or "").upper()
    payment_method = str(data.get("paymentMethod") or data.get("payment_method") or "")
    if status == "Εκκρεμής":
        return True
    if "PENDING" in payment_status and (
        "BANK" in payment_status
        or "ΤΡΑΠΕΖ" in payment_status.upper()
        or "τραπεζ" in payment_method.lower()
        or "Τραπεζ" in payment_method
    ):
        return True
    return False


def amounts_match(expected: float, confirmed: float, tolerance: float = 0.02) -> bool:
    return abs(float(expected) - float(confirmed)) <= tolerance


def references_match(booking: dict[str, Any], reference: str) -> bool:
    ref = str(reference or "").strip().upper().replace(" ", "")
    if not ref:
        return False
    candidates = {
        str(booking.get("pnr") or "").strip().upper().replace(" ", ""),
        str(booking.get("id") or "").strip().upper().replace(" ", ""),
        str(booking.get("saasBookingId") or "").strip().upper().replace(" ", ""),
    }
    candidates.discard("")
    if ref in candidates:
        return True
    for cand in candidates:
        if cand.endswith(ref) or ref.endswith(cand):
            return True
        if ref.replace("BK-", "").replace("B-", "") == cand.replace("BK-", "").replace("B-", ""):
            return True
    return False
