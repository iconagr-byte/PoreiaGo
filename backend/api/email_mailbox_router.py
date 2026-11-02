"""REST API — Webmail mailbox (cached IMAP + SMTP actions).

SEAL: every read/write is scoped to the logged-in office's Email Hub accounts.
Cross-tenant message lists (e.g. Achillio mail visible on PoreiaGo) are forbidden.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from api.request_tenant import admin_tenant_id
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
    BulkTrashBody,
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
from email_client.settings_store import list_settings

router = APIRouter(tags=["Email Mailbox"])


def _owner_key(request: Request) -> str:
    return f"tenant:{admin_tenant_id(request)}"


async def _owned_account_ids(request: Request) -> list[str]:
    rows = await list_settings(
        owner_key=_owner_key(request),
        active_only=False,
        include_legacy_default=False,
    )
    return [str(r["id"]) for r in rows if r.get("id")]


async def _resolve_account_ids(
    request: Request,
    email_settings_id: str | None,
) -> list[str]:
    """Return the account id(s) this office may see. Empty = empty inbox (never all tenants)."""
    owned = await _owned_account_ids(request)
    needle = str(email_settings_id or "").strip()
    if needle:
        if needle not in owned:
            raise HTTPException(status_code=404, detail="Ο λογαριασμός email δεν βρέθηκε")
        return [needle]
    return owned


async def _require_owned_message(message_id: str, request: Request) -> dict:
    msg = await mailbox_store.get_message(message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    owned = await _owned_account_ids(request)
    sid = str(msg.get("email_settings_id") or "").strip()
    if not sid or sid not in owned:
        # Do not reveal that the message exists under another office.
        raise HTTPException(status_code=404, detail="Message not found")
    return msg


def _message_out(row: dict) -> EmailMessageOut:
    payload = {k: row[k] for k in EmailMessageOut.model_fields if k in row}
    if payload.get("body_html") is None:
        payload["body_html"] = ""
    if payload.get("subject") is None:
        payload["subject"] = ""
    if payload.get("sender") is None:
        payload["sender"] = ""
    if payload.get("recipient") is None:
        payload["recipient"] = ""
    if not payload.get("date"):
        payload["date"] = ""
    return EmailMessageOut(**payload)


@router.post("/api/mailbox/sync", response_model=ImapSyncResult)
async def trigger_imap_sync(
    request: Request,
    email_settings_id: str | None = Query(default=None),
):
    try:
        from email_client.store import init_email_client_tables

        await init_email_client_tables()
    except Exception:
        pass
    scope = await _resolve_account_ids(request, email_settings_id)
    if not scope:
        return ImapSyncResult(
            ok=False,
            synced=0,
            folders={},
            errors=[],
            error="Δεν υπάρχουν λογαριασμοί email — προσθέστε από Ρυθμίσεις Email",
        )
    try:
        # One account: sync that row. Multiple: sync only this office's accounts.
        if len(scope) == 1:
            result = await sync_imap_to_database_async(email_settings_id=scope[0])
        else:
            result = await sync_imap_to_database_async(owner_key=_owner_key(request))
        return ImapSyncResult(
            ok=bool(result.get("ok")),
            synced=int(result.get("synced") or 0),
            folders=result.get("folders") or {},
            errors=list(result.get("errors") or []),
            error=result.get("error"),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Αποτυχία IMAP: {exc}",
        ) from exc


@router.get("/api/mailbox/folders", response_model=FolderCounts)
async def mailbox_folders(
    request: Request,
    email_settings_id: str | None = Query(default=None),
):
    try:
        from email_client.store import init_email_client_tables

        await init_email_client_tables()
    except Exception:
        pass
    scope = await _resolve_account_ids(request, email_settings_id)
    try:
        counts = await mailbox_store.folder_unread_counts(email_settings_ids=scope)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Mailbox: {exc}") from exc
    folders = []
    total = 0
    for name in MAILBOX_FOLDERS:
        unread = counts.get(name, 0)
        total += unread
        folders.append({"name": name, "unread": unread})
    return FolderCounts(folders=folders, total_unread=total)


@router.get("/api/mailbox/messages", response_model=list[EmailMessageOut])
async def list_mailbox_messages(
    request: Request,
    folder: str = "Inbox",
    email_settings_id: str | None = Query(default=None),
    limit: int = Query(50, le=200),
    offset: int = 0,
    search: str | None = None,
):
    if folder not in MAILBOX_FOLDERS:
        raise HTTPException(status_code=400, detail="Invalid folder")
    scope = await _resolve_account_ids(request, email_settings_id)
    try:
        rows = await mailbox_store.list_messages(
            folder=folder,
            email_settings_ids=scope,
            limit=limit,
            offset=offset,
            search=search,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Mailbox: {exc}") from exc
    return [_message_out(r) for r in rows]


@router.post("/api/mailbox/messages/bulk-trash")
async def bulk_trash_mailbox_messages(body: BulkTrashBody, request: Request):
    """Move many messages to Trash in one request (UI multi-select)."""
    ids = [str(i).strip() for i in (body.ids or []) if str(i).strip()]
    if not ids:
        raise HTTPException(status_code=400, detail="Δεν επιλέχθηκαν μηνύματα")
    if len(ids) > 200:
        raise HTTPException(status_code=400, detail="Μέχρι 200 μηνύματα ανά ενέργεια")
    owned = await _owned_account_ids(request)
    moved = 0
    missing: list[str] = []
    for mid in ids:
        msg = await mailbox_store.get_message(mid)
        sid = str((msg or {}).get("email_settings_id") or "").strip()
        if not msg or not sid or sid not in owned:
            missing.append(mid)
            continue
        updated = await move_to_trash(mid)
        if updated:
            moved += 1
        else:
            missing.append(mid)
    return {"ok": True, "moved": moved, "missing": missing}


@router.get("/api/mailbox/messages/{message_id}", response_model=EmailMessageDetail)
async def get_mailbox_message(message_id: str, request: Request):
    msg = await _require_owned_message(message_id, request)
    if not msg["is_read"]:
        await mailbox_store.update_message(message_id, {"is_read": True})
        msg = await _require_owned_message(message_id, request)
    for key in ("body_html", "subject", "sender", "recipient", "date"):
        if msg.get(key) is None:
            msg[key] = ""
    return EmailMessageDetail(**msg)


@router.patch("/api/mailbox/messages/{message_id}", response_model=EmailMessageOut)
async def patch_mailbox_message(message_id: str, body: MessagePatch, request: Request):
    await _require_owned_message(message_id, request)
    patch = body.model_dump(exclude_unset=True)
    updated = await mailbox_store.update_message(message_id, patch)
    if not updated:
        raise HTTPException(status_code=404, detail="Message not found")
    return _message_out(updated)


@router.delete("/api/mailbox/messages/{message_id}")
async def delete_mailbox_message(message_id: str, request: Request):
    await _require_owned_message(message_id, request)
    updated = await move_to_trash(message_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"ok": True, "folder": updated["folder"]}


@router.post("/api/mailbox/messages/{message_id}/reply")
async def reply_mailbox_message(message_id: str, body: ReplyBody, request: Request):
    await _require_owned_message(message_id, request)
    try:
        return await reply_to_message(message_id, body_html=body.body_html, subject=body.subject)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/api/mailbox/messages/{message_id}/forward")
async def forward_mailbox_message(message_id: str, body: ForwardBody, request: Request):
    await _require_owned_message(message_id, request)
    try:
        return await forward_message(message_id, to_addr=body.to, body_html=body.body_html)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/api/mailbox/messages/{message_id}/customer", response_model=CustomerCard | None)
async def mailbox_message_customer(message_id: str, request: Request):
    await _require_owned_message(message_id, request)
    return await lookup_customer_for_message(message_id)


@router.post("/api/mailbox/compose")
async def compose_send(
    body: ComposeBody,
    request: Request,
    email_settings_id: str | None = Query(default=None),
):
    scope = await _resolve_account_ids(request, email_settings_id)
    if not scope:
        raise HTTPException(
            status_code=400,
            detail="Προσθέστε λογαριασμό email στις Ρυθμίσεις Email πριν την αποστολή",
        )
    send_id = scope[0]
    # Prefer explicit account when provided / when multiple exist use first owned.
    if email_settings_id and str(email_settings_id).strip() in scope:
        send_id = str(email_settings_id).strip()
    try:
        att = [a.model_dump() for a in body.attachments]
        return await send_compose(
            to_addr=body.to,
            subject=body.subject,
            body_html=body.body_html,
            email_settings_id=send_id,
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
    request: Request,
    email_settings_id: str | None = Query(default=None),
):
    scope = await _resolve_account_ids(request, email_settings_id)
    if not scope:
        raise HTTPException(
            status_code=400,
            detail="Προσθέστε λογαριασμό email στις Ρυθμίσεις Email",
        )
    payload = body.model_dump()
    sid = str(email_settings_id or payload.get("email_settings_id") or "").strip()
    if sid and sid not in scope:
        raise HTTPException(status_code=404, detail="Ο λογαριασμός email δεν βρέθηκε")
    payload["email_settings_id"] = sid or scope[0]
    saved = await save_compose_draft(payload)
    return _message_out(saved)


@router.get("/api/mailbox/subscribers", response_model=list[SubscriberOut])
async def list_subscribers(subscribed_only: bool = False):
    return await mailbox_store.list_subscribers(subscribed_only=subscribed_only)
