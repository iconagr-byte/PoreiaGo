"""Email/SMS dispatch — log file always; optional SMTP when configured."""

from __future__ import annotations

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

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


async def send_sms(to: str, body: str) -> str:
    ts = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
    cfg = get_platform_config()
    sender = cfg.sms_sender_id or "AEROSTRIDE"
    _append_log(f"[{ts}] SMS from={sender} to={to} body={body[:160]}")
    logger.info("SMS stub to=%s (wire Twilio via SMS_PROVIDER)", to)
    return f"sms-log-{to}"
