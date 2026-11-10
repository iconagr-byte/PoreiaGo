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
    Tenant UUID that admin JWT / live map / driver GPS remap use.

    This is the **PoreiaGo platform / demo office** — never Achillio Travel
    (admin-achillio-gr / achilliotravel.com).

    Priority:
    1. SAAS_DEFAULT_TENANT_ID / DEFAULT_TENANT_ID env
    2. ``resolve_poreiago_platform_tenant_id()`` (classifier: slug achillio/poreiago)
    3. Explicit PLATFORM_CUSTOM_DOMAINS (must NOT default to achilliotravel.com)
    4. DEFAULT_TENANT_SLUG (default: achillio = historic PoreiaGo seed)
    5. Local demo UUID when DB is unavailable
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
    # Never default to achilliotravel.com — that domain is Achillio Travel office.
    domain_csv = (os.getenv("PLATFORM_CUSTOM_DOMAINS") or "poreiago.com").strip()
    preferred_domains = [
        d.strip().lower().removeprefix("www.")
        for d in domain_csv.split(",")
        if d.strip() and "achilliotravel.com" not in d.strip().lower()
    ]
    try:
        from sqlalchemy import or_, select

        from app.core.database import AsyncSessionLocal
        from app.models.tenant import Tenant
        from app.services.tenant_modules import (
            is_achillio_travel_office,
            is_poreiago_platform_office,
        )
        from travel_platform.settings.office_host_guard import (
            resolve_poreiago_platform_tenant_id,
        )

        # Prefer the classifier-backed PoreiaGo office (never Achillio Travel).
        platform_tid = await resolve_poreiago_platform_tenant_id()
        if platform_tid:
            _PLATFORM_TENANT_CACHE = (now, platform_tid)
            return platform_tid

        async with AsyncSessionLocal() as db:
            for apex in preferred_domains:
                result = await db.execute(
                    select(Tenant)
                    .where(
                        or_(
                            Tenant.custom_domain == apex,
                            Tenant.custom_domain == f"www.{apex}",
                        ),
                    )
                    .limit(1),
                )
                tenant = result.scalar_one_or_none()
                if tenant and is_poreiago_platform_office(tenant) and not is_achillio_travel_office(
                    tenant
                ):
                    tid = str(tenant.id)
                    logger.info(
                        "resolve_platform_tenant_id via custom_domain=%s → %s (%s)",
                        apex,
                        tid,
                        tenant.slug,
                    )
                    break
            else:
                result = await db.execute(select(Tenant).where(Tenant.slug == slug).limit(1))
                tenant = result.scalar_one_or_none()
                if tenant and not is_achillio_travel_office(tenant):
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
    # Prefer explicit office tenant, else the real SaaS platform tenant (never
    # silently stick to the legacy …0001 demo UUID when Postgres has achillio).
    tid = (tenant_id or "").strip() or await resolve_platform_tenant_id()
    if tid == DEFAULT_TENANT:
        platform = await resolve_platform_tenant_id()
        if platform and platform != DEFAULT_TENANT:
            tid = platform

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
    Always remaps legacy demo tenant onto the live SaaS tenant so GPS lands
    on the office live map.
    """
    preview = preview_master_qr_payload(qr_raw, verify_exp=True)
    if not preview or preview.get("typ") != "master_qr":
        return None

    platform_tid = await resolve_platform_tenant_id()
    raw_tid = str(preview.get("tenant_id") or default_tenant_id())
    tid = coerce_driver_tenant_id(raw_tid, platform_tenant_id=platform_tid)

    if await saas_db_available():
        try:
            from database import AsyncSessionLocal
            from middleware.tenant import apply_tenant_to_session
            from travel_platform.operations.master_qr import MasterQrService

            # Try remapped tenant first, then the tenant embedded in the QR.
            for attempt_tid in dict.fromkeys([tid, raw_tid]):
                try:
                    async with AsyncSessionLocal() as session:
                        uid = UUID(attempt_tid)
                        await apply_tenant_to_session(session, uid)
                        svc = MasterQrService(session, uid)
                        result = await svc.exchange_for_driver_session(qr_raw)
                        await session.commit()
                        return {
                            "access_token": result["access_token"],
                            "trip_id": int(result["trip_id"]),
                            "tenant_id": tid,
                            "driver_id": preview.get("driver_id") or result.get("driver_id"),
                            "expires_at": int(preview.get("exp", 0)),
                            "source": "postgres",
                        }
                except Exception:
                    continue
        except Exception as exc:
            logger.debug("Master QR Postgres exchange failed, trying local: %s", exc)

    local = exchange_local(qr_raw)
    if local:
        local["tenant_id"] = tid
        local["source"] = "local"
    return local
