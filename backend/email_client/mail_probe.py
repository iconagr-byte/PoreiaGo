"""IMAP/SMTP connection probe for cPanel mailboxes.

Fresh implementation so AUTH failures are diagnosable:
- TCP open vs timeout
- AUTH mechanisms offered
- egress public IP (for hosting whitelist)
- raw server reply (never the password)
"""

from __future__ import annotations

import imaplib
import logging
import smtplib
import socket
import ssl
import urllib.error
import urllib.request
from typing import Any

logger = logging.getLogger(__name__)

PROBE_TIMEOUT_SEC = 20
_EGRESS_IP_CACHE: str | None = None


def probe_tcp(host: str, port: int, *, timeout: float = 8.0) -> dict[str, Any]:
    host = (host or "").strip()
    out: dict[str, Any] = {
        "host": host,
        "port": int(port),
        "ok": False,
        "error": None,
        "peer_ip": None,
    }
    if not host:
        out["error"] = "empty host"
        return out
    try:
        infos = socket.getaddrinfo(host, int(port), socket.AF_INET, socket.SOCK_STREAM)
        peer = infos[0][4][0] if infos else host
        out["peer_ip"] = peer
        with socket.create_connection((peer, int(port)), timeout=timeout):
            out["ok"] = True
    except OSError as exc:
        out["error"] = f"{type(exc).__name__}: {exc}"
    return out


def discover_egress_ip(*, timeout: float = 5.0) -> str:
    """Public IPv4 seen by the internet — what hosting must whitelist for remote AUTH."""
    global _EGRESS_IP_CACHE
    if _EGRESS_IP_CACHE:
        return _EGRESS_IP_CACHE
    for url in (
        "https://api.ipify.org",
        "https://ifconfig.me/ip",
        "https://icanhazip.com",
    ):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                ip = resp.read().decode("ascii", errors="ignore").strip()
            if ip and ip.count(".") == 3 and all(p.isdigit() for p in ip.split(".")):
                _EGRESS_IP_CACHE = ip
                return ip
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
            logger.debug("egress ip via %s failed: %s", url, exc)
    return ""


def _ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    # Shared cPanel certs often omit mail.customer-domain.
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _resolve_ipv4(host: str) -> str:
    try:
        infos = socket.getaddrinfo(host, None, socket.AF_INET, socket.SOCK_STREAM)
        if infos:
            return infos[0][4][0]
    except OSError:
        pass
    return host


def safe_server_reply(exc: BaseException | str, *, limit: int = 240) -> str:
    raw = str(exc).strip()
    if raw.startswith("b'") and raw.endswith("'"):
        raw = raw[2:-1]
    elif raw.startswith('b"') and raw.endswith('"'):
        raw = raw[2:-1]
    raw = raw.replace("\n", " ").replace("\r", " ")
    if len(raw) > limit:
        return raw[: limit - 1] + "…"
    return raw


def probe_imap_login(cfg: dict[str, Any]) -> dict[str, Any]:
    """IMAP SSL/plain login probe. cfg: host, port, user, password, use_ssl."""
    host = (cfg.get("host") or "").strip()
    port = int(cfg.get("port") or (993 if cfg.get("use_ssl", True) else 143))
    user = cfg.get("user") or ""
    password = cfg.get("password") or ""
    use_ssl = bool(cfg.get("use_ssl", True))
    timeout = float(cfg.get("timeout") or PROBE_TIMEOUT_SEC)
    mailbox = cfg.get("imap_mailbox") or "INBOX"

    tcp = probe_tcp(host, port, timeout=min(8.0, timeout))
    result: dict[str, Any] = {
        "ok": False,
        "tcp_ok": bool(tcp.get("ok")),
        "tcp_error": tcp.get("error"),
        "peer_ip": tcp.get("peer_ip"),
        "auth_mechs": None,
        "server_reply": None,
        "error": None,
        "message": None,
    }
    if not tcp.get("ok"):
        result["error"] = tcp.get("error") or "TCP failed"
        return result

    client: imaplib.IMAP4 | imaplib.IMAP4_SSL | None = None
    try:
        ipv4 = _resolve_ipv4(host)
        if use_ssl:
            client = imaplib.IMAP4_SSL(
                ipv4, port, ssl_context=_ssl_context(), timeout=timeout
            )
        else:
            client = imaplib.IMAP4(ipv4, port, timeout=timeout)
            try:
                client.starttls(ssl_context=_ssl_context())
            except Exception:
                pass

        try:
            typ, data = client.capability()
            if typ == "OK" and data:
                caps = b" ".join(data).decode("utf-8", errors="replace")
                mechs = [p[5:] for p in caps.split() if p.startswith("AUTH=")]
                result["auth_mechs"] = " ".join(mechs) if mechs else caps[:120]
        except Exception as exc:
            result["auth_mechs"] = f"capability-error: {type(exc).__name__}"

        if hasattr(client, "_mode_utf8"):
            try:
                client._mode_utf8()
            except Exception:
                pass
        elif hasattr(client, "_encoding"):
            client._encoding = "utf-8"

        client.login(user, password)
        client.select(mailbox, readonly=True)
        result["ok"] = True
        result["message"] = "IMAP σύνδεση επιτυχής"
        try:
            client.logout()
        except Exception:
            pass
        return result
    except Exception as exc:
        result["server_reply"] = safe_server_reply(exc)
        result["error"] = exc
        try:
            if client is not None:
                client.shutdown()
        except Exception:
            pass
        return result


def probe_smtp_login(cfg: dict[str, Any]) -> dict[str, Any]:
    """SMTP SSL (465) or STARTTLS (587) login probe."""
    host = (cfg.get("host") or "").strip()
    port = int(cfg.get("port") or 587)
    user = cfg.get("user") or ""
    password = cfg.get("password") or ""
    use_ssl = bool(cfg.get("use_ssl")) or port == 465
    use_tls = (not use_ssl) and bool(cfg.get("use_tls", True))
    timeout = float(cfg.get("timeout") or PROBE_TIMEOUT_SEC)

    tcp = probe_tcp(host, port, timeout=min(8.0, timeout))
    result: dict[str, Any] = {
        "ok": False,
        "tcp_ok": bool(tcp.get("ok")),
        "tcp_error": tcp.get("error"),
        "peer_ip": tcp.get("peer_ip"),
        "auth_mechs": None,
        "server_reply": None,
        "error": None,
        "message": None,
    }
    if not tcp.get("ok"):
        result["error"] = tcp.get("error") or "TCP failed"
        return result

    smtp: smtplib.SMTP | None = None
    try:
        if use_ssl:
            smtp = smtplib.SMTP_SSL(
                host, port, timeout=timeout, context=_ssl_context()
            )
        else:
            smtp = smtplib.SMTP(host, port, timeout=timeout)
            smtp.ehlo()
            if use_tls:
                smtp.starttls(context=_ssl_context())
                smtp.ehlo()

        auth = (smtp.esmtp_features or {}).get("auth")
        result["auth_mechs"] = auth if auth is not None else None

        smtp.login(user, password)
        result["ok"] = True
        result["message"] = "SMTP σύνδεση επιτυχής"
        try:
            smtp.quit()
        except Exception:
            pass
        return result
    except Exception as exc:
        result["server_reply"] = safe_server_reply(exc)
        result["error"] = exc
        try:
            if smtp is not None:
                smtp.close()
        except Exception:
            pass
        return result
