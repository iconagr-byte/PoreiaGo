"""Mailbox operations — reply, forward, trash (δυναμικό SMTP ανά λογαριασμό)."""

from __future__ import annotations

import uuid

from ticketing.customer_accounts import get_account

from .constants import FOLDER_SENT, FOLDER_TRASH
from .dynamic_mailer import load_account, send_email_smtp
from .settings_store import get_settings_for_send
from .store import get_message, record_sent_local, save_draft, update_message


async def _smtp_account_for_message(msg: dict | None, email_settings_id: str | None) -> dict:
    sid = email_settings_id or (msg.get("email_settings_id") if msg else None)
    return await get_settings_for_send(sid)


async def lookup_customer_for_message(message_pk: str) -> dict | None:
    msg = await get_message(message_pk)
    if not msg:
        return None
    email = ""
    if msg["folder"] == FOLDER_SENT:
        email = (msg["recipient"] or "").strip().lower()
    else:
        email = (msg["sender"] or "").strip().lower()
    if not email or "@" not in email:
        return None
    account = await get_account(email)
    if account:
        return {
            "email": account["email"],
            "name": account["name"],
            "customer_id": account["customer_id"],
            "phone": account.get("phone", ""),
            "source": "customer_accounts",
        }
    return {
        "email": email,
        "name": email.split("@")[0],
        "customer_id": None,
        "phone": "",
        "source": "unknown",
    }


async def reply_to_message(
    message_pk: str,
    *,
    body_html: str,
    subject: str | None = None,
    email_settings_id: str | None = None,
) -> dict:
    original = await get_message(message_pk)
    if not original:
        raise ValueError("Το μήνυμα δεν βρέθηκε")
    to_addr = original["sender"] if original["folder"] != FOLDER_SENT else original["recipient"]
    subj = subject or f"Re: {original['subject']}"
    if not subj.lower().startswith("re:"):
        subj = f"Re: {subj}"
    account = await _smtp_account_for_message(original, email_settings_id)
    await send_email_smtp(account, to=to_addr, subject=subj, body_html=body_html)
    sent = await record_sent_local(
        subject=subj,
        sender=account["email_address"],
        recipient=to_addr,
        body_html=body_html,
        message_id=f"<reply-{uuid.uuid4().hex}@local>",
        email_settings_id=account["id"],
    )
    return {"ok": True, "sent_message": sent}


async def forward_message(
    message_pk: str,
    *,
    to_addr: str,
    body_html: str | None = None,
    email_settings_id: str | None = None,
) -> dict:
    original = await get_message(message_pk)
    if not original:
        raise ValueError("Το μήνυμα δεν βρέθηκε")
    content = body_html or original["body_html"]
    fwd_body = (
        f"{content}<hr/><p><small>Προωθημένο:</small></p>"
        f"<p><b>Από:</b> {original['sender']}<br/>"
        f"<b>Θέμα:</b> {original['subject']}</p>"
        f"{original['body_html']}"
    )
    subj = f"Fwd: {original['subject']}"
    account = await _smtp_account_for_message(original, email_settings_id)
    await send_email_smtp(account, to=to_addr, subject=subj, body_html=fwd_body)
    sent = await record_sent_local(
        subject=subj,
        sender=account["email_address"],
        recipient=to_addr,
        body_html=fwd_body,
        message_id=f"<fwd-{uuid.uuid4().hex}@local>",
        email_settings_id=account["id"],
    )
    return {"ok": True, "sent_message": sent}


async def move_to_trash(message_pk: str) -> dict | None:
    return await update_message(message_pk, {"folder": FOLDER_TRASH, "is_read": True})


async def send_compose(
    *,
    to_addr: str,
    subject: str,
    body_html: str,
    email_settings_id: str | None = None,
    cc: str = "",
    bcc: str = "",
    priority: str = "normal",
    request_read_receipt: bool = False,
    attachments: list[dict] | None = None,
) -> dict:
    account = await get_settings_for_send(email_settings_id)
    await send_email_smtp(
        account,
        to=to_addr,
        subject=subject,
        body_html=body_html,
        cc=cc,
        bcc=bcc,
        priority=priority,
        request_read_receipt=request_read_receipt,
        attachments=attachments,
    )
    sent = await record_sent_local(
        subject=subject,
        sender=account["email_address"],
        recipient=to_addr,
        body_html=body_html,
        message_id=f"<out-{uuid.uuid4().hex}@local>",
        email_settings_id=account["id"],
    )
    return {"ok": True, "sent_message": sent}


async def save_compose_draft(data: dict) -> dict:
    sid = data.get("email_settings_id")
    if sid:
        acc = await load_account(sid)
        data.setdefault("sender", acc["email_address"])
    return await save_draft(data)
