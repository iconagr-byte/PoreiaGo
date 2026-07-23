"""Ειδοποιήσεις admin — οδηγός online/offline (WS alert + Web Push)."""

from __future__ import annotations

import logging
from typing import Any

from travel_platform.telemetry.alerts import TelemetryAlertBus
from travel_platform.telemetry.driver_shift_tracker import driver_connection_key

logger = logging.getLogger(__name__)


def _shift_settings() -> dict[str, bool]:
    try:
        from travel_platform.settings.payment_settings_store import read_payment_settings

        security = read_payment_settings().get("security") or {}
    except Exception:
        security = {}
    return {
        "notify_admin": security.get("notify_admin_on_driver_shift", True) is not False,
        "notify_push": security.get("notify_push_on_driver_shift", True) is not False,
    }


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


def _session_fields(session: dict, body: dict[str, Any] | None = None) -> dict[str, Any]:
    body = body or {}
    tenant_id = str(body.get("tenant_id") or session.get("tenant_id") or "")
    driver_id = str(body.get("driver_id") or session.get("sub") or session.get("driver_id") or "driver")
    driver_name = str(body.get("driver_name") or session.get("driver_name") or "Οδηγός")
    bus_plate = str(
        body.get("bus_plate")
        or body.get("vehicle_code")
        or session.get("vehicle_code")
        or session.get("bus_plate")
        or "—",
    )
    trip_id = body.get("trip_id") or session.get("trip_id")
    return {
        "tenant_id": tenant_id,
        "driver_id": driver_id,
        "driver_name": driver_name,
        "bus_plate": bus_plate,
        "trip_id": trip_id,
        "connection_key": driver_connection_key(session),
    }


def _tenant_candidates(primary: str) -> list[str]:
    """Include platform + legacy demo tenant so admin subscriptions still match."""
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


async def notify_driver_shift(
    event: str,
    session: dict,
    *,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """event: 'online' | 'offline'"""
    if event not in ("online", "offline"):
        return {"skipped": True, "reason": "invalid_event"}

    cfg = _shift_settings()
    if not cfg["notify_admin"]:
        return {"skipped": True, "reason": "disabled"}

    meta = _session_fields(session, body)
    tenant_id = meta["tenant_id"]
    if not tenant_id:
        return {"skipped": True, "reason": "no_tenant"}

    alert_type = "DRIVER_ONLINE" if event == "online" else "DRIVER_OFFLINE"
    reason = str((body or {}).get("reason") or "")
    if event == "online":
        if reason == "shift_start":
            message = f"Ο οδηγός {meta['driver_name']} ({meta['bus_plate']}) ξεκίνησε τη βάρδια"
        else:
            message = f"Ο οδηγός {meta['driver_name']} ({meta['bus_plate']}) είναι online"
    else:
        if reason == "shift_end":
            message = f"Ο οδηγός {meta['driver_name']} ({meta['bus_plate']}) έκλεισε τη βάρδια"
        else:
            message = f"Ο οδηγός {meta['driver_name']} ({meta['bus_plate']}) είναι offline"

    alert = TelemetryAlertBus.push_driver_shift(
        alert_type=alert_type,
        tenant_id=tenant_id,
        message=message,
        metadata=meta,
    )

    # Fan-out to other API workers via Redis (same path as SOS).
    try:
        from travel_platform.telemetry.fleet_pubsub import publish_fleet_alert

        await publish_fleet_alert(
            {
                "id": alert.get("id"),
                "alert_type": alert_type,
                "tenant_id": tenant_id,
                "trip_id": meta.get("trip_id"),
                "driver_id": meta.get("driver_id"),
                "message": message,
                "created_at": alert.get("created_at"),
                "severity": "info" if event == "online" else "warning",
                **{k: v for k, v in meta.items() if k not in {"tenant_id", "trip_id", "driver_id"}},
            },
        )
    except Exception:
        logger.debug("shift fleet_alerts publish skipped", exc_info=True)

    push_result: dict[str, Any] = {"skipped": True, "reason": "push_disabled"}
    if cfg["notify_push"]:
        push_result = await _send_driver_shift_push(event=event, meta=meta, message=message)

    logger.info(
        "driver_shift notify event=%s tenant=%s push=%s",
        event,
        tenant_id,
        push_result,
    )
    return {"alert_id": alert.get("id"), "push": push_result}


async def _send_driver_shift_push(*, event: str, meta: dict[str, Any], message: str) -> dict[str, Any]:
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

    title = "Έναρξη βάρδιας" if event == "online" else "Τέλος βάρδιας"
    payload = {
        "title": title,
        "body": message,
        "tag": f"driver-shift-{meta['tenant_id']}-{meta['driver_id']}-{event}",
        "url": "/admin?tab=fleet_live_map",
        "data": {
            "type": "driver_shift",
            "event": event,
            "tenant_id": meta["tenant_id"],
            "trip_id": meta.get("trip_id"),
            "driver_id": meta.get("driver_id"),
            "tab": "fleet_live_map",
        },
        "requireInteraction": event == "online",
    }

    attempted = 0
    sent = 0
    seen_endpoints: set[str] = set()

    async def _try_sub(sub: dict[str, Any]) -> None:
        nonlocal attempted, sent
        endpoint = str(sub.get("endpoint") or "")
        if not endpoint or endpoint in seen_endpoints:
            return
        seen_endpoints.add(endpoint)
        attempted += 1
        result = await send_push_to_subscription(sub, payload)
        if result.get("sent"):
            sent += 1

    for tid in _tenant_candidates(str(meta.get("tenant_id") or "")):
        for sub in list_subscriptions_for_tenant(tid, audience="admin"):
            await _try_sub(sub)

    admin_email = _admin_email()
    if admin_email:
        for sub in list_subscriptions_for_email(admin_email):
            await _try_sub(sub)
        if sent == 0:
            email_result = await send_push_to_email(admin_email, payload)
            if email_result.get("sent"):
                sent += int(email_result.get("sent") or 0)
            attempted += int(email_result.get("attempted") or 0)

    # Last resort: any admin-audience device (covers tenant-id drift after login).
    if attempted == 0:
        for sub in list_all_subscriptions(audience="admin"):
            await _try_sub(sub)

    if attempted == 0:
        logger.warning(
            "driver_shift push: no admin subscriptions tenant=%s email=%s",
            meta.get("tenant_id"),
            admin_email or "(none)",
        )
        return {
            "attempted": 0,
            "sent": 0,
            "title": title,
            "reason": "no_admin_subscriptions",
        }

    return {"attempted": attempted, "sent": sent, "title": title}
