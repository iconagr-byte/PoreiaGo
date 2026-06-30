"""REST API — δυναμικές ρυθμίσεις IMAP/SMTP (EmailSettings)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from email_client.dynamic_mailer import test_account_connection
from email_client.settings_store import (
    create_settings,
    delete_settings,
    get_settings,
    list_settings,
    update_settings,
)

router = APIRouter(prefix="/api/email/settings", tags=["Email Settings"])


class EmailSettingsCreate(BaseModel):
    label: str = ""
    email_address: str
    imap_host: str
    imap_port: int = 993
    imap_secure: bool = True
    imap_mailbox: str = "INBOX"
    imap_folder_sent: str = "Sent"
    imap_folder_spam: str = "Spam"
    smtp_host: str
    smtp_port: int = 587
    smtp_secure: bool = True
    mail_username: str = ""
    mail_password: str = ""
    is_active: bool = True
    owner_key: str = "default"
    user_id: str | None = None


class EmailSettingsUpdate(BaseModel):
    label: str | None = None
    email_address: str | None = None
    imap_host: str | None = None
    imap_port: int | None = None
    imap_secure: bool | None = None
    imap_mailbox: str | None = None
    imap_folder_sent: str | None = None
    imap_folder_spam: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_secure: bool | None = None
    mail_username: str | None = None
    mail_password: str | None = Field(None, description="Κενό = διατήρηση υπάρχοντος")
    is_active: bool | None = None
    user_id: str | None = None


class EmailSettingsOut(BaseModel):
    id: str
    owner_key: str
    user_id: str | None = None
    label: str
    email_address: str
    imap_host: str
    imap_port: int
    imap_secure: bool
    imap_mailbox: str
    imap_folder_sent: str
    imap_folder_spam: str
    smtp_host: str
    smtp_port: int
    smtp_secure: bool
    mail_username: str
    is_active: bool
    has_password: bool
    last_sync_at: str | None = None
    last_sync_error: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class TestConnectionBody(BaseModel):
    """Δοκιμή πριν αποθήκευση — στέλνει κωδικό στο body."""
    email_address: str
    imap_host: str
    imap_port: int = 993
    imap_secure: bool = True
    imap_mailbox: str = "INBOX"
    smtp_host: str
    smtp_port: int = 587
    smtp_secure: bool = True
    mail_username: str = ""
    mail_password: str = ""


@router.get("", response_model=list[EmailSettingsOut])
async def list_email_settings(
    owner_key: str = Query(default="default"),
    active_only: bool = False,
):
    rows = await list_settings(owner_key=owner_key, active_only=active_only)
    return [EmailSettingsOut(**r) for r in rows]


@router.post("", response_model=EmailSettingsOut, status_code=201)
async def create_email_settings(body: EmailSettingsCreate):
    if not body.mail_password:
        raise HTTPException(status_code=400, detail="Απαιτείται κωδικός email")
    created = await create_settings(body.model_dump())
    return EmailSettingsOut(**created)


@router.get("/{settings_id}", response_model=EmailSettingsOut)
async def get_email_settings(settings_id: str):
    row = await get_settings(settings_id)
    if not row:
        raise HTTPException(status_code=404, detail="Ρυθμίσεις δεν βρέθηκαν")
    return EmailSettingsOut(**row)


@router.patch("/{settings_id}", response_model=EmailSettingsOut)
async def patch_email_settings(settings_id: str, body: EmailSettingsUpdate):
    updated = await update_settings(settings_id, body.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Ρυθμίσεις δεν βρέθηκαν")
    return EmailSettingsOut(**updated)


@router.delete("/{settings_id}", status_code=204)
async def remove_email_settings(settings_id: str):
    if not await delete_settings(settings_id):
        raise HTTPException(status_code=404, detail="Ρυθμίσεις δεν βρέθηκαν")


@router.post("/test-connection")
async def test_connection(body: TestConnectionBody):
    account = {
        **body.model_dump(),
        "mail_password": body.mail_password,
    }
    if not account.get("mail_username"):
        account["mail_username"] = body.email_address
    return test_account_connection(account)


@router.post("/{settings_id}/test-connection")
async def test_saved_connection(settings_id: str):
    account = await get_settings(settings_id, with_password=True)
    if not account:
        raise HTTPException(status_code=404, detail="Ρυθμίσεις δεν βρέθηκαν")
    return test_account_connection(account)
