"""Email/SMS/WhatsApp dispatch — log file always; Twilio when configured."""

from __future__ import annotations

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any
from pathlib import Path

import httpx

from travel_platform.settings.platform_store import get_platform_config

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
NOTIFICATION_LOG = DATA_DIR / "notifications.log"


def _append_log(line: str) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    NOTIFICATION_LOG.write_text(
        (NOTIFICATION_LOG.read_text(encoding="utf-8") if NOTIFICATION_LOG.exists() else "")
        + line
        + "\n",
        encoding="utf-8",
    )


async def send_email(to: str, subject: str, body_html: str) -> str:
    cfg = get_platform_config()
    from_addr = cfg.smtp_from_email or "noreply@aerostride.app"
    ts = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
    _append_log(f"[{ts}] EMAIL to={to} from={from_addr} subject={subject}")

    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    if not host:
        logger.info("SMTP not configured — email logged only to %s", NOTIFICATION_LOG)
        return f"email-log-{to}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    with smtplib.SMTP(host, port, timeout=15) as smtp:
        if use_tls:
            smtp.starttls()
        if user and password:
            smtp.login(user, password)
        smtp.sendmail(from_addr, [to], msg.as_string())

    return f"email-smtp-{to}"


def _twilio_creds() -> dict[str, str] | None:
    from core.config import get_platform_settings

    s = get_platform_settings()
    sid = (s.twilio_account_sid or os.getenv("TWILIO_ACCOUNT_SID", "")).strip()
    token = (s.twilio_auth_token or os.getenv("TWILIO_AUTH_TOKEN", "")).strip()
    from_number = (s.twilio_from_number or os.getenv("TWILIO_FROM_NUMBER", "")).strip()
    if sid and token and from_number:
        return {"sid": sid, "token": token, "from": from_number}
    return None


async def send_sms(to: str, body: str) -> str:
    ts = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
    cfg = get_platform_config()
    sender = cfg.sms_sender_id or "AEROSTRIDE"
    _append_log(f"[{ts}] SMS from={sender} to={to} body={body[:160]}")

    creds = _twilio_creds()
    if not creds:
        logger.info("SMS stub to=%s (set TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER)", to)
        return f"sms-log-{to}"

    url = f"https://api.twilio.com/2010-04-01/Accounts/{creds['sid']}/Messages.json"
    data = {"To": to, "From": creds["from"], "Body": body}
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, data=data, auth=(creds["sid"], creds["token"]))
        resp.raise_for_status()
        payload = resp.json()
    sid = payload.get("sid") or "ok"
    _append_log(f"[{ts}] SMS-TWILIO to={to} sid={sid}")
    return f"sms-twilio-{sid}"


async def send_whatsapp(to: str, body: str) -> str:
    """WhatsApp via Twilio WhatsApp sender (whatsapp:+E164)."""
    from core.config import get_platform_settings

    ts = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
    _append_log(f"[{ts}] WHATSAPP to={to} body={body[:160]}")

    creds = _twilio_creds()
    s = get_platform_settings()
    wa_from = (
        s.twilio_whatsapp_from or os.getenv("TWILIO_WHATSAPP_FROM", "")
    ).strip() or (f"whatsapp:{creds['from']}" if creds else "")
    if not creds or not wa_from:
        logger.info("WhatsApp stub to=%s (set TWILIO_* + TWILIO_WHATSAPP_FROM)", to)
        return f"whatsapp-log-{to}"

    to_addr = to if to.startswith("whatsapp:") else f"whatsapp:{to}"
    url = f"https://api.twilio.com/2010-04-01/Accounts/{creds['sid']}/Messages.json"
    data = {"To": to_addr, "From": wa_from, "Body": body}
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, data=data, auth=(creds["sid"], creds["token"]))
        resp.raise_for_status()
        payload = resp.json()
    sid = payload.get("sid") or "ok"
    _append_log(f"[{ts}] WHATSAPP-TWILIO to={to} sid={sid}")
    return f"whatsapp-twilio-{sid}"


async def dispatch_delay_alerts(
    *,
    recipients: list[dict[str, Any]],
    flight_number: str,
    delay_minutes: int,
    channels: list[str],
    trip_title: str | None = None,
    pickup_time: str | None = None,
    template_id: str = "flight_delay_pickup",
) -> dict[str, Any]:
    """
    Send delay alerts to recipients with phone/email.
    Uses WhatsApp-style templates when template_id is provided.
    recipient: {phone?, email?, name?}
    """
    templates = {
        "flight_delay_pickup": (
            "PoreiaGo: Η πτήση {flight_number} έχει καθυστέρηση +{delay_minutes}′. "
            "Νέα ώρα pickup: {pickup_time}. {trip_title}"
        ),
        "connection_risk": (
            "PoreiaGo: Στενή σύνδεση στην εκδρομή {trip_title}. "
            "Παρακαλούμε είστε έγκαιρα στο σημείο συνάντησης."
        ),
    }
    tpl = templates.get(template_id) or templates["flight_delay_pickup"]
    message = tpl.format(
        flight_number=flight_number or "—",
        delay_minutes=delay_minutes or 0,
        pickup_time=pickup_time or "—",
        trip_title=trip_title or "Εκδρομή",
    )
    results: list[dict[str, Any]] = []
    for r in recipients or []:
        phone = str(r.get("phone") or "").strip()
        email = str(r.get("email") or "").strip()
        name = str(r.get("name") or "").strip()
        entry: dict[str, Any] = {"name": name, "channels": {}}
        if "sms" in channels and phone:
            try:
                entry["channels"]["sms"] = await send_sms(phone, message)
            except Exception as exc:  # noqa: BLE001
                entry["channels"]["sms"] = f"error:{exc}"
        if "whatsapp" in channels and phone:
            try:
                entry["channels"]["whatsapp"] = await send_whatsapp(phone, message)
            except Exception as exc:  # noqa: BLE001
                entry["channels"]["whatsapp"] = f"error:{exc}"
        if "email" in channels and email:
            try:
                entry["channels"]["email"] = await send_email(
                    email,
                    f"Καθυστέρηση πτήσης {flight_number}",
                    f"<p>{message}</p>",
                )
            except Exception as exc:  # noqa: BLE001
                entry["channels"]["email"] = f"error:{exc}"
        results.append(entry)
    return {"sent": len(results), "results": results, "message": message}
