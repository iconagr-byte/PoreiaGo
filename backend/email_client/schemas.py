"""Pydantic — Email Client API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class EmailMessageOut(BaseModel):
    id: str
    message_id: str
    subject: str
    sender: str
    recipient: str
    body_html: str
    folder: str
    is_read: bool
    date: str


class EmailMessageDetail(EmailMessageOut):
    body_text: str | None = None


class FolderCounts(BaseModel):
    folders: list[dict]
    total_unread: int


class MessagePatch(BaseModel):
    is_read: bool | None = None
    folder: str | None = None


class ComposeAttachment(BaseModel):
    filename: str
    content_type: str = "application/octet-stream"
    data_base64: str


class ComposeBody(BaseModel):
    to: str
    subject: str
    body_html: str
    cc: str = ""
    bcc: str = ""
    priority: str = "normal"
    request_read_receipt: bool = False
    attachments: list[ComposeAttachment] = Field(default_factory=list)


class ReplyBody(BaseModel):
    body_html: str
    subject: str | None = None


class ForwardBody(BaseModel):
    to: str
    body_html: str | None = None


class DraftBody(BaseModel):
    id: str | None = None
    subject: str = ""
    recipient: str = ""
    body_html: str = ""
    email_settings_id: str | None = None


class CustomerCard(BaseModel):
    email: str
    name: str
    customer_id: str | None = None
    phone: str = ""
    source: str


class ImapSyncResult(BaseModel):
    ok: bool
    synced: int = 0
    folders: dict = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)
    error: str | None = None


class SubscriberOut(BaseModel):
    id: str
    email: str
    customer_id: str | None = None
    name: str | None = None
    is_subscribed: bool
