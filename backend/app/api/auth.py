from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import LoginRequest, MfaEnrollResponse, MfaVerifyRequest, RefreshTokenRequest, TokenResponse
from app.core.auth_deps import get_current_user_id, get_tenant_db
from app.core.database import AsyncSessionLocal
from app.core.config import get_settings
from app.core.security import create_access_token
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.services.auth_service import AuthService
from app.services.mfa_service import MfaService
from app.services.refresh_token_service import RefreshTokenService
from sqlalchemy import select

router = APIRouter(prefix="/auth", tags=["SaaS Auth"])

DEV_ADMIN_EMAILS = frozenset({"admin@achillio.gr", "admin@aerostride.com"})
DEV_ADMIN_PASSWORD = "Admin123!"
DEV_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
DEV_TENANT_ID = UUID("00000000-0000-0000-0000-000000000002")


def _dev_login_allowed() -> bool:
    settings = get_settings()
    return settings.environment in ("development", "dev", "local")


def _token_response(
    *,
    access_token: str,
    refresh_token: str | None,
    tenant_id: UUID,
    tenant_slug: str,
    roles: list[str],
) -> TokenResponse:
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        tenant_id=tenant_id,
        tenant_slug=tenant_slug,
        roles=roles,
    )


@router.post("/dev-login", response_model=TokenResponse)
async def dev_login(request: Request, body: LoginRequest):
    """Local dev only — JWT with superadmin when Postgres/seed is unavailable."""
    if not _dev_login_allowed():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found")
    email = body.email.strip().lower()
    if email not in DEV_ADMIN_EMAILS or body.password != DEV_ADMIN_PASSWORD:
        from travel_platform.settings.login_audit_store import record_login_from_request

        record_login_from_request(
            request,
            actor_type="admin",
            identity=email,
            success=False,
            method="dev-login",
            detail="Λάθος email ή κωδικός",
        )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Λάθος email ή κωδικός")
    settings = get_settings()
    if not settings.auth_jwt_secret and not settings.auth_jwt_private_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="JWT signing key not configured")

    tenant_slug = (body.tenant_slug or "achillio").strip().lower()
    tenant_id = DEV_TENANT_ID
    user_id = DEV_USER_ID
    refresh_token: str | None = None
    try:
        async with AsyncSessionLocal() as db:
            tenant_result = await db.execute(
                select(Tenant).where(Tenant.slug == tenant_slug).limit(1),
            )
            tenant = tenant_result.scalar_one_or_none()
            if tenant:
                tenant_id = tenant.id
                tenant_slug = tenant.slug
            user_result = await db.execute(
                select(User).where(User.email == email, User.tenant_id == tenant_id).limit(1),
            )
            user = user_result.scalar_one_or_none()
            if user:
                user_id = user.id
            refresh_token = await RefreshTokenService(db).issue(user_id=user_id, tenant_id=tenant_id)
            await db.commit()
    except Exception:
        refresh_token = None

    roles = [UserRole.SUPERADMIN.value, UserRole.TENANT_ADMIN.value, UserRole.DISPATCHER.value]
    token = create_access_token(
        user_id=user_id,
        tenant_id=tenant_id,
        roles=[UserRole.SUPERADMIN, UserRole.TENANT_ADMIN, UserRole.DISPATCHER],
        mfa_verified=True,
        extra={"tenant_slug": tenant_slug},
    )
    from travel_platform.settings.login_audit_store import record_login_from_request

    record_login_from_request(
        request,
        actor_type="admin",
        identity=email,
        success=True,
        actor_id=str(user_id),
        method="dev-login",
        tenant_id=str(tenant_id),
        detail=f"dev · {tenant_slug}",
    )
    return _token_response(
        access_token=token,
        refresh_token=refresh_token,
        tenant_id=tenant_id,
        tenant_slug=tenant_slug,
        roles=roles,
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, body: LoginRequest):
    """Login with email + password. Tenant is resolved automatically (optional tenant_slug)."""
    from travel_platform.settings.login_audit_store import record_login_from_request

    email = (body.email or "").strip().lower()
    async with AsyncSessionLocal() as db:
        try:
            token, refresh, user, tenant = await AuthService(db).login(
                email=body.email,
                password=body.password,
                tenant_id=body.tenant_id,
                tenant_slug=body.tenant_slug,
                mfa_code=body.mfa_code,
            )
            await db.commit()
        except ValueError as exc:
            await db.rollback()
            record_login_from_request(
                request,
                actor_type="admin",
                identity=email,
                success=False,
                method="password",
                detail=str(exc),
            )
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
        role_values = [r for r in (user.roles or []) if r in {e.value for e in UserRole}]
        record_login_from_request(
            request,
            actor_type="admin",
            identity=getattr(user, "email", None) or email,
            success=True,
            actor_id=str(user.id),
            actor_name=getattr(user, "full_name", None) or getattr(user, "name", None),
            method="password",
            tenant_id=str(tenant.id),
            detail=tenant.slug,
        )
        return _token_response(
            access_token=token,
            refresh_token=refresh,
            tenant_id=tenant.id,
            tenant_slug=tenant.slug,
            roles=role_values,
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(body: RefreshTokenRequest):
    """Rotate refresh token and issue a new access token."""
    async with AsyncSessionLocal() as db:
        try:
            new_refresh, user, tenant = await RefreshTokenService(db).rotate(body.refresh_token)
            roles = RefreshTokenService.user_roles(user)
            access = create_access_token(
                user_id=user.id,
                tenant_id=tenant.id,
                roles=roles or [UserRole.CUSTOMER],
                mfa_verified=True,
                extra={"tenant_slug": tenant.slug},
            )
            await db.commit()
        except ValueError as exc:
            await db.rollback()
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

        role_values = [r.value for r in roles] if roles else list(user.roles or [])
        return _token_response(
            access_token=access,
            refresh_token=new_refresh,
            tenant_id=tenant.id,
            tenant_slug=tenant.slug,
            roles=role_values,
        )


@router.post("/mfa/enroll", response_model=MfaEnrollResponse)
async def mfa_enroll(
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
    enrollment = MfaService().enroll(user_email=user.email)
    settings = get_settings()
    user.mfa_secret_encrypted = MfaService.encrypt_secret_for_storage(
        enrollment.secret,
        pepper=settings.auth_jwt_secret,
    )
    user.mfa_enabled = True
    return MfaEnrollResponse(
        provisioning_uri=enrollment.provisioning_uri,
        secret=enrollment.secret,
    )


@router.post("/mfa/verify")
async def mfa_verify(
    body: MfaVerifyRequest,
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.mfa_secret_encrypted:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="MFA not configured")
    secret = MfaService.decrypt_secret_from_storage(
        user.mfa_secret_encrypted,
        pepper=get_settings().auth_jwt_secret,
    )
    if not MfaService().verify(secret, body.code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA code")
    return {"verified": True}
