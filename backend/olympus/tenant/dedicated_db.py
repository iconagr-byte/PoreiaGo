"""Enterprise tier — dedicated Postgres database provisioning."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.tenant_database import build_dedicated_database_url, dedicated_database_name
from app.models.tenant import Tenant
from olympus.tenant.schema_provision import provision_tenant_schema_tables

logger = logging.getLogger(__name__)


async def provision_dedicated_database(session: AsyncSession, tenant: Tenant) -> str:
    """Create dedicated DB (when allowed) and store DSN on tenant row."""
    settings = get_settings()
    db_name = dedicated_database_name(tenant.slug)
    dsn = build_dedicated_database_url(settings.database_url, db_name)

    if settings.tenant_dedicated_db_auto_provision:
        await _create_database_if_missing(settings.database_url, db_name)
        await _bootstrap_dedicated_schema(dsn, tenant)
        tenant.database_dsn = dsn
        status = "active"
        logger.info("Dedicated database %s provisioned for tenant %s", db_name, tenant.slug)
    else:
        status = "pending"
        logger.warning(
            "Dedicated database %s pending for tenant %s — set TENANT_DEDICATED_DB_AUTO_PROVISION=1",
            db_name,
            tenant.slug,
        )

    meta = _load_settings(tenant.settings_json)
    meta["dedicated_db"] = {
        "status": status,
        "database_name": db_name,
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "provisioned_at": datetime.now(timezone.utc).isoformat() if status == "active" else None,
    }
    tenant.settings_json = json.dumps(meta, ensure_ascii=False)
    return dsn


async def _create_database_if_missing(master_url: str, db_name: str) -> None:
    from app.core.tenant_database import master_engine_for_ops

    engine = master_engine_for_ops()
    async with engine.connect() as conn:
        autocommit = await conn.execution_options(isolation_level="AUTOCOMMIT")
        exists = await autocommit.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": db_name},
        )
        if exists.scalar_one_or_none():
            return
        await autocommit.execute(text(f'CREATE DATABASE "{db_name}"'))
        logger.info("Created dedicated database %s", db_name)


async def _bootstrap_dedicated_schema(dsn: str, tenant: Tenant) -> None:
    from app.core.tenant_database import get_session_factory_for_url

    factory = get_session_factory_for_url(dsn)
    async with factory() as session:
        await provision_tenant_schema_tables(session, tenant, schema="public")
        await session.commit()


def _load_settings(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def parse_master_pg_credentials(database_url: str) -> dict[str, str]:
    parsed = urlparse(database_url.replace("postgresql+asyncpg://", "postgresql://"))
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
    }
