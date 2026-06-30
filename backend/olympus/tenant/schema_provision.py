"""Per-tenant Postgres schema provisioning (Professional tier)."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

TENANT_DATA_TABLES = ("bookings", "users", "audit_logs", "stops", "aade_submissions")


def schema_name_for_tenant(slug: str) -> str:
    safe = slug.replace("-", "_").lower()
    return f"tenant_{safe}"[:63]


async def provision_tenant_schema_tables(
    session: AsyncSession,
    tenant: Tenant,
    *,
    schema: str | None = None,
) -> str:
    """Create tenant-scoped tables inside schema (Professional) or public (dedicated DB)."""
    target_schema = schema or schema_name_for_tenant(tenant.slug)
    if target_schema != "public":
        await session.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{target_schema}"'))

    for table in TENANT_DATA_TABLES:
        await _ensure_table(session, target_schema, table)

    await _ensure_isolation_marker(session, target_schema, tenant.id, target_schema)
    await _enable_schema_rls(session, target_schema, TENANT_DATA_TABLES)

    if target_schema != "public":
        settings = _load_settings(tenant.settings_json)
        settings["pg_schema"] = target_schema
        settings["schema_provisioned_at"] = datetime.now(timezone.utc).isoformat()
        tenant.settings_json = json.dumps(settings, ensure_ascii=False)

    logger.info("Provisioned tenant tables in %s for %s", target_schema, tenant.slug)
    return target_schema


async def provision_tenant_schema(session: AsyncSession, tenant: Tenant) -> str:
    return await provision_tenant_schema_tables(session, tenant)


def mark_dedicated_database_pending(tenant: Tenant) -> None:
    """Legacy helper — prefer olympus.tenant.dedicated_db.provision_dedicated_database."""
    settings = _load_settings(tenant.settings_json)
    settings["dedicated_db"] = {
        "status": "pending",
        "requested_at": datetime.now(timezone.utc).isoformat(),
    }
    tenant.settings_json = json.dumps(settings, ensure_ascii=False)


async def _ensure_table(session: AsyncSession, schema: str, table: str) -> None:
    qualified = f'"{schema}".{table}' if schema != "public" else table
    if table == "bookings":
        ddl = f"""
            CREATE TABLE IF NOT EXISTS {qualified} (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL,
                trip_id UUID,
                customer_user_id UUID,
                reference_code VARCHAR(32) NOT NULL,
                status VARCHAR(32) NOT NULL DEFAULT 'pending',
                seat_label VARCHAR(16),
                passenger_name VARCHAR(255) NOT NULL,
                passenger_email VARCHAR(320),
                amount_eur NUMERIC(12, 2) NOT NULL DEFAULT 0,
                currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
                metadata_json JSONB,
                notes TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """
    elif table == "users":
        ddl = f"""
            CREATE TABLE IF NOT EXISTS {qualified} (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL,
                email VARCHAR(320) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                roles VARCHAR(32)[] NOT NULL DEFAULT '{{customer}}',
                is_active BOOLEAN NOT NULL DEFAULT true,
                mfa_enabled BOOLEAN NOT NULL DEFAULT false,
                mfa_secret_encrypted VARCHAR(512),
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE (tenant_id, email)
            )
        """
    elif table == "audit_logs":
        ddl = f"""
            CREATE TABLE IF NOT EXISTS {qualified} (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL,
                actor_id UUID,
                actor_email VARCHAR(320),
                action VARCHAR(64) NOT NULL,
                resource_type VARCHAR(64) NOT NULL,
                resource_id VARCHAR(64) NOT NULL,
                ip_address INET,
                user_agent VARCHAR(512),
                before_state JSONB,
                after_state JSONB,
                detail TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """
    elif table == "stops":
        ddl = f"""
            CREATE TABLE IF NOT EXISTS {qualified} (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL,
                trip_id UUID,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """
    else:
        ddl = f"""
            CREATE TABLE IF NOT EXISTS {qualified} (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL,
                booking_id UUID NOT NULL,
                idempotency_key VARCHAR(128) NOT NULL UNIQUE,
                status VARCHAR(32) NOT NULL DEFAULT 'queued',
                mark VARCHAR(64),
                aade_uid VARCHAR(128),
                error_message TEXT,
                payload_json JSONB,
                webhook_received_at VARCHAR(64),
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """
    await session.execute(text(ddl))


async def _ensure_isolation_marker(
    session: AsyncSession,
    schema: str,
    tenant_id: UUID,
    schema_name: str,
) -> None:
    qualified = f'"{schema}".isolation_marker' if schema != "public" else "isolation_marker"
    await session.execute(
        text(
            f"""
            CREATE TABLE IF NOT EXISTS {qualified} (
                tenant_id UUID PRIMARY KEY,
                schema_name VARCHAR(63) NOT NULL,
                provisioned_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        ),
    )
    await session.execute(
        text(
            f"""
            INSERT INTO {qualified} (tenant_id, schema_name)
            VALUES (:tid, :schema)
            ON CONFLICT (tenant_id) DO UPDATE SET schema_name = EXCLUDED.schema_name
            """
        ),
        {"tid": str(tenant_id), "schema": schema_name},
    )


async def _enable_schema_rls(session: AsyncSession, schema: str, tables: tuple[str, ...]) -> None:
    for table in tables:
        qualified = f'"{schema}".{table}' if schema != "public" else table
        await session.execute(text(f"ALTER TABLE {qualified} ENABLE ROW LEVEL SECURITY"))
        policy = f"{schema}_{table}_tenant_isolation" if schema != "public" else f"{table}_tenant_isolation"
        await session.execute(text(f'DROP POLICY IF EXISTS {policy} ON {qualified}'))
        await session.execute(
            text(
                f"""
                CREATE POLICY {policy} ON {qualified}
                  USING (tenant_id::text = current_setting('app.current_tenant', true))
                """
            ),
        )


def _load_settings(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}
