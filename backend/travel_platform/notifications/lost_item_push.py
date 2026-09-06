"""Web Push to office when a passenger reports a lost item."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def _clip(text: str, limit: int = 140) -> str:
    clean = " ".join(str(text or "").split())
    if len(clean) <= limit:
        return clean
    return clean[: max(0, limit - 1)].rstrip() + "…"


def _admin_email() -> str:
    try:
        from travel_platform.settings.payment_settings_store import read_payment_settings

        security = read_payment_settings().get("security") or {}
        email = str(security.get("admin_notification_email") or "").strip().lower()
        if email and "@" in email:
            return email
    except Exception:
        pass
    return ""


async def notify_lost_item_to_office(item: dict[str, Any]) -> dict[str, Any]:
    """Fan-out admin Web Push for a new Lost & Found report."""
    from travel_platform.notifications.push_subscription_store import (
        list_all_subscriptions,
        list_subscriptions_for_email,
    )
    from travel_platform.notifications.web_push_service import (
        ensure_web_push_keys,
        send_push_to_email,
        send_push_to_subscription,
        web_push_configured,
    )

    ensure_web_push_keys()
    if not web_push_configured():
        return {"skipped": True, "reason": "vapid_not_configured"}

    item_id = str(item.get("id") or "")
    category = str(item.get("itemCategory") or item.get("item_category") or "Αντικείμενο")
    location = str(item.get("lastSeenLocation") or item.get("last_seen_location") or "—")
    description = str(item.get("description") or "")
    customer = str(item.get("customerName") or item.get("customer_name") or "Πελάτης")

    body = _clip(f"{category} · {location} — {description}")
    payload = {
        "title": f"Απωλεσθέντα · {customer}",
        "body": body or f"Νέα δήλωση {item_id}",
        "url": "/admin?tab=lost_found",
        "tag": f"lost-item-{item_id or 'new'}",
        "renotify": True,
        "requireInteraction": True,
        "data": {
            "type": "lost_item_report",
            "tab": "lost_found",
            "item_id": item_id or None,
            "url": "/admin?tab=lost_found",
        },
    }

    attempted = 0
    sent = 0
    seen: set[str] = set()

    async def _try(sub: dict[str, Any]) -> None:
        nonlocal attempted, sent
        endpoint = str(sub.get("endpoint") or "")
        if not endpoint or endpoint in seen:
            return
        seen.add(endpoint)
        attempted += 1
        result = await send_push_to_subscription(sub, payload)
        if result.get("sent"):
            sent += 1

    # SQLite lost-items are not tenant-keyed — notify every admin device.
    for sub in list_all_subscriptions(audience="admin"):
        await _try(sub)

    admin_email = _admin_email()
    if admin_email:
        for sub in list_subscriptions_for_email(admin_email, audience="admin"):
            await _try(sub)
        if sent == 0:
            email_result = await send_push_to_email(admin_email, payload)
            if email_result.get("sent"):
                sent += int(email_result.get("sent") or 0)
            attempted += int(email_result.get("attempted") or 0)

    if attempted == 0:
        logger.warning("lost-item push: no admin subscriptions item=%s", item_id)
        return {"skipped": True, "reason": "no_admin_subscriptions", "attempted": 0, "sent": 0}

    logger.info("lost-item push item=%s sent=%s/%s", item_id, sent, attempted)
    return {"ok": sent > 0, "attempted": attempted, "sent": sent, "title": payload["title"]}
