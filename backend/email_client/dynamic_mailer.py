"""Δυναμική σύνδεση IMAP/SMTP από EmailSettings ID."""

from __future__ import annotations

import imaplib
import logging
import smtplib
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from .attachment_utils import normalize_attachments
from .settings_store import get_settings

logger = logging.getLogger(__name__)


def settings_to_imap_config(account: dict) -> dict[str, Any]:
    return {
        "host": (account.get("imap_host") or "").strip(),
        "port": int(account.get("imap_port") or 993),
        "user": (account.get("mail_username") or account.get("email_address") or "").strip(),
        "password": account.get("mail_password") or "",
        "use_ssl": bool(account.get("imap_secure", True)),
        "store_email": (account.get("email_address") or "").strip().lower(),
        "imap_mailbox": account.get("imap_mailbox") or "INBOX",
        "imap_folder_sent": account.get("imap_folder_sent") or "Sent",
        "imap_folder_spam": account.get("imap_folder_spam") or "Spam",
    }


def settings_to_smtp_config(account: dict) -> dict[str, Any]:
    return {
        "host": (account.get("smtp_host") or "").strip(),
        "port": int(account.get("smtp_port") or 587),
        "user": (account.get("mail_username") or account.get("email_address") or "").strip(),
        "password": account.get("mail_password") or "",
        "use_tls": bool(account.get("smtp_secure", True)),
        "from_addr": (account.get("email_address") or "").strip(),
    }


def _connect_imap(cfg: dict) -> imaplib.IMAP4 | imaplib.IMAP4_SSL:
    if cfg["use_ssl"]:
        client = imaplib.IMAP4_SSL(cfg["host"], cfg["port"])
    else:
        client = imaplib.IMAP4(cfg["host"], cfg["port"])
    client.login(cfg["user"], cfg["password"])
    return client


def test_imap_connection(account: dict) -> dict:
    cfg = settings_to_imap_config(account)
    if not cfg["host"] or not cfg["user"]:
        return {"ok": False, "error": "Συμπληρώστε IMAP host και username"}
    try:
        client = _connect_imap(cfg)
        client.select(cfg.get("imap_mailbox", "INBOX"), readonly=True)
        client.logout()
        return {"ok": True, "message": "IMAP σύνδεση επιτυχής"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def test_smtp_connection(account: dict) -> dict:
    cfg = settings_to_smtp_config(account)
    if not cfg["host"] or not cfg["user"]:
        return {"ok": False, "error": "Συμπληρώστε SMTP host και username"}
    try:
        with smtplib.SMTP(cfg["host"], cfg["port"], timeout=15) as smtp:
            if cfg["use_tls"]:
                smtp.starttls()
            if cfg["password"]:
                smtp.login(cfg["user"], cfg["password"])
        return {"ok": True, "message": "SMTP σύνδεση επιτυχής"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def test_account_connection(account: dict) -> dict:
    imap = test_imap_connection(account)
    smtp = test_smtp_connection(account)
    return {
        "ok": imap.get("ok") and smtp.get("ok"),
        "imap": imap,
        "smtp": smtp,
    }


async def load_account(settings_id: str) -> dict:
    account = await get_settings(settings_id, with_password=True)
    if not account:
        raise ValueError("Ο λογαριασμός email δεν βρέθηκε")
    return account


def _apply_headers(
    msg: MIMEMultipart,
    *,
    subject: str,
    from_addr: str,
    to: str,
    cc: str,
    priority: str,
    request_read_receipt: bool,
) -> None:
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    if cc.strip():
        msg["Cc"] = cc.strip()
    if priority == "high":
        msg["X-Priority"] = "1"
        msg["Importance"] = "high"
    elif priority == "low":
        msg["X-Priority"] = "5"
        msg["Importance"] = "low"
    if request_read_receipt:
        msg["Disposition-Notification-To"] = from_addr


def _build_message(
    *,
    subject: str,
    from_addr: str,
    to: str,
    body_html: str,
    cc: str = "",
    priority: str = "normal",
    request_read_receipt: bool = False,
    attachments: list[dict] | None = None,
) -> MIMEMultipart:
    files = normalize_attachments(attachments)
    if files:
        root = MIMEMultipart("mixed")
        _apply_headers(
            root,
            subject=subject,
            from_addr=from_addr,
            to=to,
            cc=cc,
            priority=priority,
            request_read_receipt=request_read_receipt,
        )
        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(body_html, "html", "utf-8"))
        root.attach(alt)
        for att in files:
            main, sub = (att["content_type"].split("/", 1) + ["octet-stream"])[:2]
            part = MIMEBase(main, sub)
            part.set_payload(att["data"])
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                "attachment",
                filename=att["filename"],
            )
            root.attach(part)
        return root

    msg = MIMEMultipart("alternative")
    _apply_headers(
        msg,
        subject=subject,
        from_addr=from_addr,
        to=to,
        cc=cc,
        priority=priority,
        request_read_receipt=request_read_receipt,
    )
    msg.attach(MIMEText(body_html, "html", "utf-8"))
    return msg


def send_email_smtp(
    account: dict,
    *,
    to: str,
    subject: str,
    body_html: str,
    cc: str = "",
    bcc: str = "",
    priority: str = "normal",
    request_read_receipt: bool = False,
    attachments: list[dict] | None = None,
) -> str:
    cfg = settings_to_smtp_config(account)
    if not cfg["host"]:
        raise ValueError("SMTP host δεν έχει ρυθμιστεί για αυτόν τον λογαριασμό")

    from_addr = cfg["from_addr"] or cfg["user"]
    msg = _build_message(
        subject=subject,
        from_addr=from_addr,
        to=to,
        body_html=body_html,
        cc=cc,
        priority=priority,
        request_read_receipt=request_read_receipt,
        attachments=attachments,
    )

    recipients = [a.strip() for a in to.split(",") if a.strip() and "@" in a]
    if cc.strip():
        recipients.extend(a.strip() for a in cc.split(",") if a.strip() and "@" in a)
    if bcc.strip():
        recipients.extend(a.strip() for a in bcc.split(",") if a.strip() and "@" in a)
    if not recipients:
        raise ValueError("Δεν βρέθηκε έγκυρος παραλήπτης")

    with smtplib.SMTP(cfg["host"], cfg["port"], timeout=20) as smtp:
        if cfg["use_tls"]:
            smtp.starttls()
        if cfg["user"] and cfg["password"]:
            smtp.login(cfg["user"], cfg["password"])
        smtp.sendmail(from_addr, recipients, msg.as_string())

    return f"email-smtp-{to}"
