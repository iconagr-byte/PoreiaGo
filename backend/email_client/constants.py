"""Φάκελοι mailbox & ρυθμίσεις sync."""

from __future__ import annotations

FOLDER_INBOX = "Inbox"
FOLDER_SENT = "Sent"
FOLDER_DRAFTS = "Drafts"
FOLDER_SPAM = "Spam"
FOLDER_TRASH = "Trash"

MAILBOX_FOLDERS = (
    FOLDER_INBOX,
    FOLDER_SENT,
    FOLDER_DRAFTS,
    FOLDER_SPAM,
    FOLDER_TRASH,
)

# IMAP mailbox names (override via env)
IMAP_SYNC_FOLDERS = ("INBOX", "Sent", "Spam")

DEFAULT_SYNC_INTERVAL_SEC = 120
DEFAULT_SYNC_BATCH = 100
CAMPAIGN_BATCH_SIZE = 50
