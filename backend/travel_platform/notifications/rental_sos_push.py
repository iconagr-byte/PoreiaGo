"""Web Push to office when a rental customer triggers SOS from Rent Wallet."""

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


async def notify_rental_sos_to_office(booking: dict[str, Any], sos: dict[str, Any]) -> dict[str, Any]:
    """Fan-out admin Web Push for rental customer SOS."""
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

    booking_id = str(booking.get("id") or "")
    client = str(booking.get("client_name") or "Πελάτης")
    plate = str(booking.get("vehicle_plate") or booking.get("vehicle_model") or "Όχημα")
    lat = sos.get("lat")
    lng = sos.get("lng")
    note = str(sos.get("note") or "").strip()
    coords = f"{lat},{lng}" if lat is not None and lng is not None else "—"
    body = _clip(f"SOS · {plate} · {coords}" + (f" · {note}" if note else ""))
    payload = {
        "title": f"🚨 SOS ενοικίαση · {client}",
        "body": body or f"SOS κράτηση {booking_id}",
        "url": "/admin?tab=fleet_rental",
        "tag": f"rental-sos-{booking_id or 'new'}",
        "renotify": True,
        "requireInteraction": True,
        "data": {
            "type": "rental_sos",
            "tab": "fleet_rental",
            "booking_id": booking_id or None,
            "lat": lat,
            "lng": lng,
            "url": "/admin?tab=fleet_rental",
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
        logger.warning("rental-sos push: no admin subscriptions booking=%s", booking_id)
        return {"skipped": True, "reason": "no_admin_subscriptions", "attempted": 0, "sent": 0}

    logger.info("rental-sos push booking=%s sent=%s/%s", booking_id, sent, attempted)
    return {"ok": sent > 0, "attempted": attempted, "sent": sent, "title": payload["title"]}
