#!/usr/bin/env python3
"""Generate Web Push VAPID keys into deploy/ (never print private key to stdout).

Uses cryptography only (no py_vapid dependency) so VPS bootstrap is reliable.
"""

from __future__ import annotations

import base64
import sys
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

DEPLOY_DIR = Path(__file__).resolve().parents[1]
PUBLIC_FILE = DEPLOY_DIR / ".vapid_public.key"
PRIVATE_FILE = DEPLOY_DIR / ".vapid_private.pem"
ENV_FILE = DEPLOY_DIR / ".env.prod"
SUBJECT = "mailto:iconagr@gmail.com"


def _set_env_kv(key: str, value: str) -> None:
    lines: list[str] = []
    if ENV_FILE.exists():
        lines = ENV_FILE.read_text(encoding="utf-8").splitlines()
    out: list[str] = []
    found = False
    prefix = f"{key}="
    for line in lines:
        if line.startswith(prefix):
            out.append(f"{prefix}{value}")
            found = True
        else:
            out.append(line)
    if not found:
        out.append(f"{prefix}{value}")
    ENV_FILE.write_text("\n".join(out).rstrip() + "\n", encoding="utf-8")


def main() -> int:
    if PUBLIC_FILE.exists() and PRIVATE_FILE.exists():
        print(f"VAPID keys already exist in {DEPLOY_DIR}")
        return 0

    private_key = ec.generate_private_key(ec.SECP256R1())
    pub_raw = private_key.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    public_key = base64.urlsafe_b64encode(pub_raw).decode("ascii").rstrip("=")
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("ascii")

    PUBLIC_FILE.write_text(public_key + "\n", encoding="utf-8")
    PRIVATE_FILE.write_text(private_pem, encoding="utf-8")
    try:
        PRIVATE_FILE.chmod(0o600)
    except OSError:
        pass

    if ENV_FILE.exists():
        _set_env_kv("WEB_PUSH_VAPID_PUBLIC_KEY", public_key)
        _set_env_kv("WEB_PUSH_VAPID_PRIVATE_KEY_FILE", "/app/data/vapid_private.pem")
        _set_env_kv("WEB_PUSH_VAPID_SUBJECT", SUBJECT)

    print(f"Created {PUBLIC_FILE.name} and {PRIVATE_FILE.name}")
    print("Updated .env.prod with WEB_PUSH_VAPID_* entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
