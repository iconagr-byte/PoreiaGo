"""
Host-based tenant resolution + white-label theme binding.

Runs early in middleware stack — before JWT for public storefront routes.
Returns 404 for unmapped custom domains (no tenant leakage).
"""

from __future__ import annotations

import logging
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.database import AsyncSessionLocal
from olympus.security.ip_whitelist import enforce_admin_ip_whitelist
from olympus.tenant.domain_resolver import DomainResolver, normalize_host

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

# Admin/SaaS API — tenant από JWT, όχι από Host (αποφυγή Postgres dependency στο localhost dev)
JWT_SCOPED_PREFIXES = (
    "/api/v1/",
    "/api/admin/",
    "/api/driver/",
    "/api/expenses/",
    "/api/passenger/",
    "/ws/",  # driver GPS ingress, fleet egress, passenger ETA (JWT / trip scoped)
)


class DomainTenantMiddleware(BaseHTTPMiddleware):
    async def __call__(self, scope, receive, send):
        # WebSocket upgrades must bypass BaseHTTPMiddleware request wrapping.
        if scope["type"] == "websocket":
            await self.app(scope, receive, send)
            return
        await super().__call__(scope, receive, send)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if any(path.startswith(p) for p in PUBLIC_HOST_PATHS):
            return await call_next(request)
        if any(path.startswith(p) for p in JWT_SCOPED_PREFIXES):
            return await call_next(request)

        host = normalize_host(request.headers.get("host"))
        if not host or host in ("localhost", "127.0.0.1", "api.localhost"):
            return await call_next(request)

        try:
            async with AsyncSessionLocal() as session:
                resolver = DomainResolver(session)
                resolved = await resolver.resolve(host)
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
