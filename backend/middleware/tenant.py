"""
Tenant isolation middleware — JWT for /api/v1/* and /api/admin/*.

Usage in main.py:
    app.add_middleware(TenantContextMiddleware)

All SQLAlchemy sessions must execute:
    await session.execute(text("SET LOCAL app.current_tenant = :tid"), {"tid": str(tenant_id)})
before any query touching tenant-scoped tables.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Callable
from uuid import UUID

import jwt
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


def _jwt_settings() -> tuple[str, str, bool]:
    try:
        from dotenv import load_dotenv

        load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    except Exception:
        pass

    secret = os.getenv("AUTH_JWT_SECRET", "") or os.getenv("TICKET_JWT_SECRET", "")
    algorithm = os.getenv("AUTH_JWT_ALGORITHM", "HS256")
    admin_disabled = os.getenv("ADMIN_AUTH_DISABLED", "").lower() in ("1", "true", "yes")
    try:
        from app.core.config import get_settings
        from app.core.security import get_jwt_algorithm, get_jwt_verification_key

        settings = get_settings()
        if settings.auth_jwt_public_key or settings.auth_jwt_secret:
            secret = get_jwt_verification_key()
            algorithm = get_jwt_algorithm()
        elif settings.auth_jwt_secret:
            secret = settings.auth_jwt_secret
        if settings.auth_jwt_algorithm and not settings.auth_jwt_public_key:
            algorithm = settings.auth_jwt_algorithm
    except Exception:
        pass
    return secret, algorithm, admin_disabled

PUBLIC_PATHS = {
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/api/v1/health",
    "/api/v1/auth/login",
    "/api/v1/auth/dev-login",
    "/api/v1/auth/refresh",
    "/api/v1/aade/webhook",
    "/api/v1/billing/webhook",
    "/api/v1/payments/webhook",
    "/api/v1/billing/signup-checkout",
    "/api/v1/billing/config",
    "/api/v1/telemetry/update",
    "/api/v1/bookings/guest",
    "/api/v1/bookings/lookup",
}

BILLING_PREFIX = "/api/v1/billing"
PLATFORM_ADMIN_PREFIX = "/api/v1/platform"
COMPLIANCE_PREFIX = "/api/v1/compliance"

PLATFORM_PREFIX = "/api/v1"
ADMIN_PREFIX = "/api/admin"

ADMIN_ACCESS_ROLES = frozenset({
    "superadmin",
    "tenant_admin",
    "dispatcher",
    "auditor",
})

# Public GET endpoints under /api/admin (B2C pricing quote on storefront)
ADMIN_PUBLIC_GET_PREFIXES = (
    "/api/admin/platform/pricing/quote",
    "/api/admin/platform/site-appearance",
)

# JSON file-store admin routes — no Postgres tenant gate (local dev / single-tenant file).
# Drivers stay file-backed (fleet_drivers.json). JWT is still sent by the admin UI;
# keeping this prefix avoids empty lists when SaaS role/tenant checks would block.
FILE_STORE_ADMIN_PREFIXES = (
    "/api/admin/platform/site-appearance",
    "/api/admin/platform/settings",
    "/api/admin/platform/branding",
    "/api/admin/platform/seat-pricing",
    "/api/admin/platform/drivers",
)


def _requires_jwt(path: str) -> bool:
    return path.startswith(PLATFORM_PREFIX) or path.startswith(ADMIN_PREFIX)


def _admin_public_get(path: str, method: str) -> bool:
    return method.upper() == "GET" and any(path.startswith(p) for p in ADMIN_PUBLIC_GET_PREFIXES)


def _is_file_store_admin(path: str) -> bool:
    return any(path.startswith(p) for p in FILE_STORE_ADMIN_PREFIXES)


async def _apply_dev_admin_context(request: Request) -> None:
    """Local dev only (ADMIN_AUTH_DISABLED=1) — synthetic tenant admin context."""
    import os
    from uuid import UUID

    from sqlalchemy import select

    env_tid = os.getenv("DEFAULT_TENANT_ID", "").strip()
    if env_tid:
        request.state.tenant_id = UUID(env_tid)
    else:
        try:
            from app.core.database import AsyncSessionLocal
            from app.models.tenant import Tenant

            slug = os.getenv("DEFAULT_TENANT_SLUG", "achillio")
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(Tenant).where(Tenant.slug == slug).limit(1))
                tenant = result.scalar_one_or_none()
            if tenant:
                request.state.tenant_id = tenant.id
        except Exception:
            request.state.tenant_id = UUID("00000000-0000-0000-0000-000000000001")

    request.state.user_id = "dev-admin"
    request.state.roles = ["tenant_admin", "superadmin"]


async def _tenant_is_active(tenant_id: UUID) -> bool:
    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.models.tenant import Tenant

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Tenant.is_active).where(Tenant.id == tenant_id))
            active = result.scalar_one_or_none()
        return bool(active) if active is not None else True
    except Exception:
        import os

        if os.getenv("ENVIRONMENT", "development").lower() in ("development", "dev", "local"):
            return True
        return False


def _suspended_tenant_allowed(path: str, roles: list[str] | None = None) -> bool:
    """Suspended tenants may still access billing, compliance, or superadmin platform routes."""
    if path.startswith(BILLING_PREFIX) or path.startswith(COMPLIANCE_PREFIX):
        return True
    if path.startswith(PLATFORM_ADMIN_PREFIX) and roles and "superadmin" in roles:
        return True
    return False


class TenantContextMiddleware(BaseHTTPMiddleware):
    async def __call__(self, scope, receive, send):
        # WebSocket upgrades must not go through BaseHTTPMiddleware request wrapping.
        if scope["type"] == "websocket":
            await self.app(scope, receive, send)
            return
        await super().__call__(scope, receive, send)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        jwt_secret, jwt_algorithm, admin_auth_disabled = _jwt_settings()

        if path in PUBLIC_PATHS:
            return await call_next(request)

        if not _requires_jwt(path):
            return await call_next(request)

        if path.startswith(ADMIN_PREFIX):
            if _admin_public_get(path, request.method):
                return await call_next(request)
            if _is_file_store_admin(path):
                return await call_next(request)
            if admin_auth_disabled:
                await _apply_dev_admin_context(request)
                return await call_next(request)

        if path.startswith(PLATFORM_ADMIN_PREFIX) and admin_auth_disabled:
            await _apply_dev_admin_context(request)
            return await call_next(request)

        domain_tenant_id: UUID | None = None
        if getattr(request.state, "tenant_slug", None) and getattr(request.state, "tenant_id", None):
            try:
                domain_tenant_id = UUID(str(request.state.tenant_id))
            except ValueError:
                domain_tenant_id = None

        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Missing bearer token"})

        token = auth[7:].strip()
        try:
            payload = jwt.decode(token, jwt_secret, algorithms=[jwt_algorithm])
        except jwt.PyJWTError:
            return JSONResponse(status_code=401, content={"detail": "Invalid token"})

        tenant_id = payload.get("tenant_id")
        if not tenant_id:
            return JSONResponse(status_code=403, content={"detail": "tenant_id required"})

        try:
            jwt_tenant_id = UUID(str(tenant_id))
        except ValueError:
            return JSONResponse(status_code=403, content={"detail": "Invalid tenant_id"})

        if domain_tenant_id is not None and jwt_tenant_id != domain_tenant_id:
            return JSONResponse(
                status_code=403,
                content={"detail": "Token tenant does not match domain tenant"},
            )

        request.state.tenant_id = jwt_tenant_id

        roles = list(payload.get("roles") or [])
        request.state.user_id = payload.get("sub")
        request.state.roles = roles

        if path.startswith(ADMIN_PREFIX) and not _admin_public_get(path, request.method):
            if not set(roles) & ADMIN_ACCESS_ROLES:
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Admin access required"},
                )

        if not _suspended_tenant_allowed(path, roles):
            if not await _tenant_is_active(request.state.tenant_id):
                return JSONResponse(
                    status_code=403,
                    content={
                        "detail": "Tenant subscription suspended. Update billing to restore access.",
                        "code": "tenant_suspended",
                    },
                )

        response = await call_next(request)
        return response


async def apply_tenant_to_session(session, tenant_id: UUID) -> None:
    """Call once per request before DB work."""
    from sqlalchemy import text

    await session.execute(
        text("SELECT set_config('app.current_tenant', :tid, true)"),
        {"tid": str(tenant_id)},
    )
