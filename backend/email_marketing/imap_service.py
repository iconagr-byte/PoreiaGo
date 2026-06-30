"""IMAP — λήψη εισερχόμενων email και ενεργοποίηση Auto-Responder."""

from __future__ import annotations

import email
import imaplib
import logging
import os
from email.header import decode_header
from typing import Any

from .auto_responder import process_inbound_message

logger = logging.getLogger(__name__)


def _imap_config() -> dict[str, Any]:
    return {
        "host": os.getenv("IMAP_HOST", "").strip(),
        "port": int(os.getenv("IMAP_PORT", "993")),
        "user": os.getenv("IMAP_USER", "").strip(),
        "password": os.getenv("IMAP_PASSWORD", "").strip(),
        "mailbox": os.getenv("IMAP_MAILBOX", "INBOX"),
        "use_ssl": os.getenv("IMAP_USE_SSL", "true").lower() == "true",
    }


def _decode_header_value(raw: str | bytes | None) -> str:
    if raw is None:
        return ""
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="replace")
    parts = decode_header(raw)
    out = []
    for chunk, enc in parts:
        if isinstance(chunk, bytes):
            out.append(chunk.decode(enc or "utf-8", errors="replace"))
        else:
            out.append(str(chunk))
    return "".join(out)


def _extract_body(msg: email.message.Message) -> str:
    text_parts: list[str] = []
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            disp = str(part.get("Content-Disposition", ""))
            if "attachment" in disp.lower():
                continue
            if ctype in ("text/plain", "text/html"):
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    text_parts.append(payload.decode(charset, errors="replace"))
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            text_parts.append(payload.decode(charset, errors="replace"))
    return "\n".join(text_parts)[:8000]


def _connect_imap(cfg: dict) -> imaplib.IMAP4 | imaplib.IMAP4_SSL:
    if cfg["use_ssl"]:
        client = imaplib.IMAP4_SSL(cfg["host"], cfg["port"])
    else:
        client = imaplib.IMAP4(cfg["host"], cfg["port"])
    client.login(cfg["user"], cfg["password"])
    return client


def fetch_unseen_messages() -> list[dict]:
    """
    Συγχρονική λήψη UNSEEN messages από IMAP.
    Επιστρέφει [{message_id, from_addr, subject, body, sender_name}, ...]
    """
    cfg = _imap_config()
    if not cfg["host"] or not cfg["user"]:
        logger.warning("IMAP not configured (IMAP_HOST, IMAP_USER)")
        return []

    messages: list[dict] = []
    client = _connect_imap(cfg)
    try:
        client.select(cfg["mailbox"])
        _, data = client.search(None, "UNSEEN")
        ids = data[0].split() if data[0] else []
        for num in ids:
            _, msg_data = client.fetch(num, "(RFC822)")
            if not msg_data or not msg_data[0]:
                continue
            raw = msg_data[0][1]
            msg = email.message_from_bytes(raw)
            message_id = msg.get("Message-ID", f"local-{num.decode()}")
            from_hdr = _decode_header_value(msg.get("From", ""))
            from_addr = from_hdr
            if "<" in from_hdr and ">" in from_hdr:
                from_addr = from_hdr.split("<")[1].split(">")[0].strip()
            sender_name = from_hdr.split("<")[0].strip().strip('"')
            subject = _decode_header_value(msg.get("Subject", ""))
            body = _extract_body(msg)
            messages.append(
                {
                    "message_id": message_id,
                    "from_addr": from_addr.lower(),
                    "subject": subject,
                    "body": body,
                    "sender_name": sender_name,
                }
            )
            client.store(num, "+FLAGS", "\\Seen")
    finally:
        try:
            client.logout()
        except Exception:
            pass
    return messages


async def poll_inbox_and_auto_reply() -> dict:
    """
    Κύρια ρουτίνα: κατεβάζει UNSEEN, τρέχει auto-responder ανά μήνυμα.
    """
    import asyncio

    loop = asyncio.get_event_loop()
    messages = await loop.run_in_executor(None, fetch_unseen_messages)

    result = {
        "fetched": len(messages),
        "auto_replied": 0,
        "skipped": 0,
        "errors": [],
        "details": [],
    }

    for msg in messages:
        try:
            out = await process_inbound_message(
                from_addr=msg["from_addr"],
                subject=msg["subject"],
                body=msg["body"],
                message_id=msg.get("message_id"),
                sender_name=msg.get("sender_name", ""),
            )
            result["details"].append(out)
            if out.get("sent"):
                result["auto_replied"] += 1
            else:
                result["skipped"] += 1
        except Exception as exc:
            result["errors"].append(str(exc))
            result["skipped"] += 1

    return result
