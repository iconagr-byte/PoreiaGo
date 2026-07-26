"""Web Push for office ↔ driver chat messages."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

_MAX_BODY = 140


def _clip(text: str, limit: int = _MAX_BODY) -> str:
    clean = " ".join(str(text or "").split())
    if len(clean) <= limit:
        return clean
    return clean[: max(0, limit - 1)].rstrip() + "…"


def _tenant_candidates(primary: str) -> list[str]:
    from travel_platform.operations.master_qr_local import DEFAULT_TENANT

    out: list[str] = []
    for tid in (primary, DEFAULT_TENANT):
        t = str(tid or "").strip()
        if t and t not in out:
            out.append(t)
    try:
        import os

        for key in ("SAAS_DEFAULT_TENANT_ID", "DEFAULT_TENANT_ID"):
            env = (os.getenv(key) or "").strip()
            if env and env not in out:
                out.append(env)
    except Exception:
        pass
    return out


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


async def notify_office_message_to_driver(
    *,
    tenant_id: str,
    driver_id: str,
    body: str,
    message_id: str | None = None,
    sender_name: str | None = None,
) -> dict[str, Any]:
    """Office → driver: show the chat text as a Web Push on the driver PWA."""
    from travel_platform.notifications.push_subscription_store import list_subscriptions_for_driver
    from travel_platform.notifications.web_push_service import (
        ensure_web_push_keys,
        send_push_to_subscription,
        web_push_configured,
    )

    ensure_web_push_keys()
    if not web_push_configured():
        return {"skipped": True, "reason": "vapid_not_configured"}

    tid = str(tenant_id or "").strip()
    did = str(driver_id or "").strip()
    if not tid or not did:
        return {"skipped": True, "reason": "missing_ids"}

    preview = _clip(body)
    if not preview:
        return {"skipped": True, "reason": "empty_body"}

    who = (sender_name or "Γραφείο").strip() or "Γραφείο"
    payload = {
        "title": f"Μήνυμα από {who}",
        "body": preview,
        "url": "/driver?tab=chat",
        "tag": f"driver-chat-{tid}-{did}",
        "renotify": True,
        "requireInteraction": True,
        "data": {
            "type": "driver_office_chat",
            "direction": "office_to_driver",
            "tenant_id": tid,
            "driver_id": did,
            "message_id": message_id,
            "tab": "chat",
            "url": "/driver?tab=chat",
        },
    }

    # Exact driver only — never fan-out to all drivers on the tenant.
    subs = list_subscriptions_for_driver(tid, did)
    if not subs:
        logger.info("chat push → driver: no subscriptions tenant=%s driver=%s", tid, did)
        return {"skipped": True, "reason": "no_driver_subscriptions", "attempted": 0, "sent": 0}

    attempted = 0
    sent = 0
    seen: set[str] = set()
    for sub in subs:
        endpoint = str(sub.get("endpoint") or "")
        if not endpoint or endpoint in seen:
            continue
        # Skip orphaned tenant-wide driver subs without matching driver_id.
        sub_driver = str(sub.get("driver_id") or "").strip()
        if sub_driver and sub_driver != did:
            continue
        seen.add(endpoint)
        attempted += 1
        result = await send_push_to_subscription(sub, payload)
        if result.get("sent"):
            sent += 1

    logger.info(
        "chat push → driver tenant=%s driver=%s sent=%s/%s",
        tid,
        did,
        sent,
        attempted,
    )
    return {"ok": sent > 0, "attempted": attempted, "sent": sent, "title": payload["title"]}


async def notify_driver_message_to_office(
    *,
    tenant_id: str,
    driver_id: str,
    body: str,
    message_id: str | None = None,
    sender_name: str | None = None,
) -> dict[str, Any]:
    """Driver → office: show the chat text as a Web Push on admin devices."""
    from travel_platform.notifications.push_subscription_store import (
        list_all_subscriptions,
        list_subscriptions_for_email,
        list_subscriptions_for_tenant,
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

    tid = str(tenant_id or "").strip()
    did = str(driver_id or "").strip()
    preview = _clip(body)
    if not tid or not preview:
        return {"skipped": True, "reason": "missing_ids_or_body"}

    who = (sender_name or "Οδηγός").strip() or "Οδηγός"
    payload = {
        "title": f"Μήνυμα από {who}",
        "body": preview,
        "url": f"/admin?tab=driver_chat&driverId={did}" if did else "/admin?tab=driver_chat",
        "tag": f"office-chat-{tid}-{did or 'unknown'}",
        "renotify": True,
        "requireInteraction": True,
        "data": {
            "type": "driver_office_chat",
            "direction": "driver_to_office",
            "tenant_id": tid,
            "driver_id": did or None,
            "message_id": message_id,
            "tab": "driver_chat",
            "url": f"/admin?tab=driver_chat&driverId={did}" if did else "/admin?tab=driver_chat",
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

    for candidate in _tenant_candidates(tid):
        for sub in list_subscriptions_for_tenant(candidate, audience="admin"):
            await _try(sub)

    admin_email = _admin_email()
    if admin_email:
        for sub in list_subscriptions_for_email(admin_email, audience="admin"):
            await _try(sub)
        if sent == 0:
            for sub in list_subscriptions_for_email(admin_email):
                await _try(sub)
        if sent == 0:
            email_result = await send_push_to_email(admin_email, payload)
            if email_result.get("sent"):
                sent += int(email_result.get("sent") or 0)
            attempted += int(email_result.get("attempted") or 0)

    if sent == 0:
        for sub in list_all_subscriptions(audience="admin"):
            await _try(sub)

    if attempted == 0:
        logger.warning(
            "chat push → office: no admin subscriptions tenant=%s email=%s",
            tid,
            admin_email or "(none)",
        )
        return {
            "skipped": True,
            "reason": "no_admin_subscriptions",
            "attempted": 0,
            "sent": 0,
        }

    logger.info(
        "chat push → office tenant=%s driver=%s sent=%s/%s",
        tid,
        did,
        sent,
        attempted,
    )
    return {"ok": sent > 0, "attempted": attempted, "sent": sent, "title": payload["title"]}
