"""Lost & found — customer reports + admin control panel."""

from __future__ import annotations

import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from api.customer_auth import get_current_customer
from ticketing.lost_items import (
    create_lost_item,
    list_all_lost_items,
    list_lost_items_for_email,
    update_lost_item_status,
)

router = APIRouter(tags=["Lost & Found"])


class LostItemCreateBody(BaseModel):
    item_category: str = Field(..., min_length=1, max_length=120)
    description: str = Field(..., min_length=3, max_length=4000)
    last_seen_location: str = Field(..., min_length=2, max_length=500)


class LostItemStatusBody(BaseModel):
    status: str = Field(..., pattern="^(OPEN|FOUND|CLOSED)$")


def _require_admin_jwt(request: Request) -> dict:
    from middleware.tenant import ADMIN_ACCESS_ROLES, _jwt_settings

    secret, algorithm, admin_disabled = _jwt_settings()
    if admin_disabled:
        return {"roles": ["tenant_admin", "superadmin"], "sub": "dev-admin"}
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        payload = pyjwt.decode(auth[7:].strip(), secret, algorithms=[algorithm])
    except pyjwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    roles = set(payload.get("roles") or [])
    if not roles & ADMIN_ACCESS_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload


def _to_admin_row(item: dict) -> dict:
    return {
        "id": item["id"],
        "customerName": item["customerName"],
        "customerEmail": item.get("customerEmail"),
        "itemCategory": item["itemCategory"],
        "description": item["description"],
        "lastSeenLocation": item["lastSeenLocation"],
        "status": item["status"],
        "dateReported": item["dateReported"],
    }


@router.get("/api/lost-items")
async def list_lost_items_admin(request: Request):
    """Όλες οι δηλώσεις — Control Panel (admin JWT required)."""
    _require_admin_jwt(request)
    items = await list_all_lost_items()
    return {
        "items": [_to_admin_row(i) for i in items],
        "total": len(items),
    }


@router.patch("/api/lost-items/{item_id}")
async def patch_lost_item_admin(item_id: str, body: LostItemStatusBody, request: Request):
    _require_admin_jwt(request)
    try:
        updated = await update_lost_item_status(item_id, body.status)
    except ValueError as exc:
        msg = str(exc)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg) from exc
        raise HTTPException(status_code=400, detail=msg) from exc
    return _to_admin_row(updated)


@router.get("/api/customer/lost-items")
async def my_lost_items(account: dict = Depends(get_current_customer)):
    items = await list_lost_items_for_email(account["email"])
    return {"items": items, "total": len(items)}


@router.post("/api/customer/lost-items")
async def report_lost_item(
    body: LostItemCreateBody,
    account: dict = Depends(get_current_customer),
):
    try:
        created = await create_lost_item(
            customer_email=account["email"],
            customer_name=account.get("name") or "",
            customer_id=account.get("customer_id"),
            item_category=body.item_category.strip(),
            description=body.description.strip(),
            last_seen_location=body.last_seen_location.strip(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        from travel_platform.notifications.lost_item_push import notify_lost_item_to_office

        await notify_lost_item_to_office(created)
    except Exception:
        # Report must succeed even if office push fails.
        pass

    return created
