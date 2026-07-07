"""Web Push delivery for customer notifications (VAPID)."""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def web_push_configured() -> bool:
    return bool(_vapid_private_key() and _vapid_public_key())


def _vapid_public_key() -> str:
    return os.getenv("WEB_PUSH_VAPID_PUBLIC_KEY", "").strip()


def _vapid_private_key() -> str:
    key_file = os.getenv("WEB_PUSH_VAPID_PRIVATE_KEY_FILE", "").strip()
    if key_file:
        path = Path(key_file)
        if path.is_file():
            return path.read_text(encoding="utf-8").strip()
    inline = os.getenv("WEB_PUSH_VAPID_PRIVATE_KEY", "").strip()
    if "\\n" in inline:
        return inline.replace("\\n", "\n")
    return inline


def _vapid_subject() -> str:
    subject = os.getenv("WEB_PUSH_VAPID_SUBJECT", "").strip()
    if subject:
        return subject
    reply = os.getenv("SMTP_REPLY_TO", "").strip()
    if reply and "@" in reply:
        return f"mailto:{reply}"
    return "mailto:noreply@aerostride.app"


def get_public_vapid_key() -> str | None:
    key = _vapid_public_key()
    return key or None


def build_fiscal_receipt_push_payload(
    booking: dict[str, Any],
    *,
    mark: str,
    amount: float,
    invoice_kind_label: str,
    invoice_id: str,
) -> dict[str, Any]:
    trip = booking.get("tripTitle") or "κράτησή σας"
    pnr = booking.get("pnr") or booking.get("id") or "—"
    booking_id = str(booking.get("id") or "")
    receipt_path = f"/wallet/receipt/{booking_id}" if booking_id else "/wallet"
    return {
        "title": "Εκδόθηκε φορολογική απόδειξη",
        "body": f"{invoice_kind_label} · MARK {mark} · €{float(amount):.2f} · PNR {pnr} · {trip}",
        "url": receipt_path,
        "tag": f"fiscal-{invoice_id}",
        "data": {
            "type": "fiscal_receipt_issued",
            "bookingId": booking_id,
            "mark": mark,
            "amount": float(amount),
            "invoiceKind": invoice_kind_label,
            "pnr": pnr,
        },
    }


def _send_sync(subscription: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    from pywebpush import WebPushException, webpush

    sub_info = {
        "endpoint": subscription["endpoint"],
        "keys": subscription.get("keys") or {},
    }
    body = json.dumps(payload, ensure_ascii=False)
    webpush(
        subscription_info=sub_info,
        data=body,
        vapid_private_key=_vapid_private_key(),
        vapid_claims={"sub": _vapid_subject()},
    )
    return {"sent": True, "endpoint": subscription.get("endpoint")}


async def send_push_to_subscription(subscription: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    if not web_push_configured():
        return {"skipped": True, "reason": "vapid_not_configured"}
    try:
        return await asyncio.to_thread(_send_sync, subscription, payload)
    except Exception as exc:
        from pywebpush import WebPushException

        if isinstance(exc, WebPushException):
            code = getattr(exc, "status_code", None)
            response = getattr(exc, "response", None)
            if response is not None:
                code = getattr(response, "status_code", code)
            if code in (404, 410):
                from travel_platform.notifications.push_subscription_store import delete_subscription_by_endpoint

                delete_subscription_by_endpoint(str(subscription.get("endpoint") or ""))
                return {"removed": True, "reason": "expired", "status": code}
        logger.warning("Web push failed endpoint=%s: %s", subscription.get("endpoint"), exc)
        return {"error": str(exc)[:200]}


async def send_push_to_email(email: str, payload: dict[str, Any]) -> dict[str, Any]:
    from travel_platform.notifications.push_subscription_store import list_subscriptions_for_email

    if not web_push_configured():
        return {"skipped": True, "reason": "vapid_not_configured"}

    subs = list_subscriptions_for_email(email)
    if not subs:
        return {"skipped": True, "reason": "no_subscriptions"}

    results: list[dict[str, Any]] = []
    sent = 0
    for sub in subs:
        result = await send_push_to_subscription(sub, payload)
        results.append(result)
        if result.get("sent"):
            sent += 1
    return {"email": email, "attempted": len(subs), "sent": sent, "results": results}
