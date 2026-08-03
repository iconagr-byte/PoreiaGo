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
    "/api/v1/bookings/occupied-seats",
}

# Swagger only in non-production (FastAPI also disables docs_url there).
if os.getenv("ENVIRONMENT", "development").lower() not in ("production", "prod"):
    PUBLIC_PATHS |= {"/docs", "/openapi.json", "/redoc"}

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

# Email / mailbox / campaigns — SQLite-backed, must not be world-writable.
# Require the same admin JWT gate as file-store admin routes.
EMAIL_ADMIN_PREFIXES = (
    "/api/email/",
    "/api/mailbox/",
    "/api/campaigns/",
)

# JSON file-store admin routes — skip Postgres RLS / suspended-tenant gate AFTER
# JWT + admin-role checks. Never leave these unauthenticated.
FILE_STORE_ADMIN_PREFIXES = (
    "/api/admin/platform/site-appearance",
    "/api/admin/platform/settings",
    "/api/admin/platform/branding",
    "/api/admin/platform/seat-pricing",
    "/api/admin/platform/payment-settings",
    "/api/admin/platform/bank-accounts",
    "/api/admin/platform/rent-plan-catalog",
    "/api/admin/platform/agency-plan-catalog",
    "/api/admin/platform/drivers",
    # Fleet coaches/vans — JSON file store (same isolation model as drivers).
    "/api/admin/platform/fleet",
    # Driver ↔ office chat — JSON file store, must stay office-scoped.
    "/api/admin/platform/driver-chat",
)


def _attach_bearer_tenant_context(
    request: Request,
    jwt_secret: str,
    jwt_algorithm: str,
) -> None:
    """
    Best-effort: decode Bearer JWT and set request.state.tenant_id / roles.

    Used for file-store admin routes that skip the hard JWT gate. Prefer JWT
    tenant over any Host-derived tenant so impersonation and platform-host
    logins scope drivers/settings to the correct office.
    """
    if not jwt_secret:
        return
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return
    token = auth[7:].strip()
    if not token:
        return
    try:
        payload = jwt.decode(token, jwt_secret, algorithms=[jwt_algorithm])
    except jwt.PyJWTError:
        return
    raw_tid = payload.get("tenant_id")
    if raw_tid:
        try:
            request.state.tenant_id = UUID(str(raw_tid))
        except ValueError:
            pass
    if payload.get("sub"):
        request.state.user_id = payload.get("sub")
    roles = list(payload.get("roles") or [])
    if roles:
        request.state.roles = roles
    if payload.get("impersonating"):
        request.state.impersonating = True


def _requires_jwt(path: str) -> bool:
    if path.startswith(PLATFORM_PREFIX) or path.startswith(ADMIN_PREFIX):
        return True
    return any(path.startswith(p) for p in EMAIL_ADMIN_PREFIXES)


def _admin_public_get(path: str, method: str) -> bool:
    return method.upper() == "GET" and any(path.startswith(p) for p in ADMIN_PUBLIC_GET_PREFIXES)


def _is_file_store_admin(path: str) -> bool:
    return any(path.startswith(p) for p in FILE_STORE_ADMIN_PREFIXES)


def _is_email_admin(path: str) -> bool:
    return any(path.startswith(p) for p in EMAIL_ADMIN_PREFIXES)


def _admin_auth_disabled_allowed() -> bool:
    """ADMIN_AUTH_DISABLED is local-dev only — never honor in production."""
    env = os.getenv("ENVIRONMENT", "development").lower()
    return env in ("development", "dev", "local", "test")


async def _require_admin_bearer(
    request: Request,
    jwt_secret: str,
    jwt_algorithm: str,
) -> JSONResponse | None:
    """
    JWT + admin roles for email/mailbox/campaigns (and similar SQLite admin APIs).
    Returns an error response, or None when request.state is populated and OK.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "Missing bearer token"})
    token = auth[7:].strip()
    if not jwt_secret:
        return JSONResponse(status_code=503, content={"detail": "Auth not configured"})
    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=[jwt_algorithm],
            options={"require": ["exp", "sub"]},
            leeway=60,
        )
    except jwt.ExpiredSignatureError:
        return JSONResponse(
            status_code=401,
            content={"detail": "Η σύνδεση έληξε — συνδεθείτε ξανά στο γραφείο"},
        )
    except jwt.PyJWTError:
        return JSONResponse(
            status_code=401,
            content={"detail": "Η σύνδεση δεν είναι έγκυρη — συνδεθείτε ξανά στο γραφείο"},
        )
    raw_tid = payload.get("tenant_id")
    if not raw_tid:
        return JSONResponse(status_code=403, content={"detail": "tenant_id required"})
    try:
        request.state.tenant_id = UUID(str(raw_tid))
    except ValueError:
        return JSONResponse(status_code=403, content={"detail": "Invalid tenant_id"})
    roles = list(payload.get("roles") or [])
    request.state.user_id = payload.get("sub")
    request.state.roles = roles
    if not set(roles) & ADMIN_ACCESS_ROLES:
        return JSONResponse(
            status_code=403,
            content={"detail": "Admin access required"},
        )
    if payload.get("impersonating"):
        request.state.impersonating = True
    # SEAL: Achillio Travel JWT must not serve drivers/settings on poreiago.com
    # (and the reverse). Same οδηγός appearing / deleting on both URLs.
    try:
        from middleware.domain_tenant import _is_platform_host, _request_host
        from travel_platform.settings.office_host_guard import office_host_mismatch_detail

        host = _request_host(request)
        detail = await office_host_mismatch_detail(
            host=host,
            tenant_id=str(request.state.tenant_id),
            roles=roles,
            is_platform_host=_is_platform_host(host),
            impersonating=bool(payload.get("impersonating")),
        )
        if detail:
            return JSONResponse(status_code=403, content={"detail": detail})
    except Exception:
        pass
    return None


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
        # CORS preflight never carries Authorization; must not 401 here.
        if request.method == "OPTIONS":
            return await call_next(request)

        jwt_secret, jwt_algorithm, admin_auth_disabled = _jwt_settings()
        # Never honor ADMIN_AUTH_DISABLED outside local/dev/test.
        if admin_auth_disabled and not _admin_auth_disabled_allowed():
            admin_auth_disabled = False

        if path in PUBLIC_PATHS:
            return await call_next(request)

        if not _requires_jwt(path):
            return await call_next(request)

        # Email / mailbox / campaigns — admin JWT, skip Postgres RLS.
        if _is_email_admin(path):
            if admin_auth_disabled:
                await _apply_dev_admin_context(request)
                return await call_next(request)
            err = await _require_admin_bearer(request, jwt_secret, jwt_algorithm)
            if err is not None:
                return err
            return await call_next(request)

        if path.startswith(ADMIN_PREFIX):
            if _admin_public_get(path, request.method):
                return await call_next(request)
            if admin_auth_disabled:
                await _apply_dev_admin_context(request)
                return await call_next(request)
            # File-store admin routes still REQUIRE JWT + admin roles.
            # They only skip the Postgres RLS / suspended-tenant gate below
            # (storage is JSON files, not tenant RLS sessions).
            if _is_file_store_admin(path):
                err = await _require_admin_bearer(request, jwt_secret, jwt_algorithm)
                if err is not None:
                    return err
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
            payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=[jwt_algorithm],
                options={"require": ["exp", "sub"]},
                leeway=60,
            )
        except jwt.ExpiredSignatureError:
            return JSONResponse(
                status_code=401,
                content={"detail": "Η σύνδεση έληξε — συνδεθείτε ξανά στο γραφείο"},
            )
        except jwt.PyJWTError:
            return JSONResponse(
                status_code=401,
                content={"detail": "Η σύνδεση δεν είναι έγκυρη — συνδεθείτε ξανά στο γραφείο"},
            )

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

        # Skip suspended-tenant gate for file-store routes (handled above) and
        # for billing/compliance / platform superadmin paths.
        if not _is_file_store_admin(path) and not _suspended_tenant_allowed(path, roles):
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
