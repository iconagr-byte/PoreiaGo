"""Master QR — file-backed issue/exchange (demo without Postgres trips table)."""

from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

import jwt

from travel_platform.operations.master_qr_normalize import build_driver_auth_url

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
STORE_PATH = DATA_DIR / "master_qr_tokens.json"

DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001"


def _secret() -> str:
    return (
        os.getenv("MASTER_QR_SECRET")
        or os.getenv("TICKET_JWT_SECRET")
        or os.getenv("AUTH_JWT_SECRET")
        or "dev-jwt-secret-change-in-prod"
    )


def _ttl_hours() -> int:
    try:
        from travel_platform.settings.platform_store import get_platform_config

        return int(get_platform_config().master_qr_ttl_hours)
    except Exception:
        return int(os.getenv("MASTER_QR_TTL_HOURS", "24"))


def _load() -> list[dict[str, Any]]:
    if not STORE_PATH.exists():
        return []
    try:
        return json.loads(STORE_PATH.read_text(encoding="utf-8")).get("tokens", [])
    except (json.JSONDecodeError, TypeError):
        return []


def _save(tokens: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    STORE_PATH.write_text(json.dumps({"tokens": tokens}, indent=2), encoding="utf-8")


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _unwrap(raw: str) -> str:
    raw = raw.strip()
    return raw[4:] if raw.startswith("mq1.") else raw


def issue_master_qr(
    trip_id: int,
    *,
    driver_id: str | None = None,
    tenant_id: str | None = None,
) -> dict[str, Any]:
    tid = tenant_id or DEFAULT_TENANT
    exp_ts = int(time.time()) + _ttl_hours() * 3600
    payload = {
        "typ": "master_qr",
        "tenant_id": tid,
        "trip_id": trip_id,
        "driver_id": driver_id,
        "scope": "manifest:read driver:scan",
        "iat": int(time.time()),
        "exp": exp_ts,
    }
    token = jwt.encode(payload, _secret(), algorithm="HS256")
    qr_token = f"mq1.{token}"
    auth_url = build_driver_auth_url(qr_token)
    token_hash = _hash(token)

    tokens = _load()
    tokens = [t for t in tokens if not (t.get("trip_id") == trip_id and t.get("tenant_id") == tid)]
    tokens.append(
        {
            "trip_id": trip_id,
            "tenant_id": tid,
            "token_hash": token_hash,
            "expires_at": exp_ts,
            "revoked": False,
            "issued_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    _save(tokens)

    return {
        "qr_content": auth_url,
        "qr_token": qr_token,
        "auth_url": auth_url,
        "trip_id": trip_id,
        "tenant_id": tid,
        "driver_id": driver_id,
        "expires_at": exp_ts,
        "manifest_url": f"/admin/boarding/{trip_id}",
    }


def exchange_master_qr(qr_raw: str) -> dict[str, Any] | None:
    from travel_platform.operations.master_qr_normalize import normalize_master_qr_input

    token = _unwrap(normalize_master_qr_input(qr_raw))
    try:
        payload = jwt.decode(token, _secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return None

    if payload.get("typ") != "master_qr":
        return None

    token_hash = _hash(token)
    tokens = _load()
    active = next(
        (
            t
            for t in tokens
            if t.get("token_hash") == token_hash
            and not t.get("revoked")
            and t.get("expires_at", 0) > time.time()
        ),
        None,
    )
    if not active:
        return None

    trip_id = int(payload["trip_id"])
    tenant_id = str(payload.get("tenant_id", DEFAULT_TENANT))
    exp = int(payload["exp"])
    driver_jwt = jwt.encode(
        {
            "sub": payload.get("driver_id") or "master-qr-driver",
            "tenant_id": tenant_id,
            "trip_id": trip_id,
            "roles": ["driver"],
            "scope": "manifest:read driver:scan",
            "exp": exp,
        },
        _secret(),
        algorithm="HS256",
    )
    return {
        "access_token": driver_jwt,
        "trip_id": trip_id,
        "tenant_id": tenant_id,
        "driver_id": payload.get("driver_id"),
        "expires_at": exp,
    }
