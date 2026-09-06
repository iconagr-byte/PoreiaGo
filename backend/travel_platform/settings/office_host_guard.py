"""
Hard lock: Achillio Travel sessions must not manage drivers on poreiago.com,
and PoreiaGo sessions must not manage drivers on achilliotravel.com.

Prevents deleting / listing the same οδηγός across both office URLs.
"""

from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

_ACHILLIO_HOST_RE = re.compile(r"(^|\.)achilliotravel\.com$", re.I)


def _roles_include_superadmin(roles: list[str] | None) -> bool:
    return "superadmin" in {str(r).lower() for r in (roles or [])}


def _normalize_host(host: str) -> str:
    h = (host or "").strip().lower().split(":")[0]
    return h.removeprefix("www.")


def host_looks_like_achillio_travel(host: str) -> bool:
    h = _normalize_host(host)
    return bool(h and _ACHILLIO_HOST_RE.search(h))


def host_is_shared_api(host: str) -> bool:
    """
    Shared API hostname (api.poreiago.com) — not a storefront page.

    Achillio admin often calls the shared API; JWT tenant_id already scopes
    seat-pricing / drivers. Blocking Achillio JWT here caused false
    «Αποτυχία φόρτωσης ρυθμίσεων θέσεων» toasts.
    """
    h = (host or "").strip().lower().split(":")[0]
    if not h:
        return False
    if h.startswith("api.") or h.startswith("api-"):
        return True
    # Traefik internal service names
    if h in ("api-blue", "api-green", "api"):
        return True
    return False


def host_is_platform_marketing(host: str, *, is_platform_host: bool) -> bool:
    """www/apex PoreiaGo pages — not api.* and not Achillio custom domain."""
    if host_is_shared_api(host) or host_looks_like_achillio_travel(host):
        return False
    return bool(is_platform_host)


async def office_host_mismatch_detail(
    *,
    host: str,
    tenant_id: str,
    roles: list[str] | None,
    is_platform_host: bool,
    impersonating: bool = False,
) -> str | None:
    """
    Return a Greek error detail when Host and JWT office disagree.

    Shared API hosts are never blocked (JWT scopes the office).
    Bare Achillio JWT on www.poreiago.com storefront/admin is blocked.
    """
    tid = str(tenant_id or "").strip()
    if not tid:
        return None

    # Shared API — do not treat as PoreiaGo marketing host.
    if host_is_shared_api(host):
        return None

    try:
        from uuid import UUID

        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.models.tenant import Tenant
        from app.services.tenant_modules import is_achillio_travel_office
    except Exception:
        logger.debug("office host guard imports failed", exc_info=True)
        return None

    is_achillio_jwt = False
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Tenant).where(Tenant.id == UUID(tid)).limit(1))
            tenant = result.scalar_one_or_none()
            is_achillio_jwt = bool(tenant and is_achillio_travel_office(tenant))
    except Exception:
        logger.debug("office host guard tenant lookup failed", exc_info=True)
        return None

    if host_looks_like_achillio_travel(host):
        if not is_achillio_jwt and not (impersonating and _roles_include_superadmin(roles)):
            return (
                "Αυτό το URL είναι Achillio Travel — συνδεθείτε με λογαριασμό "
                "Achillio Travel (όχι PoreiaGo)"
            )
        return None

    if host_is_platform_marketing(host, is_platform_host=is_platform_host) and is_achillio_jwt and not impersonating:
        return (
            "Ο λογαριασμός Achillio Travel ανοίγει μόνο από "
            "https://www.achilliotravel.com/admin — όχι από poreiago.com. "
            "Οι δοκιμές οδηγών στο PoreiaGo είναι ξεχωριστό γραφείο."
        )

    return None


async def login_host_forced_tenant_id(host: str, *, is_platform_host: bool) -> Any | None:
    """When Host is Achillio Travel, force login onto that office tenant.

    Creates the canonical ``admin-achillio-gr`` office if Contabo only has the
    PoreiaGo seed slug=``achillio`` (which is NOT Achillio Travel).
    """
    if is_platform_host or not host_looks_like_achillio_travel(host):
        return None
    try:
        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.models.tenant import Tenant
        from app.services.tenant_modules import (
            ensure_achillio_travel_office,
            is_achillio_travel_office,
        )
    except Exception:
        return None

    async def _find(db: Any) -> Any | None:
        result = await db.execute(select(Tenant).limit(120))
        for tenant in result.scalars().all():
            if is_achillio_travel_office(tenant):
                return tenant.id
        return None

    try:
        async with AsyncSessionLocal() as db:
            found = await _find(db)
            if found is not None:
                return found
            try:
                await ensure_achillio_travel_office(db)
            except Exception:
                logger.exception("ensure_achillio_travel_office during host login failed")
                return None
            return await _find(db)
    except Exception:
        logger.debug("login host tenant resolve failed", exc_info=True)
    return None


async def resolve_poreiago_platform_tenant_id() -> str | None:
    """UUID of the PoreiaGo platform / demo office (not Achillio Travel)."""
    try:
        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.models.tenant import Tenant
        from app.services.tenant_modules import is_poreiago_platform_office
    except Exception:
        return None
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Tenant).limit(80))
            for tenant in result.scalars().all():
                if is_poreiago_platform_office(tenant):
                    return str(tenant.id)
    except Exception:
        logger.debug("PoreiaGo platform tenant resolve failed", exc_info=True)
    return None
