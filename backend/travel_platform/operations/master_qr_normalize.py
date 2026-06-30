"""Normalize Master QR input — raw token, mq1. prefix, or magic-link URL."""

from __future__ import annotations

import os
from urllib.parse import parse_qs, urlparse


def driver_app_public_base() -> str:
    return (
        os.getenv("DRIVER_APP_PUBLIC_URL")
        or os.getenv("FRONTEND_PUBLIC_URL")
        or os.getenv("VITE_APP_ORIGIN")
        or "http://localhost:5173"
    ).rstrip("/")


def build_driver_auth_url(token: str, *, base_url: str | None = None) -> str:
    """Magic link for driver PWA: /driver/auth?token=…"""
    base = (base_url or driver_app_public_base()).rstrip("/")
    from urllib.parse import quote

    return f"{base}/driver/auth?token={quote(token.strip(), safe='')}"


def normalize_master_qr_input(raw: str) -> str:
    """
    Accept mq1.JWT, bare JWT, or https://…/driver/auth?token=….
    Returns the string to pass to unwrap (may still have mq1. prefix).
    """
    text = (raw or "").strip()
    if not text:
        return text

    if text.startswith("http://") or text.startswith("https://"):
        parsed = urlparse(text)
        params = parse_qs(parsed.query)
        tokens = params.get("token") or params.get("t")
        if tokens and tokens[0]:
            return tokens[0].strip()

    return text
