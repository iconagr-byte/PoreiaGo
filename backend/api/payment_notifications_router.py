"""Payment confirmation email notifications."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ticketing.email_spam_filter import check_email_spam_filter
from ticketing.payment_confirmation_email import (
    EVENT_BANK_CONFIRMED,
    EVENT_BANK_PENDING,
    EVENT_CASH_PAYMENT,
    EVENT_FISCAL_RECEIPT,
    EVENT_ONLINE_DEPOSIT,
    EVENT_ONLINE_FULL,
    send_payment_confirmation_notifications,
)

router = APIRouter(tags=["payment-notifications"])

ALLOWED_EVENTS = {
    EVENT_ONLINE_FULL,
    EVENT_ONLINE_DEPOSIT,
    EVENT_BANK_PENDING,
    EVENT_BANK_CONFIRMED,
    EVENT_CASH_PAYMENT,
    EVENT_FISCAL_RECEIPT,
}


class PaymentNotificationRequest(BaseModel):
    booking: dict[str, Any]
    event: str | None = Field(
        default=None,
        description="online_paid_full | online_paid_deposit | bank_pending | bank_confirmed | cash_payment | fiscal_receipt_issued",
    )


class EmailSpamCheckResponse(BaseModel):
    allowed: bool
    reason: str = ""


SPAM_REASON_LABELS = {
    "invalid_email_format": "Μη έγκυρη μορφή email",
    "missing_domain": "Λείπει domain email",
    "suspicious_local_part": "Ύποπτο email address",
    "domain_not_in_allowlist": "Το domain δεν επιτρέπεται",
    "domain_blocklisted": "Το domain είναι αποκλεισμένο",
    "disposable_email_domain": "Προσωρινά / disposable email δεν επιτρέπονται",
}


@router.get("/api/site/email-spam-check", response_model=EmailSpamCheckResponse)
async def check_email_spam(email: str = Query(..., min_length=3)):
    allowed, reason = check_email_spam_filter(email)
    return EmailSpamCheckResponse(allowed=allowed, reason=reason)


@router.post("/api/notifications/payment-confirmation")
async def notify_payment_confirmation(body: PaymentNotificationRequest):
    if body.event and body.event not in ALLOWED_EVENTS:
        raise HTTPException(status_code=400, detail="Invalid event type")
    if not body.booking.get("email"):
        raise HTTPException(status_code=400, detail="Booking email required")
    try:
        return await send_payment_confirmation_notifications(body.booking, event=body.event)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Notification failed: {exc}") from exc
