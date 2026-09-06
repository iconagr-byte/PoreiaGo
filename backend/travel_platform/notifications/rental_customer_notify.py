"""Customer SMS/email for rental bookings (gated by office settings + consent)."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_NOTIFY = {
    "rent_notify_email_enabled": True,
    "rent_notify_sms_enabled": True,
    "rent_notify_email_label": "Θέλω προσφορές στο email",
    "rent_notify_sms_label": "Θέλω ενημερώσεις SMS για την κράτηση",
    "rent_notify_email_default": False,
    "rent_notify_sms_default": False,
    "rent_notify_sms_template_confirmed": (
        "Κράτηση {ref} επιβεβαιώθηκε. Παραλαβή: {pickup} · {start}. {office}"
    ),
    "rent_notify_sms_template_status": "Κράτηση {ref}: νέα κατάσταση {status}. {office}",
    "rent_notify_email_subject": "Κράτηση {ref} — επιβεβαίωση",
    "rent_notify_email_body": (
        "Γεια σου {name},<br/><br/>Η κράτησή σου <strong>{ref}</strong> επιβεβαιώθηκε."
        "<br/>Παραλαβή: {pickup}<br/>Έναρξη: {start}<br/><br/>Ευχαριστούμε,<br/>{office}"
    ),
}


def _read_office_appearance() -> dict[str, Any]:
    try:
        from api.site_appearance_router import _read_appearance

        return _read_appearance() or {}
    except Exception:
        return {}


def read_rent_notify_settings(appearance: dict[str, Any] | None = None) -> dict[str, Any]:
    src = appearance if isinstance(appearance, dict) else _read_office_appearance()
    out = {**DEFAULT_NOTIFY}
    for key, default in DEFAULT_NOTIFY.items():
        if key not in src:
            continue
        val = src.get(key)
        if isinstance(default, bool):
            out[key] = bool(val) if val is not None else default
        else:
            text = str(val or "").strip()
            out[key] = text or default
    return out


def _fmt_when(iso: str | None) -> str:
    if not iso:
        return "—"
    try:
        from datetime import datetime

        dt = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        return dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return str(iso)[:16]


def _office_name(appearance: dict[str, Any]) -> str:
    return (
        str(appearance.get("rent_office_name") or "").strip()
        or str(appearance.get("footer_brand_name") or "").strip()
        or "Γραφείο ενοικίασης"
    )


def _render(template: str, booking: dict[str, Any], appearance: dict[str, Any]) -> str:
    ref = str(booking.get("reference_code") or booking.get("id") or "")[:16]
    values = {
        "ref": ref,
        "name": str(booking.get("client_name") or "φίλε"),
        "pickup": str(booking.get("pickup_location") or "—"),
        "start": _fmt_when(booking.get("start_time")),
        "end": _fmt_when(booking.get("end_time")),
        "status": str(booking.get("rental_status") or ""),
        "plate": str(booking.get("vehicle_plate") or booking.get("vehicle_model") or ""),
        "office": _office_name(appearance),
    }
    text = str(template or "")
    for key, val in values.items():
        text = text.replace("{" + key + "}", val)
    return text


async def _ensure_email_subscriber(email: str, name: str, subscribed: bool) -> None:
    if not email or "@" not in email:
        return
    try:
        from email_client import store as email_store

        await email_store.ensure_subscriber(
            email=email,
            name=name,
            customer_id=None,
            is_subscribed=subscribed,
        )
    except Exception:
        logger.exception("rent email subscriber sync failed")


async def notify_rental_customer_on_create(booking: dict[str, Any]) -> dict[str, Any]:
    """SMS booking update + optional marketing email list + confirmation email."""
    from ticketing.fiscal_notifications import normalize_phone
    from travel_platform.notifications.dispatcher import send_email, send_sms

    appearance = _read_office_appearance()
    settings = read_rent_notify_settings(appearance)
    result: dict[str, Any] = {"sms": None, "email": None, "subscriber": None}

    marketing_email = bool(booking.get("marketing_email"))
    marketing_sms = bool(booking.get("marketing_sms"))
    email = str(booking.get("client_email") or "").strip().lower()
    phone = normalize_phone(booking.get("client_phone"))
    name = str(booking.get("client_name") or "")

    if settings["rent_notify_email_enabled"] and email:
        if marketing_email:
            await _ensure_email_subscriber(email, name, subscribed=True)
            result["subscriber"] = {"email": email, "subscribed": True}
            try:
                subject = _render(settings["rent_notify_email_subject"], booking, appearance)
                body = _render(settings["rent_notify_email_body"], booking, appearance)
                result["email"] = await send_email(email, subject, body)
            except Exception:
                logger.exception("rent confirmation email failed")
        else:
            result["subscriber"] = {"email": email, "subscribed": False}

    if settings["rent_notify_sms_enabled"] and marketing_sms and phone:
        try:
            body = _render(settings["rent_notify_sms_template_confirmed"], booking, appearance)
            result["sms"] = await send_sms(phone, body)
        except Exception:
            logger.exception("rent confirmation sms failed")

    return result


async def notify_rental_customer_status(booking: dict[str, Any]) -> dict[str, Any]:
    """SMS when booking status changes, if customer opted in and SMS channel is on."""
    from ticketing.fiscal_notifications import normalize_phone
    from travel_platform.notifications.dispatcher import send_sms

    appearance = _read_office_appearance()
    settings = read_rent_notify_settings(appearance)
    if not settings["rent_notify_sms_enabled"]:
        return {"skipped": True, "reason": "sms_disabled"}
    if not booking.get("marketing_sms"):
        return {"skipped": True, "reason": "no_consent"}
    phone = normalize_phone(booking.get("client_phone"))
    if not phone:
        return {"skipped": True, "reason": "no_phone"}
    try:
        body = _render(settings["rent_notify_sms_template_status"], booking, appearance)
        return {"sms": await send_sms(phone, body)}
    except Exception:
        logger.exception("rent status sms failed")
        return {"skipped": True, "reason": "send_failed"}
