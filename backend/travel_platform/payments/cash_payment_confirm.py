"""Cash payment capture — office counter & driver/on-bus collection."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from travel_platform.payments.payment_security import references_match
from travel_platform.settings.payment_audit_store import append_payment_audit
from travel_platform.settings.payment_settings_store import read_payment_settings


class CashPaymentChannel(str, Enum):
    OFFICE_COUNTER = "office_counter"
    DRIVER_ON_BUS = "driver_on_bus"


CHANNEL_LABELS = {
    CashPaymentChannel.OFFICE_COUNTER: "Μετρητά — γκισέ γραφείου",
    CashPaymentChannel.DRIVER_ON_BUS: "Μετρητά — οδηγός / λεωφορείο",
}


def _balance_due(booking: dict[str, Any]) -> float:
    total = float(booking.get("price") or booking.get("total_eur") or 0)
    paid = float(booking.get("amountPaid") or booking.get("amount_paid") or 0)
    explicit = booking.get("balanceDue")
    if explicit is not None:
        return round(max(float(explicit), 0.0), 2)
    return round(max(total - paid, 0.0), 2)


def validate_cash_payment_request(booking: dict[str, Any], body: dict[str, Any]) -> CashPaymentChannel:
    status = str(booking.get("status") or "").lower()
    if status in ("ακυρωμένη", "cancelled", "refunded", "ακυρωμενη"):
        raise ValueError("Η κράτηση είναι ακυρωμένη")

    try:
        channel = CashPaymentChannel(str(body.get("channel") or ""))
    except ValueError as exc:
        raise ValueError("channel must be office_counter or driver_on_bus") from exc

    amount = body.get("amount")
    if amount is None:
        raise ValueError("amount required")
    amount_f = round(float(amount), 2)
    if amount_f <= 0:
        raise ValueError("amount must be positive")

    balance = _balance_due(booking)
    total = round(float(booking.get("price") or 0), 2)
    max_allowed = balance if balance > 0 else total
    if max_allowed <= 0 and amount_f > total:
        raise ValueError("Η κράτηση φαίνεται ήδη εξοφλημένη")
    if amount_f > max_allowed + 0.01:
        raise ValueError(f"Το ποσό υπερβαίνει το υπόλοιπο (€{max_allowed:.2f})")

    settings = read_payment_settings()
    security = settings.get("security") or {}
    if security.get("require_amount_on_confirm", True) and amount_f <= 0:
        raise ValueError("confirmed amount required")

    if security.get("require_reference_on_confirm", True):
        reference = str(body.get("reference_code") or "").strip()
        if reference and not references_match(booking, reference):
            raise ValueError("Ο κωδικός κράτησης δεν ταιριάζει")

    return channel


def build_cash_payment_patch(
    booking: dict[str, Any],
    *,
    channel: CashPaymentChannel,
    amount_paid_now: float,
    new_amount_paid: float,
    new_balance: float,
    note: str | None = None,
    receipt_number: str | None = None,
) -> dict[str, Any]:
    deposit_percent = int(booking.get("depositPercent") or 30)
    payment_plan = booking.get("paymentPlan") or ("deposit" if new_balance > 0 else "full")
    label = CHANNEL_LABELS[channel]

    if new_balance > 0:
        payment_status = f"DEPOSIT {deposit_percent}% ({label})"
        status = "Επιβεβαιωμένη"
    else:
        payment_status = f"PAID ({label})"
        status = "Επιβεβαιωμένη"

    timestamp = datetime.now().strftime("%d/%m/%Y %H:%M")
    existing_notes = str(booking.get("notes") or "").strip()
    notes = f"{existing_notes} Μετρητά €{amount_paid_now:.2f} — {label} ({timestamp}).".strip()
    if receipt_number:
        notes = f"{notes} Απόδειξη #{receipt_number}."
    if note:
        notes = f"{notes} ({note})"

    return {
        "status": status,
        "paymentStatus": payment_status,
        "paymentMethod": label,
        "amountPaid": round(new_amount_paid, 2),
        "balanceDue": round(new_balance, 2),
        "paymentPlan": payment_plan,
        "boardingPassIssued": new_balance <= 0,
        "notes": notes,
        "cashChannel": channel.value,
        "lastCashReceipt": receipt_number,
        "lastCashAmount": round(amount_paid_now, 2),
    }


def record_cash_audit(
    *,
    booking_id: str,
    amount_eur: float,
    channel: CashPaymentChannel,
    actor_id: str | None = None,
    reference: str | None = None,
    detail: str | None = None,
    receipt_number: str | None = None,
) -> dict[str, Any] | None:
    settings = read_payment_settings()
    security = settings.get("security") or {}
    if not security.get("audit_payment_actions", True):
        return None
    return append_payment_audit(
        action="cash_payment_recorded",
        booking_id=booking_id,
        amount_eur=amount_eur,
        reference=reference or receipt_number,
        actor_id=actor_id,
        detail=detail or channel.value,
        metadata={"channel": channel.value, "receipt_number": receipt_number},
    )
