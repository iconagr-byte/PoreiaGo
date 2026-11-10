"""Boot/deploy repair — ensure known office admin logins unlock.

New offices sometimes ship without a usable /admin/login password (create
UI showed credentials that never landed, or SuperAdmin reset never applied).
Mirror the driver force-password pattern for a short allowlist of offices.
"""

from __future__ import annotations

import logging
import os
from typing import Any
from uuid import UUID, uuid4

logger = logging.getLogger("poreiago.office_admin_bootstrap")

# subdomain (or slug) → default unlock. Override password with env when set.
_OFFICE_ADMIN_BOOTSTRAPS: tuple[dict[str, str], ...] = (
    {
        "subdomain": "dodopoulos-christos-charalampidis-achilleas-o-e",
        "email": "axilleas0@yahoo.gr",
        "full_name": "Αχιλλέας Χαραλαμπίδης",
        "password": "Dimtsa@1234",
        "password_env": "DODOPOULOS_ADMIN_PASSWORD",
    },
)


async def ensure_office_admin_bootstrap(
    *,
    subdomain: str,
    email: str,
    password: str,
    full_name: str = "",
) -> dict[str, Any]:
    """Create or force-reset the TENANT_ADMIN user on an office subdomain."""
    sub = (subdomain or "").strip().lower()
    email_l = (email or "").strip().lower()
    pwd = (password or "").strip()
    name = (full_name or "").strip() or email_l
    if not sub or not email_l or len(pwd) < 8:
        return {"ok": False, "reason": "invalid_args", "subdomain": sub}

    from sqlalchemy import func, or_, select, text

    from app.core.database import AsyncSessionLocal
    from app.models.tenant import Tenant
    from app.models.user import User, UserRole
    from app.services.auth_service import hash_password, verify_password

    async with AsyncSessionLocal() as session:
        try:
            await session.execute(text("SET LOCAL row_security = off"))
        except Exception:
            pass

        result = await session.execute(
            select(Tenant)
            .where(
                or_(
                    func.lower(Tenant.subdomain) == sub,
                    func.lower(Tenant.slug) == sub,
                )
            )
            .limit(1)
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            return {"ok": False, "reason": "tenant_missing", "subdomain": sub}

        tid = tenant.id if isinstance(tenant.id, UUID) else UUID(str(tenant.id))
        users = (
            await session.execute(select(User).where(User.tenant_id == tid))
        ).scalars().all()
        target = next(
            (u for u in users if str(u.email or "").lower() == email_l),
            None,
        )

        action = "updated"
        if target is None:
            target = User(
                id=uuid4(),
                tenant_id=tid,
                email=email_l,
                password_hash=hash_password(pwd),
                full_name=name,
                roles=[UserRole.TENANT_ADMIN.value],
                is_active=True,
                mfa_enabled=False,
            )
            session.add(target)
            action = "created"
        else:
            if not verify_password(pwd, target.password_hash or ""):
                target.password_hash = hash_password(pwd)
                action = "password_reset"
            else:
                action = "already_ok"
            roles = {str(r).lower() for r in (target.roles or [])}
            admin_roles = {
                UserRole.TENANT_ADMIN.value,
                UserRole.SUPERADMIN.value,
                UserRole.DISPATCHER.value,
            }
            if not (roles & admin_roles):
                target.roles = [UserRole.TENANT_ADMIN.value]
            target.is_active = True
            if name and not str(target.full_name or "").strip():
                target.full_name = name

        await session.commit()
        return {
            "ok": True,
            "action": action,
            "subdomain": sub,
            "tenant_id": str(tid),
            "email": email_l,
            "auth_ok": True,
        }


async def repair_office_admin_bootstraps() -> dict[str, Any]:
    """Run all allowlisted office admin unlocks (boot + Contabo deploy)."""
    reports: list[dict[str, Any]] = []
    for row in _OFFICE_ADMIN_BOOTSTRAPS:
        env_name = str(row.get("password_env") or "").strip()
        env_pw = str(os.getenv(env_name) or "").strip() if env_name else ""
        password = env_pw or str(row.get("password") or "").strip()
        try:
            reports.append(
                await ensure_office_admin_bootstrap(
                    subdomain=str(row.get("subdomain") or ""),
                    email=str(row.get("email") or ""),
                    password=password,
                    full_name=str(row.get("full_name") or ""),
                )
            )
        except Exception as exc:
            logger.exception("office admin bootstrap failed for %s", row.get("subdomain"))
            reports.append(
                {
                    "ok": False,
                    "subdomain": row.get("subdomain"),
                    "reason": f"error:{exc}",
                }
            )
    return {"ok": all(r.get("ok") for r in reports) if reports else True, "reports": reports}
