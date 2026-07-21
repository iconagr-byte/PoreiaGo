"""
Master QR — Postgres (SaaS) when available, else file-backed local store.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any
from uuid import UUID

import jwt
from sqlalchemy import text

from travel_platform.operations.master_qr_local import (
    DEFAULT_TENANT,
    _secret as local_secret,
    _unwrap as unwrap_qr,
    exchange_master_qr as exchange_local,
    issue_master_qr as issue_local,
)

logger = logging.getLogger(__name__)

_DB_CACHE: tuple[float, bool] | None = None
_DB_CACHE_TTL_SEC = 30


def default_tenant_id() -> str:
    return (
        os.getenv("SAAS_DEFAULT_TENANT_ID")
        or os.getenv("DEFAULT_TENANT_ID")
        or DEFAULT_TENANT
    )


_PLATFORM_TENANT_CACHE: tuple[float, str] | None = None
_PLATFORM_TENANT_CACHE_TTL_SEC = 60


async def resolve_platform_tenant_id() -> str:
    """
    Tenant UUID that admin JWT / live map use for the default agency.

    Env wins when set; otherwise look up DEFAULT_TENANT_SLUG (achillio) in Postgres.
    Falls back to the local demo UUID only when DB is unavailable.
    """
    global _PLATFORM_TENANT_CACHE
    now = time.time()
    if _PLATFORM_TENANT_CACHE and now - _PLATFORM_TENANT_CACHE[0] < _PLATFORM_TENANT_CACHE_TTL_SEC:
        return _PLATFORM_TENANT_CACHE[1]

    env = (
        os.getenv("SAAS_DEFAULT_TENANT_ID")
        or os.getenv("DEFAULT_TENANT_ID")
        or ""
    ).strip()
    if env:
        _PLATFORM_TENANT_CACHE = (now, env)
        return env

    tid = DEFAULT_TENANT
    slug = (os.getenv("DEFAULT_TENANT_SLUG") or "achillio").strip().lower()
    try:
        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.models.tenant import Tenant

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Tenant).where(Tenant.slug == slug).limit(1))
            tenant = result.scalar_one_or_none()
            if tenant:
                tid = str(tenant.id)
    except Exception as exc:
        logger.debug("resolve_platform_tenant_id DB lookup failed: %s", exc)

    _PLATFORM_TENANT_CACHE = (now, tid)
    return tid


def coerce_driver_tenant_id(raw: str | None, *, platform_tenant_id: str) -> str:
    """
    Map legacy demo-tenant driver sessions onto the real SaaS tenant so GPS
    appears on the admin live map (password login used to hardcode …0001).
    """
    tid = (raw or "").strip()
    if not tid or tid == DEFAULT_TENANT:
        return platform_tenant_id or DEFAULT_TENANT
    return tid


async def saas_db_available() -> bool:
    """True when Postgres is reachable and platform schema (master_qr_tokens) exists."""
    global _DB_CACHE
    now = time.time()
    if _DB_CACHE and now - _DB_CACHE[0] < _DB_CACHE_TTL_SEC:
        return _DB_CACHE[1]

    ok = False
    try:
        from database import engine

        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM master_qr_tokens LIMIT 1"))
        ok = True
    except Exception as exc:
        logger.debug("SaaS DB not available for Master QR: %s", exc)

    _DB_CACHE = (now, ok)
    return ok


def preview_master_qr_payload(qr_raw: str, *, verify_exp: bool = True) -> dict[str, Any] | None:
    from travel_platform.operations.master_qr_normalize import normalize_master_qr_input

    token = unwrap_qr(normalize_master_qr_input(qr_raw))
    secret = (
        os.getenv("MASTER_QR_SECRET")
        or os.getenv("TICKET_JWT_SECRET")
        or os.getenv("AUTH_JWT_SECRET")
        or local_secret()
    )
    try:
        options = {} if verify_exp else {"verify_exp": False}
        return jwt.decode(token, secret, algorithms=["HS256"], options=options)
    except jwt.PyJWTError:
        return None


async def issue_master_qr_hybrid(
    trip_id: int,
    *,
    driver_id: str | None = None,
    tenant_id: str | None = None,
) -> dict[str, Any]:
    tid = tenant_id or default_tenant_id()

    if await saas_db_available():
        try:
            from database import AsyncSessionLocal
            from middleware.tenant import apply_tenant_to_session
            from travel_platform.operations.master_qr import MasterQrService

            async with AsyncSessionLocal() as session:
                uid = UUID(tid)
                await apply_tenant_to_session(session, uid)
                svc = MasterQrService(session, uid)
                payload = await svc.issue_for_trip(trip_id, driver_id=driver_id)
                await session.commit()
                return {
                    "qr_content": payload.auth_url,
                    "qr_token": payload.qr_token,
                    "auth_url": payload.auth_url,
                    "trip_id": payload.trip_id,
                    "tenant_id": str(payload.tenant_id),
                    "expires_at": int(payload.expires_at.timestamp()),
                    "manifest_url": payload.manifest_url,
                    "source": "postgres",
                }
        except Exception as exc:
            logger.info(
                "Master QR Postgres issue failed (trip_id=%s), using local: %s",
                trip_id,
                exc,
            )

    result = issue_local(trip_id, driver_id=driver_id, tenant_id=tid)
    result["source"] = "local"
    return result


async def exchange_master_qr_hybrid(qr_raw: str) -> dict[str, Any] | None:
    """
    Exchange Master QR for driver session.
    Postgres first (production tokens), then local JSON store.
    """
    preview = preview_master_qr_payload(qr_raw, verify_exp=True)
    if not preview or preview.get("typ") != "master_qr":
        return None

    tid = str(preview.get("tenant_id") or default_tenant_id())

    if await saas_db_available():
        try:
            from database import AsyncSessionLocal
            from middleware.tenant import apply_tenant_to_session
            from travel_platform.operations.master_qr import MasterQrService

            async with AsyncSessionLocal() as session:
                uid = UUID(tid)
                await apply_tenant_to_session(session, uid)
                svc = MasterQrService(session, uid)
                result = await svc.exchange_for_driver_session(qr_raw)
                await session.commit()
                return {
                    "access_token": result["access_token"],
                    "trip_id": int(result["trip_id"]),
                    "tenant_id": tid,
                    "driver_id": preview.get("driver_id"),
                    "expires_at": int(preview.get("exp", 0)),
                    "source": "postgres",
                }
        except Exception as exc:
            logger.debug("Master QR Postgres exchange failed, trying local: %s", exc)

    local = exchange_local(qr_raw)
    if local:
        local["source"] = "local"
    return local
