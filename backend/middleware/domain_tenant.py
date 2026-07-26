"""
Host-based tenant resolution + white-label theme binding.

Runs early in middleware stack — before JWT for public storefront routes.
Returns 404 for unmapped custom domains (no tenant leakage).

Performance:
- Host→tenant lookups are cached (TTL) so custom-domain admin pages do not
  open Postgres on every /api/admin/* request.
- When Authorization: Bearer is present on JWT-scoped APIs, tenant_id is taken
  from the token and the Host DB lookup is skipped entirely.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.database import AsyncSessionLocal
from olympus.config import get_olympus_settings
from olympus.security.ip_whitelist import enforce_admin_ip_whitelist
from olympus.tenant.domain_resolver import DomainResolver, ResolvedTenant, normalize_host

logger = logging.getLogger(__name__)

PUBLIC_HOST_PATHS = (
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/api/site/",
    "/api/branding/",
    "/api/v1/health",
    "/api/v1/platform/tls/",
    "/api/v1/billing/webhook",
    "/api/v1/payments/webhook",
    "/api/v1/billing/signup-checkout",
    "/api/v1/billing/config",
    "/api/v1/aade/webhook",
    "/api/v1/auth/login",
    "/api/v1/auth/dev-login",
    "/api/v1/bookings/guest",
    "/api/v1/bookings/lookup",
    "/api/v1/telemetry/update",
)

# APIs that scope tenant via JWT / body — must not hard-fail on Host lookup.
# Includes B2C My Wallet (/api/auth, /api/customer) which was incorrectly blocked
# with «Domain not registered with PoreiaGo» on custom domains + www.poreiago.com.
JWT_SCOPED_PREFIXES = (
    "/api/v1/",
    "/api/admin/",
    "/api/driver/",
    "/api/auth/",
    "/api/customer/",
    "/api/lost-items",
    "/api/bookings",
    "/api/push/",
    "/api/expenses/",
    "/api/passenger/",
    "/ws/",  # driver GPS ingress, office egress, passenger ETA (JWT / trip scoped)
)

# Host → (monotonic_ts, ResolvedTenant | None)
_HOST_RESOLVE_CACHE: dict[str, tuple[float, ResolvedTenant | None]] = {}
_HOST_RESOLVE_TTL_SEC = float(os.getenv("DOMAIN_RESOLVE_CACHE_TTL_SEC", "300") or "300")


def clear_host_resolve_cache() -> None:
    """Test / ops helper — drop cached Host→tenant mappings."""
    _HOST_RESOLVE_CACHE.clear()


def _request_host(request: Request) -> str:
    """Prefer public hostname (X-Forwarded-Host) when nginx/Traefik proxies to the API."""
    forwarded = request.headers.get("x-forwarded-host") or ""
    # X-Forwarded-Host may be a comma-separated list — take the first.
    if forwarded:
        return normalize_host(forwarded.split(",")[0])
    return normalize_host(request.headers.get("host"))


def _is_platform_host(host: str) -> bool:
    if not host:
        return True
    if host in ("localhost", "127.0.0.1", "api.localhost"):
        return True
    base = (get_olympus_settings().get("base_domain") or "poreiago.com").lower().strip()
    if host == base or host == f"www.{base}" or host == f"api.{base}":
        return True
    if host.endswith(f".{base}"):
        sub = host[: -(len(base) + 1)]
        if sub in ("www", "api", "admin"):
            return True
    extras = (os.getenv("PLATFORM_PUBLIC_HOSTS") or "").strip()
    if extras:
        allowed = {normalize_host(x) for x in extras.split(",") if x.strip()}
        if host in allowed:
            return True
    return False


def _try_attach_bearer_tenant(request: Request) -> bool:
    """
    Decode Authorization Bearer and set request.state.tenant_id when present.
    Returns True when tenant_id was attached (Host DB lookup can be skipped).
    """
    auth = request.headers.get("Authorization") or ""
    if not auth.startswith("Bearer "):
        return False
    try:
        from middleware.tenant import _attach_bearer_tenant_context, _jwt_settings

        secret, algorithm, _ = _jwt_settings()
        if not secret:
            return False
        _attach_bearer_tenant_context(request, secret, algorithm)
    except Exception as exc:
        logger.debug("Bearer tenant attach skipped: %s", exc)
        return False
    return getattr(request.state, "tenant_id", None) is not None


async def _resolve_host_cached(host: str) -> ResolvedTenant | None:
    now = time.monotonic()
    hit = _HOST_RESOLVE_CACHE.get(host)
    if hit is not None and (now - hit[0]) < _HOST_RESOLVE_TTL_SEC:
        return hit[1]
    async with AsyncSessionLocal() as session:
        resolved = await DomainResolver(session).resolve(host)
    _HOST_RESOLVE_CACHE[host] = (now, resolved)
    return resolved


class DomainTenantMiddleware(BaseHTTPMiddleware):
    async def __call__(self, scope, receive, send):
        # WebSocket upgrades must bypass BaseHTTPMiddleware request wrapping.
        if scope["type"] == "websocket":
            await self.app(scope, receive, send)
            return
        await super().__call__(scope, receive, send)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        # Let CORSMiddleware answer preflight without domain/tenant lookup.
        if request.method == "OPTIONS":
            return await call_next(request)
        if any(path.startswith(p) for p in PUBLIC_HOST_PATHS):
            return await call_next(request)
        if any(path.startswith(p) for p in JWT_SCOPED_PREFIXES):
            # Prefer JWT tenant — avoids a Postgres round-trip on every admin API
            # hit from custom domains (e.g. driver profile on achilliotravel.com).
            _try_attach_bearer_tenant(request)
            # Customer Wallet JWTs have no tenant_id — still map Host → office so
            # rentals/lost-items land in the correct tenant store.
            if getattr(request.state, "tenant_id", None) is None:
                host = _request_host(request)
                if host and not _is_platform_host(host):
                    try:
                        resolved = await _resolve_host_cached(host)
                        if resolved:
                            request.state.tenant_id = resolved.tenant_id
                            request.state.tenant_slug = resolved.slug
                            request.state.tenant_theme = resolved.theme
                    except Exception as exc:
                        logger.debug("Optional domain resolve skipped for %s: %s", path, exc)
            return await call_next(request)

        host = _request_host(request)
        if not host or _is_platform_host(host):
            return await call_next(request)

        try:
            resolved = await _resolve_host_cached(host)
        except Exception as exc:
            logger.warning("Domain resolution unavailable for %s: %s", host, exc)
            return await call_next(request)

        if not resolved:
            return JSONResponse(
                status_code=404,
                content={"detail": "Domain not registered with PoreiaGo"},
            )

        request.state.tenant_id = resolved.tenant_id
        request.state.tenant_slug = resolved.slug
        request.state.tenant_theme = resolved.theme

        client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
            request.client.host if request.client else None
        )
        whitelist = resolved.admin_ip_whitelist
        allowed, msg = enforce_admin_ip_whitelist(client_ip, whitelist, path=path)
        if not allowed:
            return JSONResponse(status_code=403, content={"detail": msg})

        response = await call_next(request)
        if resolved.theme.get("primary"):
            response.headers["X-Theme-Primary"] = str(resolved.theme["primary"])
        return response
