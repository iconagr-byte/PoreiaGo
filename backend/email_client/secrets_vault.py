"""Κρυπτογράφηση κωδικών email (Fernet + κλειδί από env)."""

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
        raise RuntimeError(
            "Εγκαταστήστε το cryptography: pip install cryptography"
        )
    secret = (
        os.getenv("EMAIL_ENCRYPTION_KEY", "").strip()
        or os.getenv("CUSTOMER_JWT_SECRET", "").strip()
        or "aerostride-dev-email-key-change-in-production"
    )
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_password(plain: str) -> str:
    if not plain:
        return ""
    return _fernet().encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_password(token: str) -> str:
    if not token:
        return ""
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Αδυναμία αποκρυπτογράφησης κωδικού email") from exc
