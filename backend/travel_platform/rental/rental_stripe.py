"""Stripe PaymentIntent helper for rental bookings (optional)."""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


def _stripe_secret() -> str:
    return (os.getenv("STRIPE_SECRET_KEY") or "").strip()


def create_rental_payment_intent(
    booking: dict[str, Any],
    tenant_id: str | None = None,
) -> dict[str, Any]:
    """Create a Stripe PaymentIntent for amount_due_now, or return demo stub."""
    from travel_platform.rental import rental_store as store

    secret = _stripe_secret()
    tid = str(tenant_id or booking.get("tenant_id") or "")
    bid = str(booking.get("id") or "")
    due = float(booking.get("amount_due_now") or booking.get("total_cost") or 0)
    amount_cents = max(0, int(round(due * 100)))

    if not secret or amount_cents <= 0:
        return {
            "demo": True,
            "client_secret": None,
            "payment_intent_id": None,
            "amount_cents": amount_cents,
            "currency": "eur",
        }

    try:
        import stripe

        stripe.api_key = secret
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="eur",
            metadata={
                "rental_booking_id": bid,
                "tenant_id": tid,
            },
            automatic_payment_methods={"enabled": True},
        )
        pi_id = getattr(intent, "id", None) or (intent.get("id") if isinstance(intent, dict) else None)
        client_secret = getattr(intent, "client_secret", None) or (
            intent.get("client_secret") if isinstance(intent, dict) else None
        )
        if pi_id and bid:
            try:
                store.patch_booking_fields(tid, bid, {"payment_intent_id": pi_id})
            except Exception:
                logger.debug("failed to store payment_intent_id", exc_info=True)
        return {
            "demo": False,
            "client_secret": client_secret,
            "payment_intent_id": pi_id,
            "amount_cents": amount_cents,
            "currency": "eur",
        }
    except Exception as exc:
        logger.warning("stripe PaymentIntent failed booking=%s: %s", bid, exc)
        return {
            "demo": True,
            "client_secret": None,
            "payment_intent_id": None,
            "amount_cents": amount_cents,
            "currency": "eur",
            "error": str(exc),
        }
