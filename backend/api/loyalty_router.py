"""Admin Miles+Bonus loyalty API."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from travel_platform.loyalty import loyalty_store as store

try:
    from app.core.auth_deps import get_current_tenant_id, get_token_payload
except ImportError:

    async def get_token_payload() -> dict:
        raise HTTPException(status_code=503, detail="SaaS auth not available")

    async def get_current_tenant_id() -> UUID:
        raise HTTPException(status_code=503, detail="SaaS auth not available")


router = APIRouter(prefix="/api/admin/platform/loyalty", tags=["Loyalty"])

_ADMIN_ROLES = {"tenant_admin", "dispatcher", "superadmin"}


def _require_admin(payload: dict) -> None:
    role = str(payload.get("role") or "").lower()
    if role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Απαιτείται ρόλος διαχειριστή")


class LoyaltyAccountIn(BaseModel):
    client_id: str | None = None
    client_email: str | None = None
    display_name: str | None = None
    lifetime_miles: float | None = None
    redeemable_miles: float | None = None
    tier: str | None = None


class MilesTxIn(BaseModel):
    loyalty_account_id: str
    tx_type: str = Field(default="EARN")
    miles: float
    multiplier: float = 1
    source_kind: str | None = None
    source_id: str | None = None
    distance_km: float | None = None
    notes: str | None = None


@router.get("/accounts")
async def list_accounts(
    payload: dict = Depends(get_token_payload),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    _require_admin(payload)
    return {"items": store.list_accounts(str(tenant_id))}


@router.post("/accounts")
async def create_account(
    body: LoyaltyAccountIn,
    payload: dict = Depends(get_token_payload),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    _require_admin(payload)
    try:
        return store.upsert_account(str(tenant_id), body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/accounts/{account_id}")
async def update_account(
    account_id: str,
    body: LoyaltyAccountIn,
    payload: dict = Depends(get_token_payload),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    _require_admin(payload)
    try:
        return store.upsert_account(str(tenant_id), body.model_dump(exclude_unset=True), account_id=account_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/accounts/{account_id}/transactions")
async def account_transactions(
    account_id: str,
    payload: dict = Depends(get_token_payload),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    _require_admin(payload)
    if not store.get_account(str(tenant_id), account_id):
        raise HTTPException(status_code=404, detail="Ο λογαριασμός δεν βρέθηκε")
    return {"items": store.list_transactions(str(tenant_id), account_id=account_id)}


@router.post("/transactions")
async def create_transaction(
    body: MilesTxIn,
    payload: dict = Depends(get_token_payload),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    _require_admin(payload)
    try:
        return store.post_transaction(str(tenant_id), body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
