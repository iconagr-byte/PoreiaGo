"""Repository base — tenant_id on every query + RLS session binding."""

from __future__ import annotations

from typing import Any, Generic, TypeVar
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import TenantIsolationError
from middleware.tenant import apply_tenant_to_session

ModelT = TypeVar("ModelT")


class TenantScopedRepository(Generic[ModelT]):
    """All reads/writes scoped to a single tenant."""

    def __init__(self, session: AsyncSession, tenant_id: UUID, model: type[ModelT]):
        self._session = session
        self._tenant_id = tenant_id
        self._model = model

    async def _ensure_rls(self) -> None:
        await apply_tenant_to_session(self._session, self._tenant_id)

    def _scoped_select(self, *columns) -> Select:
        stmt = select(*columns) if columns else select(self._model)
        if hasattr(self._model, "tenant_id"):
            return stmt.where(self._model.tenant_id == self._tenant_id)
        raise TenantIsolationError(f"Model {self._model.__name__} lacks tenant_id column")

    async def get_by_id(self, resource_id: Any) -> ModelT | None:
        await self._ensure_rls()
        stmt = self._scoped_select().where(self._model.id == resource_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(self, *, limit: int = 100, offset: int = 0) -> list[ModelT]:
        await self._ensure_rls()
        stmt = self._scoped_select().limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
