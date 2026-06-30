"""Lost & found — customer reports + admin control panel."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
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
async def list_lost_items_admin():
    """Όλες οι δηλώσεις — Control Panel."""
    items = await list_all_lost_items()
    return {
        "items": [_to_admin_row(i) for i in items],
        "total": len(items),
    }


@router.patch("/api/lost-items/{item_id}")
async def patch_lost_item_admin(item_id: str, body: LostItemStatusBody):
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
    return created
