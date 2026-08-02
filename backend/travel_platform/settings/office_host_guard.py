"""
Hard lock: Achillio Travel sessions must not run on poreiago.com Host,
and PoreiaGo sessions must not run on achilliotravel.com Host.

Prevents the same driver list appearing on both office URLs when an admin
logs in with Achillio credentials on the PoreiaGo platform domain.
"""

from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

_ACHILLIO_HOST_RE = re.compile(r"(^|\.)achilliotravel\.com$", re.I)


def _roles_include_superadmin(roles: list[str] | None) -> bool:
    return "superadmin" in {str(r).lower() for r in (roles or [])}


def host_looks_like_achillio_travel(host: str) -> bool:
    h = (host or "").strip().lower().split(":")[0]
    h = h.removeprefix("www.")
    return bool(h and _ACHILLIO_HOST_RE.search(h))


async def office_host_mismatch_detail(
    *,
    host: str,
    tenant_id: str,
    roles: list[str] | None,
    is_platform_host: bool,
) -> str | None:
    """
    Return a Greek error detail when Host and JWT office disagree.
    Superadmin may cross hosts (platform ops / impersonation).
    """
    if _roles_include_superadmin(roles):
        return None
    tid = str(tenant_id or "").strip()
    if not tid:
        return None

    try:
        from app.core.database import AsyncSessionLocal
        from app.models.tenant import Tenant
        from app.services.tenant_modules import is_achillio_travel_office
        from sqlalchemy import select
    except Exception:
        logger.debug("office host guard imports failed", exc_info=True)
        return None

    is_achillio_jwt = False
    try:
        from uuid import UUID

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Tenant).where(Tenant.id == UUID(tid)).limit(1))
            tenant = result.scalar_one_or_none()
            is_achillio_jwt = bool(tenant and is_achillio_travel_office(tenant))
    except Exception:
        logger.debug("office host guard tenant lookup failed", exc_info=True)
        return None

    if host_looks_like_achillio_travel(host):
        if not is_achillio_jwt:
            return (
                "Αυτό το URL είναι Achillio Travel — συνδεθείτε με λογαριασμό "
                "Achillio Travel (όχι PoreiaGo)"
            )
        return None

    if is_platform_host and is_achillio_jwt:
        return (
            "Ο λογαριασμός Achillio Travel ανοίγει μόνο από "
            "https://www.achilliotravel.com/admin — όχι από poreiago.com"
        )

    return None


async def login_host_forced_tenant_id(host: str, *, is_platform_host: bool) -> Any | None:
    """When Host is Achillio Travel, force login onto that office tenant."""
    if is_platform_host or not host_looks_like_achillio_travel(host):
        return None
    try:
        from app.core.database import AsyncSessionLocal
        from app.models.tenant import Tenant
        from app.services.tenant_modules import is_achillio_travel_office
        from sqlalchemy import select
    except Exception:
        return None
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Tenant).limit(80))
            for tenant in result.scalars().all():
                if is_achillio_travel_office(tenant):
                    return tenant.id
    except Exception:
        logger.debug("login host tenant resolve failed", exc_info=True)
    return None
