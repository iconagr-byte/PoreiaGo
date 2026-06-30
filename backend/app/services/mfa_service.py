"""TOTP MFA via pyotp — enrollment, verification, backup codes stub."""

from __future__ import annotations

import base64
import hashlib
import secrets
from typing import NamedTuple

import pyotp

from app.core.config import get_settings


class MfaEnrollment(NamedTuple):
    secret: str
    provisioning_uri: str
    qr_ready_uri: str


class MfaService:
    def __init__(self) -> None:
        self._settings = get_settings()

    def generate_secret(self) -> str:
        return pyotp.random_base32()

    def enroll(self, *, user_email: str, secret: str | None = None) -> MfaEnrollment:
        secret = secret or self.generate_secret()
        totp = pyotp.TOTP(secret)
        uri = totp.provisioning_uri(name=user_email, issuer_name=self._settings.mfa_issuer_name)
        return MfaEnrollment(secret=secret, provisioning_uri=uri, qr_ready_uri=uri)

    def verify(self, secret: str, code: str, *, valid_window: int = 1) -> bool:
        if not secret or not code:
            return False
        totp = pyotp.TOTP(secret)
        return totp.verify(code.strip().replace(" ", ""), valid_window=valid_window)

    @staticmethod
    def encrypt_secret_for_storage(plain_secret: str, *, pepper: str) -> str:
        """Lightweight obfuscation — use KMS/Vault envelope encryption in production."""
        digest = hashlib.sha256(f"{pepper}:{plain_secret}".encode()).digest()
        payload = base64.urlsafe_b64encode(plain_secret.encode() + digest[:8])
        return payload.decode()

    @staticmethod
    def decrypt_secret_from_storage(blob: str, *, pepper: str) -> str:
        raw = base64.urlsafe_b64decode(blob.encode())
        plain = raw[:-8].decode()
        digest = hashlib.sha256(f"{pepper}:{plain}".encode()).digest()
        if raw[-8:] != digest[:8]:
            raise ValueError("MFA secret integrity check failed")
        return plain

    @staticmethod
    def generate_backup_codes(count: int = 8) -> list[str]:
        return [secrets.token_hex(4).upper() for _ in range(count)]
