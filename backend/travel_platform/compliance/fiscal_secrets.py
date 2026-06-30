"""Decrypt tenant fiscal provider secrets stored in settings_json."""

from __future__ import annotations

import base64
import hashlib
import os

try:
    from cryptography.fernet import Fernet, InvalidToken
except ImportError:  # pragma: no cover
    Fernet = None  # type: ignore
    InvalidToken = Exception  # type: ignore


def _fernet() -> "Fernet":
    if Fernet is None:
        raise RuntimeError("cryptography package required for fiscal secret decryption")
    secret = (
        os.getenv("FISCAL_ENCRYPTION_KEY", "").strip()
        or os.getenv("EMAIL_ENCRYPTION_KEY", "").strip()
        or os.getenv("AUTH_JWT_SECRET", "").strip()
        or "aerostride-dev-fiscal-key-change-in-production"
    )
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def decrypt_fiscal_secret(token: str) -> str:
    if not token:
        return ""
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt fiscal provider secret") from exc


def encrypt_fiscal_secret(plain: str) -> str:
    if not plain:
        return ""
    return f"enc:{_fernet().encrypt(plain.encode('utf-8')).decode('ascii')}"
