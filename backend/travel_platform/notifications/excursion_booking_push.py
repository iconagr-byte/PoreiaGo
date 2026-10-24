"""Web Push + telemetry alert when a customer books an excursion (Wallet / B2C)."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def _clip(text: str, limit: int = 140) -> str:
    clean = " ".join(str(text or "").split())
    if len(clean) <= limit:
        return clean
    return clean[: max(0, limit - 1)].rstrip() + "…"


def _admin_email(tenant_id: str | None = None) -> str:
    try:
        from travel_platform.settings.payment_settings_store import read_payment_settings

        security = read_payment_settings(tenant_id).get("security") or {}
        email = str(security.get("admin_notification_email") or "").strip().lower()
        if email and "@" in email:
            return email
    except Exception:
        pass
    return ""


def _money(value: Any) -> str:
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return ""
    if amount <= 0:
        return ""
    return f"€{amount:.2f}"


async def notify_excursion_booking_to_office(booking: dict[str, Any]) -> dict[str, Any]:
    """Fan-out admin bell (telemetry WS) + Web Push for a new paid excursion booking."""
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
    from travel_platform.telemetry.alerts import TelemetryAlertBus

    booking_id = str(booking.get("id") or booking.get("pnr") or "")
    ref = str(booking.get("pnr") or booking.get("reference_code") or booking_id or "—")
    meta_json = booking.get("metadata_json") if isinstance(booking.get("metadata_json"), dict) else {}
    trip_title = str(
        booking.get("tripTitle")
        or booking.get("trip_title")
        or meta_json.get("trip_title")
        or "Εκδρομή"
    )
    seats = booking.get("seats") or booking.get("seat_label") or booking.get("seatLabel") or "—"
    if isinstance(seats, (list, tuple)):
        seats = ", ".join(str(s) for s in seats if s) or "—"
    customer = str(
        booking.get("customerName")
        or booking.get("passenger_name")
        or booking.get("name")
        or "Πελάτης"
    )
    tenant_id = str(booking.get("tenant_id") or booking.get("tenantId") or "").strip()
    paid = (
        booking.get("amountPaid")
        if booking.get("amountPaid") is not None
        else booking.get("amount_paid")
        if booking.get("amount_paid") is not None
        else booking.get("price")
    )
    cost = _money(paid)
    message = _clip(
        f"{customer} · {trip_title} · θέσεις {seats}" + (f" · {cost}" if cost else "")
    )

    alert_meta = {
        "booking_id": booking_id or None,
        "reference": ref,
        "trip_title": trip_title,
        "seats": seats,
        "customer_name": customer,
        "tab": "bookings",
    }
    alert: dict[str, Any] = {}
    if tenant_id:
        try:
            alert = TelemetryAlertBus.push_generic(
                alert_type="NEW_BOOKING",
                tenant_id=tenant_id,
                message=message or f"Νέα κράτηση {ref}",
                metadata=alert_meta,
            )
        except Exception:
            logger.debug("NEW_BOOKING telemetry alert skipped", exc_info=True)

        try:
            from travel_platform.telemetry.fleet_pubsub import publish_fleet_alert

            await publish_fleet_alert(
                {
                    "id": alert.get("id"),
                    "alert_type": "NEW_BOOKING",
                    "tenant_id": tenant_id,
                    "message": message or f"Νέα κράτηση {ref}",
                    "created_at": alert.get("created_at"),
                    "severity": "info",
                    "metadata": alert_meta,
                },
            )
        except Exception:
            logger.debug("NEW_BOOKING redis publish skipped", exc_info=True)

    ensure_web_push_keys()
    if not web_push_configured():
        return {
            "skipped": True,
            "reason": "vapid_not_configured",
            "alert_id": alert.get("id"),
        }

    payload = {
        "title": f"Νέα κράτηση · {customer}",
        "body": message or f"Νέα κράτηση {ref}",
        "url": "/admin?tab=bookings",
        "tag": f"excursion-booking-{booking_id or ref or 'new'}",
        "renotify": True,
        "requireInteraction": True,
        "data": {
            "type": "new_booking",
            "tab": "bookings",
            "booking_id": booking_id or None,
            "reference": ref,
            "url": "/admin?tab=bookings",
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

    if tenant_id:
        try:
            for sub in list_subscriptions_for_tenant(tenant_id, audience="admin"):
                await _try(sub)
        except Exception:
            pass

    for sub in list_all_subscriptions(audience="admin"):
        await _try(sub)

    admin_email = _admin_email(tenant_id or None)
    if admin_email:
        for sub in list_subscriptions_for_email(admin_email, audience="admin"):
            await _try(sub)
        if sent == 0:
            email_result = await send_push_to_email(admin_email, payload)
            if email_result.get("sent"):
                sent += int(email_result.get("sent") or 0)
            attempted += int(email_result.get("attempted") or 0)

    if attempted == 0:
        logger.warning(
            "excursion-booking push: no admin subscriptions booking=%s tenant=%s",
            booking_id or ref,
            tenant_id or "-",
        )
        return {
            "skipped": True,
            "reason": "no_admin_subscriptions",
            "attempted": 0,
            "sent": 0,
            "alert_id": alert.get("id"),
        }

    logger.info(
        "excursion-booking push booking=%s sent=%s/%s alert=%s",
        booking_id or ref,
        sent,
        attempted,
        alert.get("id"),
    )
    return {
        "ok": sent > 0,
        "attempted": attempted,
        "sent": sent,
        "title": payload["title"],
        "alert_id": alert.get("id"),
    }
