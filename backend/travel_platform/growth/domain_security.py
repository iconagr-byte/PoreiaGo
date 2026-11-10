"""Security helpers for custom-domain APIs (tenant ownership + reserved hosts)."""

from __future__ import annotations

import re
import time
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant

_DOMAIN_RE = re.compile(
    r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$",
    re.IGNORECASE,
)

_RESERVED_SUFFIXES = (
    "poreiago.com",
    "olympus-saas.com",
    "localhost",
    "localtest.me",
    "nip.io",
    "sslip.io",
)

# Simple per-process rate limit: tenant_id → last timestamps
_RATE: dict[str, list[float]] = {}
_RATE_WINDOW_SEC = 60.0
_RATE_MAX = 12


def normalize_apex(value: str | None) -> str:
    if not value:
        return ""
    host = value.strip().lower().removeprefix("https://").removeprefix("http://")
    host = host.split("/")[0].split(":")[0].removeprefix("www.")
    return host


def is_valid_public_domain(domain: str) -> bool:
    host = normalize_apex(domain)
    if not host or not _DOMAIN_RE.match(host):
        return False
    if any(c.isdigit() for c in host.split(".")[0]) and host.replace(".", "").isdigit():
        return False
    for reserved in _RESERVED_SUFFIXES:
        if host == reserved or host.endswith("." + reserved):
            return False
    # Block obvious internal / IP-like hosts
    if host.endswith(".internal") or host.endswith(".local") or host.endswith(".lan"):
        return False
    labels = host.split(".")
    if len(labels) < 2:
        return False
    return True


def is_reserved_platform_domain(domain: str) -> bool:
    host = normalize_apex(domain)
    return bool(host) and not is_valid_public_domain(host) and bool(_DOMAIN_RE.match(host))


def enforce_rate_limit(key: str, *, max_calls: int = _RATE_MAX, window: float = _RATE_WINDOW_SEC) -> bool:
    """Return True if allowed; False if rate exceeded."""
    now = time.monotonic()
    bucket = _RATE.setdefault(key, [])
    _RATE[key] = [t for t in bucket if now - t < window]
    if len(_RATE[key]) >= max_calls:
        return False
    _RATE[key].append(now)
    return True


async def load_tenant_custom_domain(session: AsyncSession, tenant_id: UUID) -> str:
    result = await session.execute(select(Tenant.custom_domain).where(Tenant.id == tenant_id).limit(1))
    raw = result.scalar_one_or_none()
    return normalize_apex(str(raw or ""))


def assert_domain_owned_by_tenant(requested: str | None, owned: str) -> str:
    """
    Tenant APIs may only inspect/provision the office's saved custom_domain.
    Empty owned → no domain configured yet.
    """
    owned_apex = normalize_apex(owned)
    if not owned_apex:
        raise PermissionError("Δεν έχει οριστεί custom domain για αυτό το γραφείο. Αποθήκευσέ το πρώτα.")
    req = normalize_apex(requested) if requested else owned_apex
    if req != owned_apex:
        raise PermissionError("Επιτρέπεται έλεγχος μόνο για το domain του δικού σας γραφείου.")
    return owned_apex


def sanitize_edge_status(*, owned_domain: str, npm_result: dict[str, Any] | None = None) -> dict[str, Any]:
    """Strip cross-tenant lists and verbose NPM/edge internals from API responses."""
    npm = npm_result or {}
    safe_npm = {
        "ok": bool(npm.get("ok")),
        "skipped": bool(npm.get("skipped")),
        "www": npm.get("www") if npm.get("www") == f"www.{owned_domain}" else None,
        "redirect_ok": bool(npm.get("redirect_ok")) if "redirect_ok" in npm else None,
    }
    if npm.get("skipped") and npm.get("reason"):
        safe_npm["reason"] = str(npm.get("reason"))[:64]
    if npm.get("ok") is False and npm.get("error"):
        # Generic client-facing error — no upstream body dumps.
        safe_npm["error"] = "edge_provision_failed"
    return {
        "domain": owned_domain,
        "traefik_synced": True,
        "nginx_map_synced": True,
        "npm": safe_npm,
    }
