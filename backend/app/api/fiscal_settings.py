"""Tenant fiscal provider settings API."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    FiscalTestConnectionRequest,
    FiscalTestConnectionResponse,
    TenantFiscalSettingsResponse,
    TenantFiscalSettingsUpdate,
)
from app.core.auth_deps import get_current_tenant_id, get_platform_db, require_roles
from app.models.user import UserRole
from app.services.tenant_fiscal_settings_service import TenantFiscalSettingsService
from core.exceptions import FiscalAPIError
from travel_platform.compliance.fiscal_models import FiscalProvider
from travel_platform.compliance.fiscal_tenant_config import (
    EinvoicingTenantConfig,
    load_tenant_fiscal_config,
)
from travel_platform.compliance.softone_impact_strategy import SoftOneImpactStrategy

router = APIRouter(prefix="/settings", tags=["Tenant Settings"])


@router.get("/fiscal", response_model=TenantFiscalSettingsResponse)
async def get_fiscal_settings(
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    try:
        return await TenantFiscalSettingsService(db).get_settings(tenant_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/fiscal", response_model=TenantFiscalSettingsResponse)
async def update_fiscal_settings(
    body: TenantFiscalSettingsUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    actor_email = request.headers.get("X-Actor-Email")
    try:
        return await TenantFiscalSettingsService(db).update_settings(
            tenant_id,
            body.model_dump(exclude_unset=True),
            actor_email=actor_email,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/fiscal/test-connection", response_model=FiscalTestConnectionResponse)
async def test_fiscal_connection(
    body: FiscalTestConnectionRequest,
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[None, Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.SUPERADMIN))],
):
    """Login-only check for SoftOne / Impact (does not issue a document)."""
    provider_raw = str(body.provider or "").strip().lower()
    try:
        provider = FiscalProvider(provider_raw)
    except ValueError as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Υποστηρίζονται μόνο softone και impact για έλεγχο σύνδεσης",
        ) from exc

    if provider not in (FiscalProvider.SOFTONE, FiscalProvider.IMPACT):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Υποστηρίζονται μόνο softone και impact για έλεγχο σύνδεσης",
        )

    service = TenantFiscalSettingsService(db)
    try:
        tenant = await service._get_tenant(tenant_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    stored = load_tenant_fiscal_config(tenant.settings_json)
    stored_block = None
    if stored:
        stored_block = stored.softone if provider == FiscalProvider.SOFTONE else stored.impact

    default_url = (
        "https://einvoice.s1ecos.gr"
        if provider == FiscalProvider.SOFTONE
        else "https://einvoiceapi.impact.gr"
    )
    api_key = (body.api_key or "").strip()
    if not api_key and stored_block:
        api_key = stored_block.api_key or ""
    api_url = (body.api_url or "").strip() or (stored_block.api_url if stored_block else "") or default_url

    if not api_key:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Απαιτείται API key (ή αποθηκευμένο κλειδί στο γραφείο)",
        )
    if not str(body.issuer_vat or "").strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Απαιτείται ΑΦΜ εκδότη")

    config = EinvoicingTenantConfig(api_url=api_url, api_key=api_key)
    try:
        result = await SoftOneImpactStrategy(provider=provider).test_login(
            config,
            str(body.issuer_vat).strip(),
        )
    except FiscalAPIError as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=str(exc) or "Αποτυχία σύνδεσης στον πάροχο",
        ) from exc

    return FiscalTestConnectionResponse(**result)
