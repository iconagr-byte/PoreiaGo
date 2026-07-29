"""IMAP UTF-8 helpers — avoid ascii codec crashes on non-ascii credentials/folders."""

from __future__ import annotations

import imaplib
from typing import Any


ENCODING_HINT_EL = (
    "IMAP σύνδεση απέτυχε λόγω encoding — πιθανό μη ASCII σε username/password "
    "ή IMAP mailbox. Δοκιμάστε τον κωδικό όπως δίνεται από τον πάροχο και "
    "ελέγξτε το IMAP Mailbox."
)


def is_ascii_codec_error(exc: BaseException | str) -> bool:
    msg = str(exc)
    return "ascii codec can't encode characters" in msg or "ordinal not in range" in msg


def format_imap_connect_error(exc: BaseException) -> str:
    if is_ascii_codec_error(exc):
        return ENCODING_HINT_EL
    return f"IMAP σύνδεση: {exc}"


def enable_imap_utf8(client: imaplib.IMAP4 | imaplib.IMAP4_SSL) -> None:
    """Switch imaplib from ascii to utf-8 before LOGIN/SELECT with non-ascii data.

    Without this, passwords or mailbox names with Greek (or other non-ascii)
    characters raise: 'ascii' codec can't encode characters ... ordinal not in range(128).
    """
    if hasattr(client, "_mode_utf8"):
        try:
            client._mode_utf8()
            return
        except Exception:
            pass
    # Fallback when _mode_utf8 is missing or fails mid-setup.
    if hasattr(client, "_encoding"):
        client._encoding = "utf-8"
    if hasattr(client, "utf8_enabled"):
        client.utf8_enabled = True


def connect_imap(cfg: dict[str, Any]) -> imaplib.IMAP4 | imaplib.IMAP4_SSL:
    if cfg.get("use_ssl", True):
        client = imaplib.IMAP4_SSL(cfg["host"], int(cfg.get("port") or 993))
    else:
        client = imaplib.IMAP4(cfg["host"], int(cfg.get("port") or 143))
    enable_imap_utf8(client)
    client.login(cfg["user"], cfg["password"])
    return client
