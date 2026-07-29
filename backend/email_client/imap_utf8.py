"""IMAP UTF-8 helpers — avoid ascii codec crashes on non-ascii credentials/folders."""

from __future__ import annotations

import imaplib
import socket
from typing import Any


ENCODING_HINT_EL = (
    "IMAP σύνδεση απέτυχε λόγω encoding — πιθανό μη ASCII σε username/password "
    "ή IMAP mailbox. Δοκιμάστε τον κωδικό όπως δίνεται από τον πάροχο και "
    "ελέγξτε το IMAP Mailbox."
)

TIMEOUT_HINT_EL = (
    "IMAP σύνδεση: timeout — ο server του PoreiaGo δεν μπορεί να φτάσει "
    "τον mail host (θύρα 993). Ρυθμίσεις host/port OK· ζητήστε από τον πάροχο "
    "hosting (cPanel) να επιτρέψει το IP του PoreiaGo (34.141.98.145) για IMAP/SMTP."
)

AUTH_HINT_EL = (
    "IMAP σύνδεση: λάθος username ή κωδικός mailbox. "
    "Χρησιμοποιήστε τον κωδικό του email (cPanel/webmail), όχι του admin login."
)

IMAP_CONNECT_TIMEOUT_SEC = 20


def is_ascii_codec_error(exc: BaseException | str) -> bool:
    msg = str(exc)
    return "ascii codec can't encode characters" in msg or "ordinal not in range" in msg


def is_timeout_error(exc: BaseException | str) -> bool:
    if isinstance(exc, (TimeoutError, socket.timeout)):
        return True
    msg = str(exc).lower()
    return (
        "timed out" in msg
        or "timeout" in msg
        or "errno 110" in msg
        or "errno 101" in msg  # network unreachable
        or "errno 111" in msg  # connection refused
    )


def is_auth_error(exc: BaseException | str) -> bool:
    msg = str(exc)
    return "AUTHENTICATIONFAILED" in msg or "Authentication failed" in msg


def format_imap_connect_error(exc: BaseException) -> str:
    if is_ascii_codec_error(exc):
        return ENCODING_HINT_EL
    if is_timeout_error(exc):
        return TIMEOUT_HINT_EL
    if is_auth_error(exc):
        return AUTH_HINT_EL
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
    host = cfg["host"]
    port = int(cfg.get("port") or (993 if cfg.get("use_ssl", True) else 143))
    timeout = float(cfg.get("timeout") or IMAP_CONNECT_TIMEOUT_SEC)
    if cfg.get("use_ssl", True):
        client = imaplib.IMAP4_SSL(host, port, timeout=timeout)
    else:
        client = imaplib.IMAP4(host, port, timeout=timeout)
    enable_imap_utf8(client)
    client.login(cfg["user"], cfg["password"])
    return client
