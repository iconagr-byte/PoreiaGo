"""SMS + ERP webhook notifications when a fiscal receipt MARK is issued."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

FISCAL_WEBHOOK_EVENT = "fiscal.receipt_issued"


def _read_fiscal_notification_settings() -> dict[str, bool]:
    try:
        from travel_platform.settings.payment_settings_store import read_payment_settings

        security = read_payment_settings().get("security") or {}
    except Exception:
        security = {}
    return {
        "notify_customer": security.get("notify_customer_on_payment", True) is not False,
        "notify_sms": security.get("notify_sms_on_fiscal_receipt", True) is not False,
        "notify_push": security.get("notify_push_on_fiscal_receipt", True) is not False,
        "notify_webhook": security.get("notify_erp_on_fiscal_receipt", True) is not False,
    }


def _sms_enabled() -> bool:
    from ticketing.config import settings

    return bool(settings.sms_enabled)


def normalize_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if len(digits) < 10:
        return None
    if digits.startswith("30") and len(digits) >= 12:
        return f"+{digits}"
    if digits.startswith("0"):
        return f"+30{digits[1:]}"
    if str(phone).strip().startswith("+"):
        return f"+{digits}"
    return f"+30{digits}"


def build_fiscal_sms_message(
    booking: dict[str, Any],
    *,
    mark: str,
    amount: float,
    invoice_kind_label: str,
) -> str:
    trip = booking.get("tripTitle") or "κράτησή σας"
    pnr = booking.get("pnr") or booking.get("id") or "—"
    return (
        f"AeroStride: Εκδόθηκε {invoice_kind_label} για {trip}. "
        f"MARK {mark}. Ποσό €{float(amount):.2f}. PNR {pnr}"
    )


def build_fiscal_webhook_payload(
    booking: dict[str, Any],
    *,
    tenant_id: str,
    invoice_id: str,
    mark: str,
    amount: float,
    invoice_kind: str,
    provider: str | None,
) -> dict[str, Any]:
    return {
        "booking_id": booking.get("id"),
        "saas_booking_id": booking.get("saasBookingId"),
        "pnr": booking.get("pnr"),
        "customer_name": booking.get("customerName"),
        "customer_email": booking.get("email"),
        "customer_phone": booking.get("phone"),
        "trip_title": booking.get("tripTitle"),
        "invoice_id": invoice_id,
        "invoice_kind": invoice_kind,
        "amount_eur": float(amount),
        "mark": mark,
        "provider": provider,
        "issued_at": datetime.now(timezone.utc).isoformat(),
        "tenant_id": tenant_id,
    }


async def notify_fiscal_receipt_sms(
    booking: dict[str, Any],
    *,
    mark: str,
    amount: float,
    invoice_kind_label: str,
) -> dict[str, Any] | None:
    cfg = _read_fiscal_notification_settings()
    if not cfg["notify_customer"] or not cfg["notify_sms"] or not _sms_enabled():
        return {"skipped": True, "reason": "disabled"}

    phone = normalize_phone(booking.get("phone"))
    if not phone:
        return {"skipped": True, "reason": "no_phone"}

    from travel_platform.notifications.dispatcher import send_sms

    body = build_fiscal_sms_message(
        booking,
        mark=mark,
        amount=amount,
        invoice_kind_label=invoice_kind_label,
    )
    try:
        ref = await send_sms(phone, body)
        return {"phone": phone, "reference": ref}
    except Exception as exc:
        logger.warning("Fiscal receipt SMS failed booking=%s: %s", booking.get("id"), exc)
        return {"error": str(exc)}


async def notify_fiscal_receipt_push(
    booking: dict[str, Any],
    *,
    mark: str,
    amount: float,
    invoice_kind_label: str,
    invoice_id: str,
) -> dict[str, Any] | None:
    cfg = _read_fiscal_notification_settings()
    if not cfg["notify_customer"] or not cfg["notify_push"]:
        return {"skipped": True, "reason": "disabled"}

    email = str(booking.get("email") or "").strip().lower()
    if not email or "@" not in email:
        return {"skipped": True, "reason": "no_email"}

    from travel_platform.notifications.web_push_service import (
        build_fiscal_receipt_push_payload,
        send_push_to_email,
    )

    payload = build_fiscal_receipt_push_payload(
        booking,
        mark=mark,
        amount=amount,
        invoice_kind_label=invoice_kind_label,
        invoice_id=invoice_id,
    )
    try:
        return await send_push_to_email(email, payload)
    except Exception as exc:
        logger.warning("Fiscal receipt push failed booking=%s: %s", booking.get("id"), exc)
        return {"error": str(exc)}


def dispatch_fiscal_receipt_webhook(tenant_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    cfg = _read_fiscal_notification_settings()
    if not cfg["notify_webhook"]:
        return {"skipped": True, "reason": "disabled"}

    try:
        from app.services.payment_dispatch import dispatch_partner_webhook

        dispatch_partner_webhook(tenant_id, FISCAL_WEBHOOK_EVENT, payload)
        return {"queued": True, "event": FISCAL_WEBHOOK_EVENT}
    except Exception as exc:
        logger.warning("Fiscal webhook dispatch failed tenant=%s: %s", tenant_id, exc)
        return {"error": str(exc)}
