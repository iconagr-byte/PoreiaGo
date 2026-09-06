"""Postgres-backed platform users for admin Users UI (per-tenant).

Replaces the in-memory aerostride demo seed for Contabo / production login accounts.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID, uuid4

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.services.auth_service import hash_password

logger = logging.getLogger(__name__)

UiRole = Literal["admin", "driver", "agent", "viewer"]

_STAFF_ROLES = frozenset(
    {
        UserRole.SUPERADMIN.value,
        UserRole.TENANT_ADMIN.value,
        UserRole.DISPATCHER.value,
        UserRole.DRIVER.value,
        UserRole.AUDITOR.value,
    }
)


def ui_role_from_db(roles: list[str] | None) -> UiRole:
    rs = {str(r).lower() for r in (roles or [])}
    if UserRole.SUPERADMIN.value in rs or UserRole.TENANT_ADMIN.value in rs:
        return "admin"
    if UserRole.DRIVER.value in rs:
        return "driver"
    if UserRole.DISPATCHER.value in rs:
        return "agent"
    if UserRole.AUDITOR.value in rs:
        return "viewer"
    return "viewer"


def db_roles_from_ui(role: UiRole, *, preserve_superadmin: bool = False) -> list[str]:
    if role == "admin":
        roles = [UserRole.TENANT_ADMIN.value, UserRole.DISPATCHER.value]
        if preserve_superadmin:
            roles.insert(0, UserRole.SUPERADMIN.value)
        return roles
    if role == "driver":
        return [UserRole.DRIVER.value]
    if role == "agent":
        return [UserRole.DISPATCHER.value]
    return [UserRole.AUDITOR.value]


def user_to_platform_dict(user: User) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.full_name or user.email,
        "role": ui_role_from_db(user.roles),
        "is_active": bool(user.is_active),
        "last_login_at": None,
        "created_at": getattr(user, "created_at", None) or datetime.now(timezone.utc),
    }


async def _disable_rls(session: AsyncSession) -> None:
    try:
        await session.execute(text("SET LOCAL row_security = off"))
    except Exception:
        pass


async def list_tenant_users(session: AsyncSession, tenant_id: UUID) -> list[User]:
    await _disable_rls(session)
    result = await session.execute(
        select(User)
        .where(User.tenant_id == tenant_id)
        .order_by(func.lower(User.email))
    )
    users = []
    for u in result.scalars().all():
        roles = {str(r).lower() for r in (u.roles or [])}
        if roles & _STAFF_ROLES:
            users.append(u)
    return users


async def get_tenant_user(
    session: AsyncSession, tenant_id: UUID, user_id: UUID
) -> User | None:
    await _disable_rls(session)
    result = await session.execute(
        select(User).where(User.tenant_id == tenant_id, User.id == user_id).limit(1)
    )
    return result.scalar_one_or_none()


async def create_tenant_user(
    session: AsyncSession,
    *,
    tenant_id: UUID,
    email: str,
    name: str,
    role: UiRole,
    password: str | None,
) -> User:
    await _disable_rls(session)
    email_l = email.strip().lower()
    existing = await session.execute(
        select(User).where(
            User.tenant_id == tenant_id,
            func.lower(User.email) == email_l,
        ).limit(1)
    )
    if existing.scalar_one_or_none():
        raise ValueError("Email already exists")
    pwd = password or secrets.token_urlsafe(12)
    if len(pwd) < 6:
        raise ValueError("Password too short")
    user = User(
        id=uuid4(),
        tenant_id=tenant_id,
        email=email_l,
        full_name=(name or email_l).strip(),
        password_hash=hash_password(pwd),
        roles=db_roles_from_ui(role),
        is_active=True,
        mfa_enabled=False,
    )
    session.add(user)
    await session.flush()
    return user


async def update_tenant_user(
    session: AsyncSession,
    *,
    tenant_id: UUID,
    user_id: UUID,
    patch: dict[str, Any],
) -> User:
    user = await get_tenant_user(session, tenant_id, user_id)
    if not user:
        raise KeyError("User not found")
    if "name" in patch and patch["name"] is not None:
        user.full_name = str(patch["name"]).strip()
    if "role" in patch and patch["role"] is not None:
        keep_sa = UserRole.SUPERADMIN.value in {str(r).lower() for r in (user.roles or [])}
        user.roles = db_roles_from_ui(patch["role"], preserve_superadmin=keep_sa)
    if "is_active" in patch and patch["is_active"] is not None:
        user.is_active = bool(patch["is_active"])
    if patch.get("password"):
        pwd = str(patch["password"])
        if len(pwd) < 6:
            raise ValueError("Password too short")
        user.password_hash = hash_password(pwd)
    await session.flush()
    return user


async def delete_tenant_user(
    session: AsyncSession, *, tenant_id: UUID, user_id: UUID
) -> None:
    user = await get_tenant_user(session, tenant_id, user_id)
    if not user:
        raise KeyError("User not found")
    role = ui_role_from_db(user.roles)
    if role == "admin":
        admins = [
            u
            for u in await list_tenant_users(session, tenant_id)
            if ui_role_from_db(u.roles) == "admin" and u.is_active
        ]
        if len(admins) <= 1 and user.is_active:
            raise ValueError("Cannot delete the last active admin")
    await session.delete(user)
    await session.flush()
