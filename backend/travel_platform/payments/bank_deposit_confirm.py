"""Secure bank deposit confirmation — validation + booking patch shape."""

from __future__ import annotations

from typing import Any

from travel_platform.payments.payment_security import (
    amounts_match,
    is_pending_bank_transfer_booking,
    references_match,
)
from travel_platform.settings.payment_audit_store import append_payment_audit
from travel_platform.settings.payment_settings_store import read_payment_settings


def validate_confirm_request(booking: dict[str, Any], body: dict[str, Any]) -> None:
    if not is_pending_bank_transfer_booking(booking):
        raise ValueError("Booking is not pending bank transfer")

    settings = read_payment_settings()
    security = settings.get("security") or {}

    expected_amount = float(booking.get("balanceDue") or booking.get("price") or 0)
    if security.get("require_amount_on_confirm", True):
        confirmed = body.get("confirmed_amount")
        if confirmed is None:
            raise ValueError("confirmed_amount required")
        if not amounts_match(expected_amount, float(confirmed)):
            raise ValueError(f"Amount mismatch — expected €{expected_amount:.2f}")

    if security.get("require_reference_on_confirm", True):
        reference = str(body.get("reference_code") or "").strip()
        if not reference:
            raise ValueError("reference_code required")
        if not references_match(booking, reference):
            raise ValueError("Reference does not match booking PNR")


def build_confirm_patch(booking: dict[str, Any], note: str | None = None) -> dict[str, Any]:
    total = round(float(booking.get("price") or 0), 2)
    bank_due = round(float(booking.get("balanceDue") or 0), 2)
    new_paid = bank_due if bank_due > 0 else total
    payment_plan = booking.get("paymentPlan") or "full"
    deposit_percent = int(booking.get("depositPercent") or 30)

    new_balance = 0.0
    payment_status = "PAID (Bank Transfer)"
    payment_method = "Τραπεζική μεταφορά"

    if payment_plan == "deposit":
        new_balance = round(max(0.0, total - new_paid), 2)
        payment_status = f"DEPOSIT {deposit_percent}% (Bank Transfer confirmed)"
        payment_method = f"Τραπεζική μεταφορά · προκαταβολή {deposit_percent}%"

    audit_note = note or ""
    existing_notes = str(booking.get("notes") or "").strip()
    from datetime import datetime

    timestamp = datetime.now().strftime("%d/%m/%Y %H:%M")
    notes = f"{existing_notes} Κατάθεση επιβεβαιώθηκε {timestamp}."
    if audit_note:
        notes = f"{notes} ({audit_note})"

    return {
        "status": "Επιβεβαιωμένη",
        "paymentStatus": payment_status,
        "paymentMethod": payment_method,
        "amountPaid": new_paid,
        "balanceDue": new_balance,
        "boardingPassIssued": True,
        "notes": notes.strip(),
    }


def record_confirm_audit(
    *,
    booking_id: str,
    amount_eur: float,
    reference: str | None,
    actor_id: str | None = None,
    detail: str | None = None,
) -> dict[str, Any] | None:
    settings = read_payment_settings()
    security = settings.get("security") or {}
    if not security.get("audit_payment_actions", True):
        return None
    return append_payment_audit(
        action="bank_deposit_confirmed",
        booking_id=booking_id,
        amount_eur=amount_eur,
        reference=reference,
        actor_id=actor_id,
        detail=detail,
    )
