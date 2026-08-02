"""SOS & incident reporting — Redis fleet_alerts + admin WebSocket + Web Push."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from travel_platform.telemetry.alerts import TelemetryAlertBus
from travel_platform.telemetry.fleet_pubsub import publish_fleet_alert

logger = logging.getLogger(__name__)


async def publish_driver_sos(
    *,
    tenant_id: str,
    trip_id: int | None,
    driver_id: str | None,
    lat: float,
    lng: float,
    accuracy_m: float | None = None,
    message: str | None = None,
    incident_type: str = "sos",
    photo_path: str | None = None,
    driver_token: str | None = None,
    driver_name: str | None = None,
    bus_plate: str | None = None,
) -> dict[str, Any]:
    who = (driver_name or "Οδηγός").strip() or "Οδηγός"
    plate = (bus_plate or "—").strip() or "—"
    kind = "SOS" if incident_type == "sos" else str(incident_type or "incident").upper()
    alert_type = "SOS" if incident_type == "sos" else kind
    default_msg = f"Εκτάκτως {kind} από {who} ({plate})"
    msg = message or default_msg
    trip = int(trip_id) if trip_id else None

    # Local bus first (admin WS) — reuse its id for Redis so the bridge does not double-fire.
    alert = TelemetryAlertBus.push_driver_shift(
        alert_type=alert_type,
        tenant_id=str(tenant_id or ""),
        message=msg,
        metadata={
            "trip_id": trip,
            "driver_id": driver_id,
            "driver_name": who,
            "bus_plate": plate,
            "lat": lat,
            "lng": lng,
            "accuracy_m": accuracy_m,
            "photo_path": photo_path,
            "incident_type": incident_type,
        },
    )
    alert_id = str(alert.get("id") or uuid4())
    payload = {
        "id": alert_id,
        "alert_type": alert_type,
        "severity": "critical",
        "tenant_id": str(tenant_id or ""),
        "trip_id": trip,
        "driver_id": driver_id,
        "driver_name": who,
        "bus_plate": plate,
        "lat": lat,
        "lng": lng,
        "accuracy_m": accuracy_m,
        "message": msg,
        "photo_path": photo_path,
        "created_at": alert.get("created_at") or datetime.now(timezone.utc).isoformat(),
        "driver_token_hash": _hash_token(driver_token),
    }

    published_redis = await publish_fleet_alert(payload)
    push_result = await _send_sos_admin_push(payload)

    logger.info(
        "driver_sos alert_id=%s tenant=%s driver=%s redis=%s push=%s",
        alert_id,
        tenant_id,
        driver_id,
        published_redis,
        push_result,
    )

    return {
        "ok": True,
        "alert_id": alert_id,
        "message": "Κεντρικό γραφείο ειδοποιήθηκε",
        "published_redis": published_redis,
        "push": push_result,
    }


def _hash_token(token: str | None) -> str | None:
    if not token:
        return None
    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]


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


async def _send_sos_admin_push(payload: dict[str, Any]) -> dict[str, Any]:
    """Office devices must get SOS even when the live-map tab is closed."""
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

    tid = str(payload.get("tenant_id") or "").strip()
    did = str(payload.get("driver_id") or "").strip()
    alert_id = str(payload.get("id") or "")
    title = "SOS οδηγού"
    if str(payload.get("alert_type") or "").upper() != "SOS":
        title = f"{payload.get('alert_type') or 'Συμβάν'} οδηγού"

    push_payload = {
        "title": title,
        "body": payload.get("message") or "Εκτάκτως σήμα από οδηγό",
        "tag": f"driver-sos-{tid or 'x'}-{alert_id or did or 'alert'}",
        "renotify": True,
        "requireInteraction": True,
        "url": "/admin?tab=fleet_live_map",
        "data": {
            "type": "sos",
            "alert_type": payload.get("alert_type") or "SOS",
            "tenant_id": tid or None,
            "trip_id": payload.get("trip_id"),
            "driver_id": did or None,
            "lat": payload.get("lat"),
            "lng": payload.get("lng"),
            "alert_id": alert_id or None,
            "tab": "fleet_live_map",
            "url": "/admin?tab=fleet_live_map",
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
        result = await send_push_to_subscription(sub, push_payload)
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
            email_result = await send_push_to_email(admin_email, push_payload)
            if email_result.get("sent"):
                sent += int(email_result.get("sent") or 0)
            attempted += int(email_result.get("attempted") or 0)

    if sent == 0:
        for sub in list_all_subscriptions(audience="admin"):
            await _try(sub)

    if attempted == 0:
        logger.warning(
            "sos push: no admin subscriptions tenant=%s email=%s",
            tid or "(none)",
            admin_email or "(none)",
        )
        return {
            "attempted": 0,
            "sent": 0,
            "title": title,
            "reason": "no_admin_subscriptions",
        }

    return {"attempted": attempted, "sent": sent, "title": title}
