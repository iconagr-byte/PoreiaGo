"""Spam filter for outbound transactional emails + deliverability helpers."""

from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")

# Common disposable / throwaway domains (subset — extend via admin blocklist)
DISPOSABLE_DOMAINS: frozenset[str] = frozenset(
    d.lower()
    for d in (
        "mailinator.com",
        "guerrillamail.com",
        "guerrillamail.net",
        "sharklasers.com",
        "grr.la",
        "yopmail.com",
        "yopmail.fr",
        "tempmail.com",
        "temp-mail.org",
        "10minutemail.com",
        "trashmail.com",
        "getnada.com",
        "dispostable.com",
        "maildrop.cc",
        "fakeinbox.com",
        "throwaway.email",
        "tempail.com",
        "emailondeck.com",
        "mintemail.com",
        "spam4.me",
        "mailnesia.com",
        "mytemp.email",
    )
)

SUSPICIOUS_LOCAL_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"^test\d*@"),
    re.compile(r"^spam"),
    re.compile(r"^noreply@"),
    re.compile(r"^no-reply@"),
)


def _read_spam_settings() -> dict[str, Any]:
    try:
        from travel_platform.settings.payment_settings_store import read_payment_settings

        security = read_payment_settings().get("security") or {}
    except Exception:
        security = {}
    blocked_raw = security.get("blocked_email_domains") or []
    allowed_raw = security.get("allowed_email_domains") or []
    blocked = {
        str(d).strip().lower().lstrip("@")
        for d in blocked_raw
        if str(d).strip()
    }
    allowed = {
        str(d).strip().lower().lstrip("@")
        for d in allowed_raw
        if str(d).strip()
    }
    return {
        "enabled": security.get("email_spam_filter_enabled", True) is not False,
        "block_disposable": security.get("block_disposable_emails", True) is not False,
        "deliverability_headers": security.get("email_deliverability_headers", True) is not False,
        "blocked_domains": blocked,
        "allowed_domains": allowed,
    }


def normalize_email(value: str) -> str:
    return str(value or "").strip().lower()


def extract_domain(email: str) -> str:
    parts = normalize_email(email).rsplit("@", 1)
    return parts[1] if len(parts) == 2 else ""


def check_email_spam_filter(email: str) -> tuple[bool, str]:
    """
    Returns (allowed, reason).
    reason empty when allowed.
    """
    cfg = _read_spam_settings()
    if not cfg["enabled"]:
        return True, ""

    addr = normalize_email(email)
    if not addr or not _EMAIL_RE.match(addr):
        return False, "invalid_email_format"

    domain = extract_domain(addr)
    if not domain:
        return False, "missing_domain"

    local = addr.split("@", 1)[0]
    for pattern in SUSPICIOUS_LOCAL_PATTERNS:
        if pattern.search(local):
            return False, "suspicious_local_part"

    if cfg["allowed_domains"] and domain not in cfg["allowed_domains"]:
        return False, "domain_not_in_allowlist"

    if domain in cfg["blocked_domains"]:
        return False, "domain_blocklisted"

    if cfg["block_disposable"] and domain in DISPOSABLE_DOMAINS:
        return False, "disposable_email_domain"

    return True, ""


def apply_deliverability_headers(msg, *, from_addr: str, to: str, subject: str) -> None:
    """Headers that reduce spam-folder placement for transactional mail."""
    cfg = _read_spam_settings()
    if not cfg.get("deliverability_headers", True):
        return

    from email.utils import formatdate, make_msgid

    from_domain = from_addr.split("@")[-1] if "@" in from_addr else "aerostride.app"
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=from_domain)
    msg["MIME-Version"] = "1.0"
    msg["X-Mailer"] = "AeroStride-Transactional/1.0"
    msg["Auto-Submitted"] = "auto-generated"
    msg["X-Auto-Response-Suppress"] = "All"
    msg["X-Entity-Ref-ID"] = uuid4().hex[:12]
    # Avoid spam-trigger words in headers; subject unchanged
    _ = subject
    _ = to
