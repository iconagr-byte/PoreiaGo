"""Resolve bank account + payment reference for emails & notifications."""

from __future__ import annotations

import re
from typing import Any


def format_iban_display(iban: str) -> str:
    cleaned = re.sub(r"\s+", "", str(iban or "").strip()).upper()
    if not cleaned:
        return "—"
    return " ".join(cleaned[i : i + 4] for i in range(0, len(cleaned), 4))


def build_payment_reference(template: str, booking: dict[str, Any]) -> str:
    pnr = str(booking.get("pnr") or booking.get("id") or "").strip()
    name = str(booking.get("customerName") or "").strip()
    raw_amount = booking.get("amountPaid")
    if raw_amount is None:
        raw_amount = booking.get("balanceDue")
    if raw_amount is None:
        raw_amount = booking.get("price") or booking.get("amount") or 0
    try:
        amount = f"{float(raw_amount):.2f}"
    except (TypeError, ValueError):
        amount = "0.00"
    tpl = str(template or "VOY-{pnr}").strip() or "VOY-{pnr}"
    return (
        tpl.replace("{pnr}", pnr)
        .replace("{amount}", amount)
        .replace("{name}", name)
    )


def resolve_bank_transfer_details(booking: dict[str, Any]) -> dict[str, Any]:
    """Full bank block for pending transfer emails (always uses real IBAN server-side)."""
    from travel_platform.settings.payment_settings_store import read_payment_settings

    settings = read_payment_settings()
    accounts = [a for a in (settings.get("bank_accounts") or []) if a.get("enabled")]
    account_id = booking.get("bankAccountId") or booking.get("bank_account_id")

    account: dict[str, Any] | None = None
    if account_id:
        account = next((a for a in accounts if a.get("id") == account_id), None)
    if not account:
        account = next((a for a in accounts if a.get("is_default")), None)
    if not account and accounts:
        account = accounts[0]

    if not account:
        return {
            "bank_name": "",
            "beneficiary": "",
            "iban": "",
            "iban_display": "—",
            "bic": "",
            "reference": build_payment_reference("VOY-{pnr}", booking),
            "instructions": str(settings.get("global_bank_instructions") or "").strip(),
        }

    reference = build_payment_reference(account.get("reference_template"), booking)
    instructions = str(account.get("instructions") or "").strip()
    global_notes = str(settings.get("global_bank_instructions") or "").strip()
    if global_notes and global_notes not in instructions:
        instructions = f"{instructions}\n{global_notes}".strip() if instructions else global_notes

    iban = str(account.get("iban") or "")
    return {
        "bank_name": str(account.get("bank_name") or "").strip(),
        "beneficiary": str(account.get("beneficiary") or "").strip(),
        "iban": iban,
        "iban_display": format_iban_display(iban),
        "bic": str(account.get("bic") or "").strip(),
        "reference": reference,
        "instructions": instructions,
        "currency": str(account.get("currency") or "EUR").strip(),
    }
