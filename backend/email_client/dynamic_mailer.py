"""Δυναμική σύνδεση IMAP/SMTP από EmailSettings ID."""

from __future__ import annotations

import asyncio
import imaplib
import logging
import smtplib
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from .attachment_utils import normalize_attachments
from .imap_utf8 import connect_imap, format_imap_connect_error, is_timeout_error
from .mail_probe import discover_egress_ip, probe_imap_login, probe_smtp_login, probe_tcp
from .settings_store import get_settings

logger = logging.getLogger(__name__)


SMTP_TIMEOUT_HINT_EL = (
    "SMTP σύνδεση: timeout — δεν ήταν δυνατή η σύνδεση στον mail server "
    "(θύρα 587/465). Ελέγξτε host και ότι ο πάροχος επιτρέπει εξωτερική αποστολή."
)

SMTP_AUTH_FAIL_HINT_EL = (
    "SMTP σύνδεση: Incorrect authentication data (535) — ο mail server απέρριψε "
    "username/κωδικό. Εφόσον το TCP ανοίγει, δεν είναι firewall: ξαναβάλτε τον "
    "κωδικό του mailbox (webmail), όχι τον κωδικό εισόδου στο γραφείο."
)

MISSING_PASSWORD_HINT_EL = (
    "Λείπει ο κωδικός mailbox — συμπληρώστε τον και πατήστε ξανά «Έλεγχος»."
)

DECRYPT_FAILED_HINT_EL = (
    "Ο αποθηκευμένος κωδικός δεν αποκρυπτογραφείται — "
    "αποθηκεύστε ξανά τον κωδικό mailbox στις Ρυθμίσεις Email."
)


def is_smtp_auth_reject(exc: BaseException | str) -> bool:
    msg = str(exc)
    lower = msg.lower()
    return (
        "Incorrect authentication data" in msg
        or "incorrect authentication data" in lower
        or "authentication failed" in lower
        or ("535" in msg and "auth" in lower)
    )


# Back-compat alias (older callers).
is_smtp_remote_auth_reject = is_smtp_auth_reject


def normalize_mail_password(password: str | None, *, host: str = "", email: str = "") -> str:
    """Normalize mailbox passwords without corrupting cPanel secrets.

    Only Google/Yahoo/Outlook *App Passwords* are shown as spaced 16-char tokens
    and may have spaces removed. Never apply that heuristic to custom/cPanel hosts
    (e.g. mail.achilliotravel.com) — a real password with spaces would break AUTH.
    """
    raw = str(password or "")
    if not raw:
        return ""
    blob = f"{host} {email}".lower()
    app_pwd_provider = any(
        x in blob
        for x in (
            "gmail.com",
            "googlemail.com",
            "imap.gmail.com",
            "smtp.gmail.com",
            "yahoo.",
            "ymail.com",
            "imap.mail.yahoo.com",
            "smtp.mail.yahoo.com",
            "outlook.",
            "hotmail.",
            "live.com",
            "office365.com",
        )
    )
    if app_pwd_provider:
        return "".join(raw.split())
    # Trim only — keep internal spaces / special chars intact for cPanel.
    return raw.strip()


def auth_debug_meta(account: dict) -> dict[str, Any]:
    """Safe diagnostics for AUTH failures (never returns the password)."""
    import hashlib

    cfg = settings_to_imap_config(account)
    pwd = cfg.get("password") or ""
    digest = hashlib.sha256(pwd.encode("utf-8")).hexdigest()[:10] if pwd else ""
    return {
        "username": cfg.get("user") or "",
        "password_len": len(pwd),
        "password_has_space": (" " in pwd),
        "password_sha10": digest,
        "imap_host": cfg.get("host") or "",
        "smtp_host": (account.get("smtp_host") or "").strip(),
        "smtp_port": int(account.get("smtp_port") or 587),
    }


def _format_smtp_error(exc: BaseException) -> str:
    from .imap_utf8 import GMAIL_APP_PASSWORD_HINT_EL, is_gmail_app_password_error

    if is_timeout_error(exc):
        return SMTP_TIMEOUT_HINT_EL
    if is_gmail_app_password_error(exc):
        return GMAIL_APP_PASSWORD_HINT_EL
    if is_smtp_auth_reject(exc):
        return SMTP_AUTH_FAIL_HINT_EL
    raw = str(exc).strip()
    if raw.startswith("b'") and raw.endswith("'"):
        raw = raw[2:-1]
    return f"SMTP σύνδεση: {raw}"


def settings_to_imap_config(account: dict) -> dict[str, Any]:
    host = (account.get("imap_host") or "").strip()
    email = (account.get("email_address") or account.get("mail_username") or "").strip()
    return {
        "host": host,
        "port": int(account.get("imap_port") or 993),
        "user": (account.get("mail_username") or account.get("email_address") or "").strip(),
        "password": normalize_mail_password(
            account.get("mail_password"), host=host, email=email
        ),
        "use_ssl": bool(account.get("imap_secure", True)),
        "store_email": (account.get("email_address") or "").strip().lower(),
        "imap_mailbox": account.get("imap_mailbox") or "INBOX",
        "imap_folder_sent": account.get("imap_folder_sent") or "Sent",
        "imap_folder_spam": account.get("imap_folder_spam") or "Spam",
    }


def settings_to_smtp_config(account: dict) -> dict[str, Any]:
    port = int(account.get("smtp_port") or 587)
    # Port 465 = implicit SSL (SMTPS). STARTTLS checkbox applies to 587/25.
    use_ssl = port == 465 or bool(account.get("smtp_ssl"))
    use_tls = (not use_ssl) and bool(account.get("smtp_secure", True))
    host = (account.get("smtp_host") or "").strip()
    email = (account.get("email_address") or account.get("mail_username") or "").strip()
    return {
        "host": host,
        "port": port,
        "user": (account.get("mail_username") or account.get("email_address") or "").strip(),
        "password": normalize_mail_password(
            account.get("mail_password"), host=host, email=email
        ),
        "use_ssl": use_ssl,
        "use_tls": use_tls,
        "from_addr": (account.get("email_address") or "").strip(),
    }


def _open_smtp(cfg: dict):
    """Return connected SMTP / SMTP_SSL client (caller must quit/close)."""
    if cfg.get("use_ssl"):
        smtp = smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=20)
    else:
        smtp = smtplib.SMTP(cfg["host"], cfg["port"], timeout=20)
        if cfg.get("use_tls"):
            smtp.starttls()
    return smtp


def _connect_imap(cfg: dict) -> imaplib.IMAP4 | imaplib.IMAP4_SSL:
    return connect_imap(cfg)


def test_imap_connection(account: dict) -> dict:
    if account.get("password_decrypt_failed"):
        return {"ok": False, "error": DECRYPT_FAILED_HINT_EL}
    cfg = settings_to_imap_config(account)
    if not cfg["host"] or not cfg["user"]:
        return {"ok": False, "error": "Συμπληρώστε IMAP host και username"}
    if not (cfg.get("password") or "").strip():
        return {"ok": False, "error": MISSING_PASSWORD_HINT_EL}

    probe = probe_imap_login(
        {
            "host": cfg["host"],
            "port": cfg["port"],
            "user": cfg["user"],
            "password": cfg["password"],
            "use_ssl": cfg.get("use_ssl", True),
            "imap_mailbox": cfg.get("imap_mailbox") or "INBOX",
        }
    )
    if probe.get("ok"):
        return {
            "ok": True,
            "message": probe.get("message") or "IMAP σύνδεση επιτυχής",
            "tcp_ok": True,
            "auth_mechs": probe.get("auth_mechs"),
            "peer_ip": probe.get("peer_ip"),
        }

    if not probe.get("tcp_ok"):
        tcp_err = probe.get("tcp_error") or "IMAP TCP failed"
        exc: BaseException
        if "time" in str(tcp_err).lower():
            exc = TimeoutError(tcp_err)
        else:
            exc = OSError(tcp_err)
        return {
            "ok": False,
            "error": format_imap_connect_error(exc),
            "tcp_ok": False,
            "server_reply": tcp_err,
            "peer_ip": probe.get("peer_ip"),
        }

    err = probe.get("error")
    if not isinstance(err, BaseException):
        err = Exception(str(err or "IMAP AUTH failed"))
    return {
        "ok": False,
        "error": format_imap_connect_error(err),
        "tcp_ok": True,
        "server_reply": probe.get("server_reply"),
        "auth_mechs": probe.get("auth_mechs"),
        "peer_ip": probe.get("peer_ip"),
    }

def test_smtp_connection(account: dict) -> dict:
    if account.get("password_decrypt_failed"):
        return {"ok": False, "error": DECRYPT_FAILED_HINT_EL}
    cfg = settings_to_smtp_config(account)
    if not cfg["host"] or not cfg["user"]:
        return {"ok": False, "error": "Συμπληρώστε SMTP host και username"}
    if not (cfg.get("password") or "").strip():
        return {"ok": False, "error": MISSING_PASSWORD_HINT_EL}

    probe = probe_smtp_login(
        {
            "host": cfg["host"],
            "port": cfg["port"],
            "user": cfg["user"],
            "password": cfg["password"],
            "use_ssl": cfg.get("use_ssl"),
            "use_tls": cfg.get("use_tls"),
        }
    )
    if probe.get("ok"):
        return {
            "ok": True,
            "message": probe.get("message") or "SMTP σύνδεση επιτυχής",
            "tcp_ok": True,
            "auth_mechs": probe.get("auth_mechs"),
            "peer_ip": probe.get("peer_ip"),
        }

    if not probe.get("tcp_ok"):
        tcp_err = probe.get("tcp_error") or "SMTP TCP failed"
        exc: BaseException
        if "time" in str(tcp_err).lower():
            exc = TimeoutError(tcp_err)
        else:
            exc = OSError(tcp_err)
        return {
            "ok": False,
            "error": _format_smtp_error(exc),
            "tcp_ok": False,
            "server_reply": tcp_err,
            "peer_ip": probe.get("peer_ip"),
        }

    err = probe.get("error")
    if not isinstance(err, BaseException):
        err = Exception(str(err or "SMTP AUTH failed"))
    return {
        "ok": False,
        "error": _format_smtp_error(err),
        "tcp_ok": True,
        "server_reply": probe.get("server_reply"),
        "auth_mechs": probe.get("auth_mechs"),
        "peer_ip": probe.get("peer_ip"),
    }

def _is_imap_auth_fail(error: str) -> bool:
    text = str(error or "")
    return (
        "λάθος username ή κωδικός" in text
        or "AUTHENTICATIONFAILED" in text
        or "Authentication failed" in text
    )


def test_account_connection(account: dict) -> dict:
    """Full IMAP+SMTP probe with egress IP + raw replies for hosting support."""
    imap = test_imap_connection(account)
    smtp = test_smtp_connection(account)
    debug = auth_debug_meta(account)

    imap_tcp = imap.get("tcp_ok")
    smtp_tcp = smtp.get("tcp_ok")
    if imap_tcp is None:
        imap_cfg = settings_to_imap_config(account)
        if imap_cfg.get("host"):
            imap_tcp = probe_tcp(imap_cfg["host"], imap_cfg["port"]).get("ok")
    if smtp_tcp is None:
        smtp_cfg = settings_to_smtp_config(account)
        if smtp_cfg.get("host"):
            smtp_tcp = probe_tcp(smtp_cfg["host"], smtp_cfg["port"]).get("ok")

    imap_auth_fail = _is_imap_auth_fail(imap.get("error") or "")
    smtp_auth_fail = is_smtp_auth_reject(smtp.get("error") or "")
    auth_rejected = (not imap.get("ok") and not smtp.get("ok")) and (
        smtp_auth_fail or imap_auth_fail
    )
    # IMAP AUTH failed after TCP opened → same symptom as wrong password OR hosting
    # remote-AUTH IP block (Intechs often confirms "ports OK" while AUTH is restricted).
    # SMTP 535 strengthens the signal but is not required (SMTP can flake independently).
    remote_auth = bool(auth_rejected and bool(imap_tcp) and imap_auth_fail)

    egress_ip = ""
    try:
        egress_ip = discover_egress_ip()
    except Exception:
        egress_ip = ""

    diagnostics = {
        "egress_ip": egress_ip,
        "imap_tcp_ok": bool(imap_tcp),
        "smtp_tcp_ok": bool(smtp_tcp),
        "imap_server_reply": imap.get("server_reply"),
        "smtp_server_reply": smtp.get("server_reply"),
        "imap_auth_mechs": imap.get("auth_mechs"),
        "smtp_auth_mechs": smtp.get("auth_mechs"),
        "imap_peer_ip": imap.get("peer_ip"),
        "smtp_peer_ip": smtp.get("peer_ip"),
    }
    debug = {**debug, "egress_ip": egress_ip}

    return {
        "ok": bool(imap.get("ok") and smtp.get("ok")),
        "imap": imap,
        "smtp": smtp,
        "auth_debug": debug,
        "diagnostics": diagnostics,
        "remote_auth": remote_auth,
        "credentials_rejected": bool(auth_rejected),
    }

async def load_account(settings_id: str) -> dict:
    account = await get_settings(settings_id, with_password=True)
    if not account:
        raise ValueError("Ο λογαριασμός email δεν βρέθηκε")
    return account


def _apply_headers(
    msg: MIMEMultipart,
    *,
    subject: str,
    from_addr: str,
    to: str,
    cc: str,
    priority: str,
    request_read_receipt: bool,
) -> None:
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    if cc.strip():
        msg["Cc"] = cc.strip()
    if priority == "high":
        msg["X-Priority"] = "1"
        msg["Importance"] = "high"
    elif priority == "low":
        msg["X-Priority"] = "5"
        msg["Importance"] = "low"
    if request_read_receipt:
        msg["Disposition-Notification-To"] = from_addr


def _build_message(
    *,
    subject: str,
    from_addr: str,
    to: str,
    body_html: str,
    cc: str = "",
    priority: str = "normal",
    request_read_receipt: bool = False,
    attachments: list[dict] | None = None,
) -> MIMEMultipart:
    files = normalize_attachments(attachments)
    if files:
        root = MIMEMultipart("mixed")
        _apply_headers(
            root,
            subject=subject,
            from_addr=from_addr,
            to=to,
            cc=cc,
            priority=priority,
            request_read_receipt=request_read_receipt,
        )
        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(body_html, "html", "utf-8"))
        root.attach(alt)
        for att in files:
            main, sub = (att["content_type"].split("/", 1) + ["octet-stream"])[:2]
            part = MIMEBase(main, sub)
            part.set_payload(att["data"])
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                "attachment",
                filename=att["filename"],
            )
            root.attach(part)
        return root

    msg = MIMEMultipart("alternative")
    _apply_headers(
        msg,
        subject=subject,
        from_addr=from_addr,
        to=to,
        cc=cc,
        priority=priority,
        request_read_receipt=request_read_receipt,
    )
    msg.attach(MIMEText(body_html, "html", "utf-8"))
    return msg


def _send_email_smtp_sync(
    account: dict,
    *,
    to: str,
    subject: str,
    body_html: str,
    cc: str = "",
    bcc: str = "",
    priority: str = "normal",
    request_read_receipt: bool = False,
    attachments: list[dict] | None = None,
) -> str:
    cfg = settings_to_smtp_config(account)
    if not cfg["host"]:
        raise ValueError("SMTP host δεν έχει ρυθμιστεί για αυτόν τον λογαριασμό")

    from_addr = cfg["from_addr"] or cfg["user"]
    msg = _build_message(
        subject=subject,
        from_addr=from_addr,
        to=to,
        body_html=body_html,
        cc=cc,
        priority=priority,
        request_read_receipt=request_read_receipt,
        attachments=attachments,
    )

    recipients = [a.strip() for a in to.split(",") if a.strip() and "@" in a]
    if cc.strip():
        recipients.extend(a.strip() for a in cc.split(",") if a.strip() and "@" in a)
    if bcc.strip():
        recipients.extend(a.strip() for a in bcc.split(",") if a.strip() and "@" in a)
    if not recipients:
        raise ValueError("Δεν βρέθηκε έγκυρος παραλήπτης")

    with _open_smtp(cfg) as smtp:
        if cfg["user"] and cfg["password"]:
            smtp.login(cfg["user"], cfg["password"])
        smtp.sendmail(from_addr, recipients, msg.as_string())

    return f"email-smtp-{to}"


async def send_email_smtp(
    account: dict,
    *,
    to: str,
    subject: str,
    body_html: str,
    cc: str = "",
    bcc: str = "",
    priority: str = "normal",
    request_read_receipt: bool = False,
    attachments: list[dict] | None = None,
) -> str:
    """Async SMTP send — sync smtplib runs in a worker thread (awaitable)."""
    return await asyncio.to_thread(
        _send_email_smtp_sync,
        account,
        to=to,
        subject=subject,
        body_html=body_html,
        cc=cc,
        bcc=bcc,
        priority=priority,
        request_read_receipt=request_read_receipt,
        attachments=attachments,
    )
