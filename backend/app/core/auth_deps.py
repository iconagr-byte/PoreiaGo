"""
FastAPI dependencies: JWT → tenant context → RLS-scoped DB session.

Every tenant-bound query MUST use `get_tenant_db` so Postgres RLS is applied.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import Select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.security import TokenError, decode_access_token
from app.core.tenant_rls import apply_tenant_rls
from app.core.tenant_database import get_session_factory_for_tenant, load_tenant_from_master
from app.models.api_key import ApiKeyScope
from app.models.user import UserRole
from app.services.api_key_service import ApiKeyService


async def get_token_payload(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    try:
        return decode_access_token(auth[7:].strip())
    except TokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


async def get_current_tenant_id(payload: Annotated[dict, Depends(get_token_payload)]) -> UUID:
    tid = payload.get("tenant_id")
    if not tid:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="tenant_id required in token")
    try:
        return UUID(str(tid))
    except ValueError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Invalid tenant_id") from exc


async def get_current_user_id(payload: Annotated[dict, Depends(get_token_payload)]) -> UUID:
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid subject")
    try:
        return UUID(str(sub))
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid subject") from exc


async def get_current_roles(payload: Annotated[dict, Depends(get_token_payload)]) -> list[str]:
    return list(payload.get("roles") or [])


async def require_mfa_verified(payload: Annotated[dict, Depends(get_token_payload)]) -> dict:
    roles = set(payload.get("roles") or [])
    from app.core.config import get_settings

    required = {r.strip() for r in get_settings().mfa_required_roles.split(",") if r.strip()}
    if roles & required and not payload.get("mfa_verified"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="MFA verification required")
    return payload


def require_roles(*allowed: UserRole):
    allowed_values = {r.value for r in allowed}

    async def _checker(roles: Annotated[list[str], Depends(get_current_roles)]) -> None:
        if not allowed_values.intersection(roles):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Insufficient role")

    return _checker


async def get_tenant_db(
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
) -> AsyncGenerator[AsyncSession, None]:
    tenant = await load_tenant_from_master(tenant_id)
    factory = get_session_factory_for_tenant(tenant) if tenant else AsyncSessionLocal
    async with factory() as session:
        await apply_tenant_rls(session, tenant_id)
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_platform_db() -> AsyncGenerator[AsyncSession, None]:
    """Cross-tenant session for superadmin — no RLS context set."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


require_superadmin = require_roles(UserRole.SUPERADMIN)


def tenant_scoped_select(stmt: Select, model, tenant_id: UUID) -> Select:
    """Defense-in-depth filter when RLS is disabled (tests) or for raw queries."""
    return stmt.where(model.tenant_id == tenant_id)


def _extract_api_key(request: Request) -> str | None:
    key = request.headers.get("X-API-Key") or request.headers.get("X-Telemetry-Key")
    if key:
        return key.strip()
    auth = request.headers.get("Authorization", "")
    if auth.startswith("ApiKey "):
        return auth[7:].strip()
    return None


async def resolve_tenant_from_jwt_or_api_key(
    request: Request,
    *,
    api_key_scope: ApiKeyScope | None = ApiKeyScope.TELEMETRY,
) -> UUID:
    """JWT (Bearer) or device API key (X-API-Key / Authorization: ApiKey)."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            payload = decode_access_token(auth[7:].strip())
            return UUID(str(payload["tenant_id"]))
        except (TokenError, ValueError) as exc:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    raw_key = _extract_api_key(request)
    if raw_key:
        async with AsyncSessionLocal() as session:
            tenant_id = await ApiKeyService(session).resolve_tenant_id(
                raw_key,
                scope=api_key_scope,
            )
            await session.commit()
        if tenant_id:
            return tenant_id
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

    raise HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        detail="Bearer token or X-API-Key required",
    )


async def get_telemetry_tenant_id(
    request: Request,
) -> UUID:
    return await resolve_tenant_from_jwt_or_api_key(request, api_key_scope=ApiKeyScope.TELEMETRY)


async def get_telemetry_db(
    tenant_id: Annotated[UUID, Depends(get_telemetry_tenant_id)],
) -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        await apply_tenant_rls(session, tenant_id)
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None
