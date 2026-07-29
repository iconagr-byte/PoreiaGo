"""IMAP UTF-8 helpers — avoid ascii codec crashes on non-ascii credentials/folders."""

from __future__ import annotations

import imaplib
import socket
import ssl
from typing import Any


ENCODING_HINT_EL = (
    "IMAP σύνδεση απέτυχε λόγω encoding — πιθανό μη ASCII σε username/password "
    "ή IMAP mailbox. Ελέγξτε τον κωδικό και το IMAP Mailbox."
)

TIMEOUT_HINT_EL = (
    "IMAP σύνδεση: timeout — δεν ήταν δυνατή η σύνδεση στον mail server "
    "(θύρα 993/143). Ελέγξτε host, ότι ο λογαριασμός IMAP είναι ενεργός, "
    "και ότι ο πάροχος email επιτρέπει εξωτερικές συνδέσεις."
)

AUTH_HINT_EL = (
    "IMAP σύνδεση: λάθος username ή κωδικός mailbox. "
    "Χρησιμοποιήστε τον κωδικό του email (webmail), όχι τον κωδικό εισόδου στο γραφείο."
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
        or "errno 101" in msg
        or "errno 111" in msg
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
    """Switch imaplib from ascii to utf-8 before LOGIN/SELECT with non-ascii data."""
    if hasattr(client, "_mode_utf8"):
        try:
            client._mode_utf8()
            return
        except Exception:
            pass
    if hasattr(client, "_encoding"):
        client._encoding = "utf-8"
    if hasattr(client, "utf8_enabled"):
        client.utf8_enabled = True


def _resolve_ipv4(host: str) -> str:
    """Prefer IPv4 — some hosts hang on broken AAAA paths."""
    try:
        infos = socket.getaddrinfo(host, None, socket.AF_INET, socket.SOCK_STREAM)
        if infos:
            return infos[0][4][0]
    except OSError:
        pass
    return host


def _connect_imap_once(cfg: dict[str, Any]) -> imaplib.IMAP4 | imaplib.IMAP4_SSL:
    host = (cfg.get("host") or "").strip()
    use_ssl = bool(cfg.get("use_ssl", True))
    port = int(cfg.get("port") or (993 if use_ssl else 143))
    timeout = float(cfg.get("timeout") or IMAP_CONNECT_TIMEOUT_SEC)
    ipv4 = _resolve_ipv4(host)

    if use_ssl:
        context = ssl.create_default_context()
        # Shared cPanel certs often omit mail.customer-domain — still allow login.
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        client = imaplib.IMAP4_SSL(ipv4, port, ssl_context=context, timeout=timeout)
    else:
        client = imaplib.IMAP4(ipv4, port, timeout=timeout)
        try:
            client.starttls()
        except Exception:
            pass

    enable_imap_utf8(client)
    client.login(cfg["user"], cfg["password"])
    return client


def connect_imap(cfg: dict[str, Any]) -> imaplib.IMAP4 | imaplib.IMAP4_SSL:
    """Connect with optional fallback 993 SSL → 143 STARTTLS on timeout."""
    try:
        return _connect_imap_once(cfg)
    except Exception as exc:
        use_ssl = bool(cfg.get("use_ssl", True))
        port = int(cfg.get("port") or (993 if use_ssl else 143))
        if is_timeout_error(exc) and use_ssl and port == 993:
            alt = {**cfg, "use_ssl": False, "port": 143}
            try:
                return _connect_imap_once(alt)
            except Exception as alt_exc:
                # Prefer original timeout message for UX consistency.
                raise exc from alt_exc
        raise
