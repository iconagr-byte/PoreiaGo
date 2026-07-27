"""Stripe checkout webhooks — ticket partial payments (PaymentIntent)."""

from __future__ import annotations

import logging

import stripe
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.services.booking_payment_service import BookingPaymentService
from app.services.payment_dispatch import dispatch_fiscal_receipt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["SaaS Payments"])


def _verify_stripe_event(payload: bytes, signature: str) -> dict:
    settings = get_settings()
    secret = settings.stripe_checkout_webhook_secret or settings.stripe_webhook_secret
    if not secret:
        raise ValueError("STRIPE_CHECKOUT_WEBHOOK_SECRET is not configured")
    stripe.api_key = settings.stripe_secret_key
    return stripe.Webhook.construct_event(payload, signature, secret)


@router.post("/webhook")
async def stripe_checkout_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Stripe webhook for B2C ticket payments.

    payment_intent.succeeded:
      1. ACID capture on Booking (partial vs final settlement via amount_paid)
      2. Create FiscalInvoice for the charged amount
      3. Return 200 immediately; process_fiscal_receipt runs in BackgroundTasks/Celery
    """
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    if not sig:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Missing stripe-signature")

    try:
        event = _verify_stripe_event(payload, sig)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid signature") from exc

    if event["type"] != "payment_intent.succeeded":
        return {"received": True, "handled": False, "type": event["type"]}

    payment_intent = event["data"]["object"]
    fiscal_invoice_id: str | None = None
    meta = payment_intent.get("metadata") or {}
    rental_booking_id = str(meta.get("rental_booking_id") or "").strip()

    # Rental JSON bookings: patch payment from PI when metadata has rental_booking_id.
    if rental_booking_id and meta.get("purpose") != "damage_deposit":
        try:
            from travel_platform.rental import rental_store as rental_store

            tid = str(meta.get("tenant_id") or "").strip() or None
            rental_store.confirm_payment_from_intent(tid, rental_booking_id)
            return {
                "received": True,
                "handled": True,
                "status": "rental_payment_confirmed",
                "rental_booking_id": rental_booking_id,
            }
        except Exception:
            logger.debug("rental webhook confirm skipped", exc_info=True)

    if rental_booking_id and meta.get("purpose") == "damage_deposit":
        try:
            from travel_platform.rental import rental_store as rental_store

            tid = str(meta.get("tenant_id") or "").strip() or None
            rental_store.set_damage_deposit_status(tid, rental_booking_id, action="hold")
            return {
                "received": True,
                "handled": True,
                "status": "rental_damage_deposit_held",
                "rental_booking_id": rental_booking_id,
            }
        except Exception:
            logger.debug("rental damage deposit webhook skipped", exc_info=True)

    async with AsyncSessionLocal() as db:
        try:
            result = await BookingPaymentService(db).handle_payment_intent_succeeded(payment_intent)
            await db.commit()
            if result.fiscal_invoice_id:
                fiscal_invoice_id = str(result.fiscal_invoice_id)
        except Exception as exc:
            await db.rollback()
            logger.exception("payment_intent.succeeded processing failed pi=%s", payment_intent.get("id"))
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Payment capture failed") from exc

    if fiscal_invoice_id:
        background_tasks.add_task(dispatch_fiscal_receipt, fiscal_invoice_id)

    return {
        "received": True,
        "handled": True,
        "status": result.status,
        "booking_id": str(result.booking_id) if result.booking_id else None,
        "fiscal_invoice_id": fiscal_invoice_id,
    }
