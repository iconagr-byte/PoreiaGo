"""REST API — Webmail mailbox (cached IMAP + SMTP actions)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from email_client import store as mailbox_store
from email_client.constants import MAILBOX_FOLDERS
from email_client.imap_sync import sync_imap_to_database_async
from email_client.mailbox_service import (
    forward_message,
    lookup_customer_for_message,
    move_to_trash,
    reply_to_message,
    save_compose_draft,
    send_compose,
)
from email_client.schemas import (
    ComposeBody,
    CustomerCard,
    DraftBody,
    EmailMessageDetail,
    EmailMessageOut,
    FolderCounts,
    ForwardBody,
    ImapSyncResult,
    MessagePatch,
    ReplyBody,
    SubscriberOut,
)

router = APIRouter(tags=["Email Mailbox"])


@router.get("/api/mailbox/folders", response_model=FolderCounts)
async def mailbox_folders(email_settings_id: str | None = Query(default=None)):
    counts = await mailbox_store.folder_unread_counts(email_settings_id=email_settings_id)
    folders = []
    total = 0
    for name in MAILBOX_FOLDERS:
        unread = counts.get(name, 0)
        total += unread
        folders.append({"name": name, "unread": unread})
    return FolderCounts(folders=folders, total_unread=total)


@router.get("/api/mailbox/messages", response_model=list[EmailMessageOut])
async def list_mailbox_messages(
    folder: str = "Inbox",
    email_settings_id: str | None = Query(default=None),
    limit: int = Query(50, le=200),
    offset: int = 0,
    search: str | None = None,
):
    if folder not in MAILBOX_FOLDERS:
        raise HTTPException(status_code=400, detail="Invalid folder")
    rows = await mailbox_store.list_messages(
        folder=folder,
        email_settings_id=email_settings_id,
        limit=limit,
        offset=offset,
        search=search,
    )
    return [EmailMessageOut(**{k: r[k] for k in EmailMessageOut.model_fields if k in r}) for r in rows]


@router.get("/api/mailbox/messages/{message_id}", response_model=EmailMessageDetail)
async def get_mailbox_message(message_id: str):
    msg = await mailbox_store.get_message(message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if not msg["is_read"]:
        await mailbox_store.update_message(message_id, {"is_read": True})
        msg = await mailbox_store.get_message(message_id)
    return EmailMessageDetail(**msg)


@router.patch("/api/mailbox/messages/{message_id}", response_model=EmailMessageOut)
async def patch_mailbox_message(message_id: str, body: MessagePatch):
    patch = body.model_dump(exclude_unset=True)
    updated = await mailbox_store.update_message(message_id, patch)
    if not updated:
        raise HTTPException(status_code=404, detail="Message not found")
    return EmailMessageOut(**{k: updated[k] for k in EmailMessageOut.model_fields})


@router.delete("/api/mailbox/messages/{message_id}")
async def delete_mailbox_message(message_id: str):
    updated = await move_to_trash(message_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"ok": True, "folder": updated["folder"]}


@router.post("/api/mailbox/messages/{message_id}/reply")
async def reply_mailbox_message(message_id: str, body: ReplyBody):
    try:
        return await reply_to_message(message_id, body_html=body.body_html, subject=body.subject)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/api/mailbox/messages/{message_id}/forward")
async def forward_mailbox_message(message_id: str, body: ForwardBody):
    try:
        return await forward_message(message_id, to_addr=body.to, body_html=body.body_html)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/api/mailbox/messages/{message_id}/customer", response_model=CustomerCard | None)
async def mailbox_message_customer(message_id: str):
    return await lookup_customer_for_message(message_id)


@router.post("/api/mailbox/compose")
async def compose_send(
    body: ComposeBody,
    email_settings_id: str | None = Query(default=None),
):
    try:
        att = [a.model_dump() for a in body.attachments]
        return await send_compose(
            to_addr=body.to,
            subject=body.subject,
            body_html=body.body_html,
            email_settings_id=email_settings_id,
            cc=body.cc,
            bcc=body.bcc,
            priority=body.priority,
            request_read_receipt=body.request_read_receipt,
            attachments=att,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/mailbox/drafts", response_model=EmailMessageOut)
async def save_draft(
    body: DraftBody,
    email_settings_id: str | None = Query(default=None),
):
    payload = body.model_dump()
    if email_settings_id and not payload.get("email_settings_id"):
        payload["email_settings_id"] = email_settings_id
    saved = await save_compose_draft(payload)
    return EmailMessageOut(**{k: saved[k] for k in EmailMessageOut.model_fields})


@router.post("/api/mailbox/sync", response_model=ImapSyncResult)
async def trigger_imap_sync(email_settings_id: str | None = Query(default=None)):
    result = await sync_imap_to_database_async(email_settings_id=email_settings_id)
    return ImapSyncResult(**result)


@router.get("/api/mailbox/subscribers", response_model=list[SubscriberOut])
async def list_subscribers(subscribed_only: bool = False):
    return await mailbox_store.list_subscribers(subscribed_only=subscribed_only)
