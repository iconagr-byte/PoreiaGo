"""Manage tenant API keys (admin)."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_deps import get_current_tenant_id, get_tenant_db, require_roles
from app.models.api_key import ApiKeyScope
from app.models.user import UserRole
from app.services.api_key_service import ApiKeyService

router = APIRouter(prefix="/api-keys", tags=["SaaS API Keys"])


class ApiKeyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    scope: ApiKeyScope = ApiKeyScope.TELEMETRY


class ApiKeyCreateResponse(BaseModel):
    id: UUID
    name: str
    scope: str
    key: str
    message: str = "Store this key securely — it will not be shown again."


@router.post(
    "",
    response_model=ApiKeyCreateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.TENANT_ADMIN))],
)
async def create_api_key(
    body: ApiKeyCreateRequest,
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
):
    row, raw = await ApiKeyService(db).create_key(
        tenant_id=tenant_id,
        name=body.name,
        scope=body.scope,
    )
    return ApiKeyCreateResponse(
        id=row.id,
        name=row.name,
        scope=row.scope.value,
        key=raw,
    )
