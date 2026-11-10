"""Resolve office tenant_id from Request (JWT / Host / middleware)."""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

from travel_platform.settings.drivers_store import DEMO_TENANT_ID

if TYPE_CHECKING:
    from fastapi import Request


def admin_tenant_id(request: "Request") -> str:
    """Office scope for admin file-backed settings — JWT preferred over Host."""
    from fastapi import HTTPException

    tid = getattr(request.state, "tenant_id", None)
    if tid:
        return str(tid)
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:].strip()
        if token:
            try:
                import jwt
                from middleware.tenant import _jwt_settings

                secret, algorithm, _ = _jwt_settings()
                if secret:
                    payload = jwt.decode(token, secret, algorithms=[algorithm])
                    raw = payload.get("tenant_id")
                    if raw:
                        return str(raw)
            except Exception:
                pass
    env = os.getenv("ENVIRONMENT", "development").lower()
    if env in ("development", "dev", "local", "test"):
        return DEMO_TENANT_ID
    raise HTTPException(status_code=403, detail="tenant_id required")


async def public_tenant_id(request: "Request", *, allow_demo_fallback: bool = True) -> str | None:
    """Host → tenant for public storefront / wallet. Demo only in local/dev."""
    tid = getattr(request.state, "tenant_id", None)
    if tid:
        return str(tid)

    # Only proxy Host headers — never Origin/Referer (client-spoofable office switch).
    hosts: list[str] = []
    for header in ("x-forwarded-host", "host"):
        raw = (request.headers.get(header) or "").strip()
        if not raw:
            continue
        value = raw.split(",")[0].strip()
        if "://" in value:
            try:
                from urllib.parse import urlparse

                value = urlparse(value).hostname or ""
            except Exception:
                value = ""
        value = value.split(":")[0].strip().lower()
        if value and value not in hosts:
            hosts.append(value)

    try:
        from middleware.domain_tenant import _is_platform_host, _resolve_host_cached

        for host in hosts:
            if not host or _is_platform_host(host):
                continue
            resolved = await _resolve_host_cached(host)
            if resolved:
                request.state.tenant_id = resolved.tenant_id
                return str(resolved.tenant_id)
    except Exception:
        pass

    if not allow_demo_fallback:
        return None

    env = os.getenv("ENVIRONMENT", "development").lower()
    if env in ("development", "dev", "local") or os.getenv("ALLOW_DEMO_RENT_FALLBACK", "").lower() in (
        "1",
        "true",
        "yes",
    ):
        return DEMO_TENANT_ID
    return None


def booking_tenant_id(booking: dict | None) -> str | None:
    if not isinstance(booking, dict):
        return None
    raw = booking.get("tenant_id") or booking.get("tenantId")
    if raw is None or raw == "":
        return None
    return str(raw)
