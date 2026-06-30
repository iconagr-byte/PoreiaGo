"""Customer Web Push subscription API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from api.customer_auth import get_current_customer
from travel_platform.notifications.push_subscription_store import (
    delete_subscription,
    list_subscriptions_for_email,
    upsert_subscription,
)
from travel_platform.notifications.web_push_service import get_public_vapid_key, web_push_configured

router = APIRouter(prefix="/api/push", tags=["Customer Push"])


class PushSubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=8)
    keys: dict[str, str]
    expirationTime: int | None = None


class PushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=8)


@router.get("/config")
async def push_config():
    return {
        "enabled": web_push_configured(),
        "public_key": get_public_vapid_key(),
    }


@router.get("/status")
async def push_status(customer: dict = Depends(get_current_customer)):
    email = str(customer.get("email") or "").strip().lower()
    subs = list_subscriptions_for_email(email)
    return {
        "enabled": web_push_configured(),
        "subscribed": len(subs) > 0,
        "devices": len(subs),
    }


@router.post("/subscribe")
async def push_subscribe(
    body: PushSubscribeRequest,
    customer: dict = Depends(get_current_customer),
    user_agent: str | None = Header(default=None, alias="User-Agent"),
):
    if not web_push_configured():
        raise HTTPException(status_code=503, detail="Web Push is not configured on this server")
    email = str(customer.get("email") or "").strip().lower()
    try:
        row = upsert_subscription(
            email=email,
            endpoint=body.endpoint,
            keys=body.keys,
            user_agent=user_agent,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "id": row["id"], "devices": len(list_subscriptions_for_email(email))}


@router.delete("/subscribe")
async def push_unsubscribe(body: PushUnsubscribeRequest, customer: dict = Depends(get_current_customer)):
    email = str(customer.get("email") or "").strip().lower()
    removed = delete_subscription(email=email, endpoint=body.endpoint)
    if not removed:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {"ok": True, "devices": len(list_subscriptions_for_email(email))}
