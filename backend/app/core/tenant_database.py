"""Per-tenant database connection routing (Enterprise dedicated DB)."""

from __future__ import annotations

import logging
from urllib.parse import urlparse, urlunparse
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal, engine as master_engine
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

_engine_cache: dict[str, AsyncEngine] = {}
_session_factory_cache: dict[str, async_sessionmaker[AsyncSession]] = {}


def resolve_tenant_database_url(tenant: Tenant) -> str:
    if tenant.database_dsn:
        return tenant.database_dsn
    return get_settings().database_url


def dedicated_database_name(slug: str) -> str:
    safe = slug.replace("-", "_").lower()
    return f"olympus_tenant_{safe}"[:63]


def build_dedicated_database_url(master_url: str, db_name: str) -> str:
    parsed = urlparse(master_url.replace("postgresql+asyncpg://", "postgresql://"))
    path = f"/{db_name}"
    rebuilt = parsed._replace(path=path)
    dsn = urlunparse(rebuilt)
    return dsn.replace("postgresql://", "postgresql+asyncpg://", 1)


def get_engine_for_url(database_url: str) -> AsyncEngine:
    cached = _engine_cache.get(database_url)
    if cached is not None:
        return cached
    settings = get_settings()
    cached = create_async_engine(
        database_url,
        echo=settings.debug,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )
    _engine_cache[database_url] = cached
    return cached


def get_session_factory_for_url(database_url: str) -> async_sessionmaker[AsyncSession]:
    cached = _session_factory_cache.get(database_url)
    if cached is not None:
        return cached
    tenant_engine = get_engine_for_url(database_url)
    cached = async_sessionmaker(
        bind=tenant_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    _session_factory_cache[database_url] = cached
    return cached


def get_session_factory_for_tenant(tenant: Tenant) -> async_sessionmaker[AsyncSession]:
    url = resolve_tenant_database_url(tenant)
    if url == get_settings().database_url:
        return AsyncSessionLocal
    return get_session_factory_for_url(url)


async def load_tenant_from_master(tenant_id: UUID) -> Tenant | None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
        return result.scalar_one_or_none()


async def tenant_uses_dedicated_database(tenant_id: UUID) -> bool:
    tenant = await load_tenant_from_master(tenant_id)
    return bool(tenant and tenant.database_dsn)


def master_engine_for_ops() -> AsyncEngine:
    return master_engine
