"""Heal audit_logs schema drift that makes GDPR Audit Trail return 500.

Common Contabo/VPS failure: table exists from early SaaS migration but
``created_at`` (added in alembic 004) was never applied — list_logs then
crashes on ``ORDER BY created_at``.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

_healed = False

_HEAL_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        actor_id UUID,
        actor_email VARCHAR(320),
        action VARCHAR(32) NOT NULL,
        resource_type VARCHAR(64) NOT NULL,
        resource_id VARCHAR(64) NOT NULL,
        ip_address INET,
        user_agent VARCHAR(512),
        before_state JSONB,
        after_state JSONB,
        detail TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ",
    "UPDATE audit_logs SET created_at = now() WHERE created_at IS NULL",
    "ALTER TABLE audit_logs ALTER COLUMN created_at SET DEFAULT now()",
    """
    DO $$
    BEGIN
      BEGIN
        ALTER TABLE audit_logs ALTER COLUMN created_at SET NOT NULL;
      EXCEPTION WHEN others THEN
        NULL;
      END;
    END $$;
    """,
    "CREATE INDEX IF NOT EXISTS ix_audit_logs_tenant_id ON audit_logs (tenant_id)",
    "CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at)",
    "CREATE INDEX IF NOT EXISTS ix_audit_logs_resource_type ON audit_logs (resource_type)",
    "CREATE INDEX IF NOT EXISTS ix_audit_logs_resource_id ON audit_logs (resource_id)",
    # Widen action values beyond original create/update/delete CHECK (if present).
    """
    DO $$
    DECLARE
      cname text;
    BEGIN
      FOR cname IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'audit_logs'
          AND nsp.nspname = 'public'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%action%'
      LOOP
        EXECUTE format('ALTER TABLE audit_logs DROP CONSTRAINT %I', cname);
      END LOOP;
    END $$;
    """,
)


async def ensure_audit_logs_schema(session: AsyncSession, *, force: bool = False) -> bool:
    """Add missing audit_logs.created_at (and table) when needed."""
    global _healed
    if _healed and not force:
        return True
    try:
        for stmt in _HEAL_STATEMENTS:
            await session.execute(text(stmt))
        await session.commit()
        _healed = True
        logger.info("Audit logs schema healed (created_at / action checks)")
        return True
    except Exception as exc:
        await session.rollback()
        logger.warning("Audit logs schema ensure failed: %s", exc)
        return False


def is_audit_logs_schema_drift_error(exc: BaseException) -> bool:
    msg = f"{exc.__class__.__name__}: {exc}".lower()
    if "undefinedcolumn" in msg or "does not exist" in msg:
        if "audit_logs" in msg or "created_at" in msg:
            return True
    if "undefinedtable" in msg and "audit_logs" in msg:
        return True
    if "check constraint" in msg and "audit" in msg:
        return True
    return False


async def ensure_audit_logs_schema_best_effort(session: Any | None = None) -> bool:
    if session is not None:
        try:
            return await ensure_audit_logs_schema(session, force=True)
        except Exception:
            logger.exception("Audit logs schema heal via provided session failed")
            return False
    try:
        from app.core.database import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            return await ensure_audit_logs_schema(db, force=True)
    except Exception:
        logger.exception("Audit logs schema heal bootstrap failed")
        return False
