"""Αποστολή email — production-ready SMTP (TLS/SSL, plain+HTML, retry)."""

from __future__ import annotations

import asyncio
import html
import logging
import os
import re
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from ticketing.email_spam_filter import apply_deliverability_headers, check_email_spam_filter

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
NOTIFICATION_LOG = DATA_DIR / "notifications.log"


def _append_log(line: str) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    prev = NOTIFICATION_LOG.read_text(encoding="utf-8") if NOTIFICATION_LOG.exists() else ""
    NOTIFICATION_LOG.write_text(prev + line + "\n", encoding="utf-8")


def _is_production() -> bool:
    env = os.getenv("APP_ENV") or os.getenv("ENVIRONMENT") or ""
    return env.strip().lower() in ("production", "prod")


def _smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST", "").strip())


def _retry_settings() -> tuple[int, float]:
    try:
        max_retries = int(os.getenv("SMTP_MAX_RETRIES", "3"))
    except ValueError:
        max_retries = 3
    max_retries = max(1, min(max_retries, 8))
    try:
        base_sec = float(os.getenv("SMTP_RETRY_BASE_SEC", "2"))
    except ValueError:
        base_sec = 2.0
    base_sec = max(0.5, min(base_sec, 30.0))
    return max_retries, base_sec


def _reply_to() -> str | None:
    addr = os.getenv("SMTP_REPLY_TO", "").strip()
    if addr and "@" in addr:
        return addr
    try:
        from travel_platform.settings.platform_store import get_platform_config

        support = str(get_platform_config().support_email or "").strip()
        if support and "@" in support:
            return support
    except Exception:
        pass
    return None


def _html_to_plain(text: str) -> str:
    stripped = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    stripped = re.sub(r"</p>", "\n\n", stripped, flags=re.I)
    stripped = re.sub(r"<[^>]+>", "", stripped)
    return html.unescape(stripped).strip()


def _build_message(to: str, subject: str, body_html: str) -> tuple[str, MIMEMultipart]:
    from_addr = os.getenv("SMTP_FROM", "noreply@aerostride.app")
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    reply = _reply_to()
    if reply:
        msg["Reply-To"] = reply
    plain = _html_to_plain(body_html)
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))
    apply_deliverability_headers(msg, from_addr=from_addr, to=to, subject=subject)
    return from_addr, msg


def _send_smtp_sync(from_addr: str, to: str, msg: MIMEMultipart) -> None:
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() == "true" or port == 465

    if use_ssl:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, timeout=20, context=context) as smtp:
            if user and password:
                smtp.login(user, password)
            smtp.sendmail(from_addr, [to], msg.as_string())
        return

    with smtplib.SMTP(host, port, timeout=20) as smtp:
        if use_tls:
            smtp.starttls(context=ssl.create_default_context())
        if user and password:
            smtp.login(user, password)
        smtp.sendmail(from_addr, [to], msg.as_string())


def _should_fail_hard() -> bool:
    return _is_production() and os.getenv("SMTP_FAIL_HARD", "").lower() in ("1", "true", "yes")


async def send_email(to: str, subject: str, body_html: str, *, skip_queue: bool = False) -> str:
    from_addr = os.getenv("SMTP_FROM", "noreply@aerostride.app")
    ts = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()

    allowed, block_reason = check_email_spam_filter(to)
    if not allowed:
        _append_log(f"[{ts}] SPAM_BLOCKED to={to} reason={block_reason} subject={subject}")
        logger.info("Email blocked by spam filter to=%s reason=%s", to, block_reason)
        return f"email-spam-blocked-{to}"

    _append_log(f"[{ts}] EMAIL to={to} from={from_addr} subject={subject}")

    if not _smtp_configured():
        msg = "SMTP not configured — email logged only"
        if _is_production():
            logger.error("%s (set SMTP_HOST, SMTP_USER, SMTP_PASSWORD for production)", msg)
        else:
            logger.info("%s → %s", msg, NOTIFICATION_LOG)
        return f"email-log-{to}"

    from_addr, mime = _build_message(to, subject, body_html)
    max_retries, base_sec = _retry_settings()
    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            await asyncio.to_thread(_send_smtp_sync, from_addr, to, mime)
            if attempt > 1:
                logger.info("SMTP sent to=%s after %s attempts", to, attempt)
            return f"email-smtp-{to}"
        except Exception as exc:
            last_error = exc
            logger.warning(
                "SMTP attempt %s/%s failed to=%s: %s",
                attempt,
                max_retries,
                to,
                exc,
            )
            if attempt < max_retries:
                delay = base_sec * (2 ** (attempt - 1))
                await asyncio.sleep(delay)

    assert last_error is not None
    logger.exception("SMTP send failed to=%s after %s attempts", to, max_retries)
    _append_log(f"[{ts}] SMTP_ERROR to={to} attempts={max_retries} error={last_error}")

    if not skip_queue:
        from ticketing.email_retry_queue import enqueue_failed_email

        queued = enqueue_failed_email(
            to=to,
            subject=subject,
            body_html=body_html,
            error=str(last_error),
            attempts=max_retries,
        )
        _append_log(f"[{ts}] SMTP_QUEUED id={queued['id']} to={to}")

    if _should_fail_hard():
        raise last_error
    return f"email-queued-{queued['id']}" if not skip_queue else f"email-error-{to}"


async def process_email_retry_queue(*, limit: int = 20) -> dict[str, int]:
    """Retry queued emails (admin/cron). Returns counts."""
    from ticketing.email_retry_queue import increment_queue_attempt, list_queued_emails, remove_from_queue

    if not _smtp_configured():
        return {"processed": 0, "sent": 0, "failed": 0, "skipped": 0}

    rows = list_queued_emails(limit=limit)
    sent = failed = 0
    for row in rows:
        entry_id = row.get("id")
        to = str(row.get("to") or "")
        subject = str(row.get("subject") or "")
        body_html = str(row.get("body_html") or "")
        if not entry_id or not to or not subject:
            remove_from_queue(str(entry_id))
            continue
        try:
            ref = await send_email(to, subject, body_html, skip_queue=True)
            if ref.startswith("email-smtp-"):
                remove_from_queue(entry_id)
                sent += 1
            else:
                increment_queue_attempt(entry_id, f"still pending: {ref}")
                failed += 1
        except Exception as exc:
            increment_queue_attempt(entry_id, str(exc))
            failed += 1

    return {"processed": len(rows), "sent": sent, "failed": failed, "skipped": 0}
