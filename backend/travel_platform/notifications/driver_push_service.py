"""Web Push — πρόσκληση οδηγού για βάρδια (Master QR magic link)."""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlparse

from travel_platform.notifications.push_subscription_store import list_subscriptions_for_driver
from travel_platform.notifications.web_push_service import send_push_to_subscription, web_push_configured
from travel_platform.operations.master_qr_normalize import build_driver_auth_url, driver_app_public_base

logger = logging.getLogger(__name__)


def _relative_driver_url(auth_url: str) -> str:
    """Notification click target — path on driver app origin."""
    parsed = urlparse(auth_url)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.path}?{parsed.query}" if parsed.query else parsed.path
    return auth_url


async def send_driver_shift_invite_push(
    *,
    tenant_id: str,
    trip_id: int,
    driver_id: str | None = None,
    message: str | None = None,
    trip_title: str | None = None,
    auth_url: str | None = None,
    qr_token: str | None = None,
) -> dict[str, Any]:
    if not web_push_configured():
        return {"ok": False, "skipped": True, "reason": "vapid_not_configured"}

    if not auth_url and qr_token:
        auth_url = build_driver_auth_url(qr_token, base_url=driver_app_public_base())
    if not auth_url:
        return {"ok": False, "skipped": True, "reason": "no_auth_url"}

    click_url = _relative_driver_url(auth_url)
    title = trip_title.strip() if trip_title else f"Εκδρομή #{trip_id}"
    body = (message or "").strip() or f"{title} — πάτα για να ανοίξεις τη βάρδια"

    payload = {
        "title": "Άνοιξε βάρδια · PoreiaGo",
        "body": body,
        "url": click_url,
        "tag": f"driver-invite-{tenant_id}-{trip_id}",
        "data": {
            "type": "driver_shift_invite",
            "tenant_id": tenant_id,
            "trip_id": trip_id,
            "driver_id": driver_id,
            "auth_url": auth_url,
        },
    }

    subs = list_subscriptions_for_driver(tenant_id, driver_id)
    if not subs and driver_id:
        subs = list_subscriptions_for_driver(tenant_id, None)
    if not subs:
        return {
            "ok": False,
            "skipped": True,
            "reason": "no_driver_subscriptions",
            "auth_url": auth_url,
        }

    attempted = 0
    sent = 0
    results: list[dict[str, Any]] = []
    seen: set[str] = set()
    for sub in subs:
        endpoint = str(sub.get("endpoint") or "")
        if not endpoint or endpoint in seen:
            continue
        seen.add(endpoint)
        attempted += 1
        result = await send_push_to_subscription(sub, payload)
        results.append(result)
        if result.get("sent"):
            sent += 1

    return {
        "ok": sent > 0,
        "attempted": attempted,
        "sent": sent,
        "auth_url": auth_url,
        "results": results,
    }
