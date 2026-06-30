"""IMAP sync — INBOX, SENT, SPAM → email_messages cache."""

from __future__ import annotations

import asyncio
import email
import imaplib
import logging
import os
from datetime import datetime, timezone
from email.header import decode_header
from email.utils import parsedate_to_datetime
from typing import Any

from .constants import DEFAULT_SYNC_BATCH, FOLDER_INBOX, FOLDER_SENT, FOLDER_SPAM
from .dynamic_mailer import settings_to_imap_config
from .store import upsert_message

logger = logging.getLogger(__name__)


def _imap_config_from_env() -> dict[str, Any]:
    return {
        "host": os.getenv("IMAP_HOST", "").strip(),
        "port": int(os.getenv("IMAP_PORT", "993")),
        "user": os.getenv("IMAP_USER", "").strip(),
        "password": os.getenv("IMAP_PASSWORD", "").strip(),
        "use_ssl": os.getenv("IMAP_USE_SSL", "true").lower() == "true",
        "store_email": os.getenv("IMAP_USER", "").strip().lower(),
        "imap_mailbox": os.getenv("IMAP_MAILBOX", "INBOX"),
        "imap_folder_sent": os.getenv("IMAP_FOLDER_SENT", "Sent"),
        "imap_folder_spam": os.getenv("IMAP_FOLDER_SPAM", "Spam"),
    }


def _folder_names_from_cfg(cfg: dict) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = [(cfg.get("imap_mailbox") or "INBOX", FOLDER_INBOX)]
    sent = cfg.get("imap_folder_sent") or "Sent"
    spam = cfg.get("imap_folder_spam") or "Spam"
    if sent:
        out.append((sent, FOLDER_SENT))
    if spam:
        out.append((spam, FOLDER_SPAM))
    return out


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


def _parse_address(hdr: str) -> tuple[str, str]:
    if not hdr:
        return ("", "")
    if "<" in hdr and ">" in hdr:
        email_addr = hdr.split("<")[1].split(">")[0].strip().lower()
        name = hdr.split("<")[0].strip().strip('"')
        return (name, email_addr)
    return (hdr.strip(), hdr.strip().lower())


def _extract_bodies(msg: email.message.Message) -> tuple[str, str]:
    html_parts: list[str] = []
    text_parts: list[str] = []
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            disp = str(part.get("Content-Disposition", ""))
            if "attachment" in disp.lower():
                continue
            payload = part.get_payload(decode=True)
            if not payload:
                continue
            charset = part.get_content_charset() or "utf-8"
            decoded = payload.decode(charset, errors="replace")
            if ctype == "text/html":
                html_parts.append(decoded)
            elif ctype == "text/plain":
                text_parts.append(decoded)
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            decoded = payload.decode(charset, errors="replace")
            if msg.get_content_type() == "text/html":
                html_parts.append(decoded)
            else:
                text_parts.append(decoded)
    html = "\n".join(html_parts)[:50000]
    text = "\n".join(text_parts)[:20000]
    if not html and text:
        import html as html_mod

        escaped = html_mod.escape(text)
        html = f"<pre style='font-family:sans-serif;white-space:pre-wrap'>{escaped}</pre>"
    return html, text


def _message_date(msg: email.message.Message) -> str:
    raw = msg.get("Date")
    if raw:
        try:
            dt = parsedate_to_datetime(raw)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat()
        except Exception:
            pass
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _connect_imap(cfg: dict) -> imaplib.IMAP4 | imaplib.IMAP4_SSL:
    if cfg["use_ssl"]:
        client = imaplib.IMAP4_SSL(cfg["host"], cfg["port"])
    else:
        client = imaplib.IMAP4(cfg["host"], cfg["port"])
    client.login(cfg["user"], cfg["password"])
    return client


def _fetch_all_from_imap(
    cfg: dict[str, Any],
    *,
    batch_per_folder: int,
    email_settings_id: str | None = None,
) -> tuple[list[dict], list[str]]:
    if not cfg.get("host") or not cfg.get("user"):
        return [], ["IMAP host/username missing"]

    messages: list[dict] = []
    errors: list[str] = []
    client = _connect_imap(cfg)
    try:
        for imap_box, local_folder in _folder_names_from_cfg(cfg):
            try:
                status, _ = client.select(imap_box, readonly=True)
                if status != "OK":
                    errors.append(f"Cannot select {imap_box}")
                    continue
            except Exception as exc:
                errors.append(f"{imap_box}: {exc}")
                continue

            _, data = client.search(None, "ALL")
            ids = data[0].split() if data and data[0] else []
            for num in ids[-batch_per_folder:]:
                try:
                    _, msg_data = client.fetch(num, "(RFC822 FLAGS)")
                    if not msg_data or not msg_data[0]:
                        continue
                    raw = msg_data[0][1]
                    msg = email.message_from_bytes(raw)
                    message_id = (msg.get("Message-ID") or f"{imap_box}-{num.decode()}@sync").strip()
                    from_hdr = _decode_header_value(msg.get("From", ""))
                    to_hdr = _decode_header_value(msg.get("To", ""))
                    _, from_email = _parse_address(from_hdr)
                    _, to_email = _parse_address(to_hdr)
                    body_html, body_text = _extract_bodies(msg)

                    if local_folder == FOLDER_SENT:
                        sender = cfg["store_email"] or from_email
                        recipient = to_email or to_hdr
                    else:
                        sender = from_email or from_hdr
                        recipient = cfg["store_email"] or to_email

                    flags_raw = str(msg_data[0][0]) if msg_data[0] else ""
                    messages.append(
                        {
                            "email_settings_id": email_settings_id,
                            "message_id": message_id,
                            "subject": _decode_header_value(msg.get("Subject", "")),
                            "sender": sender,
                            "recipient": recipient,
                            "body_html": body_html,
                            "body_text": body_text,
                            "folder": local_folder,
                            "is_read": "\\Seen" in flags_raw,
                            "date": _message_date(msg),
                            "imap_uid": num.decode(),
                            "in_reply_to": msg.get("In-Reply-To"),
                        }
                    )
                except Exception as exc:
                    logger.debug("Skip %s/%s: %s", imap_box, num, exc)
    finally:
        try:
            client.logout()
        except Exception:
            pass
    return messages, errors


async def sync_account_imap(
    account: dict,
    *,
    batch_per_folder: int = DEFAULT_SYNC_BATCH,
) -> dict:
    """Συγχρονισμός ενός EmailSettings λογαριασμού."""
    settings_id = account["id"]
    cfg = settings_to_imap_config(account)
    loop = asyncio.get_event_loop()
    messages, errors = await loop.run_in_executor(
        None,
        lambda: _fetch_all_from_imap(
            cfg,
            batch_per_folder=batch_per_folder,
            email_settings_id=settings_id,
        ),
    )
    folder_counts: dict[str, int] = {}
    for m in messages:
        await upsert_message(m)
        folder_counts[m["folder"]] = folder_counts.get(m["folder"], 0) + 1

    from .settings_store import record_sync_result

    err_text = "; ".join(errors) if errors and not messages else None
    await record_sync_result(settings_id, error=err_text)

    return {
        "ok": True,
        "email_settings_id": settings_id,
        "synced": len(messages),
        "folders": folder_counts,
        "errors": errors,
    }


async def sync_imap_to_database_async(
    *,
    email_settings_id: str | None = None,
    batch_per_folder: int = DEFAULT_SYNC_BATCH,
) -> dict:
    from .settings_store import get_settings, list_settings

    if email_settings_id:
        account = await get_settings(email_settings_id, with_password=True)
        if not account:
            return {"ok": False, "error": "Account not found", "synced": 0}
        return await sync_account_imap(account, batch_per_folder=batch_per_folder)

    accounts = await list_settings(active_only=True)
    if accounts:
        total = 0
        merged_errors: list[str] = []
        all_folders: dict[str, int] = {}
        for acc in accounts:
            full = await get_settings(acc["id"], with_password=True)
            if not full or not full.get("imap_host"):
                continue
            try:
                r = await sync_account_imap(full, batch_per_folder=batch_per_folder)
                total += r.get("synced", 0)
                merged_errors.extend(r.get("errors", []))
                for k, v in r.get("folders", {}).items():
                    all_folders[k] = all_folders.get(k, 0) + v
            except Exception as exc:
                merged_errors.append(f"{acc['id']}: {exc}")
        return {
            "ok": True,
            "synced": total,
            "folders": all_folders,
            "errors": merged_errors,
            "accounts": len(accounts),
        }

    cfg = _imap_config_from_env()
    if not cfg["host"]:
        return {
            "ok": False,
            "error": "Δεν υπάρχουν λογαριασμοί email — προσθέστε από Ρυθμίσεις",
            "synced": 0,
            "folders": {},
        }
    loop = asyncio.get_event_loop()
    messages, errors = await loop.run_in_executor(
        None, lambda: _fetch_all_from_imap(cfg, batch_per_folder=batch_per_folder)
    )
    folder_counts: dict[str, int] = {}
    for m in messages:
        await upsert_message(m)
        folder_counts[m["folder"]] = folder_counts.get(m["folder"], 0) + 1
    return {
        "ok": True,
        "synced": len(messages),
        "folders": folder_counts,
        "errors": errors,
        "legacy_env": True,
    }
