"""Customer Web Push subscription API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from api.customer_auth import get_current_customer
from travel_platform.notifications.fcm_push_service import fcm_configured
from travel_platform.notifications.push_subscription_store import (
    delete_subscription,
    list_subscriptions_for_email,
    upsert_subscription,
)
from travel_platform.notifications.web_push_service import (
    ensure_web_push_keys,
    get_public_vapid_key,
    push_configured,
    web_push_configured,
)

router = APIRouter(prefix="/api/push", tags=["Customer Push"])


class PushSubscribeRequest(BaseModel):
    endpoint: str | None = Field(default=None, min_length=8)
    keys: dict[str, str] | None = None
    expirationTime: int | None = None
    channel: str = "web"
    platform: str | None = None
    token: str | None = None


class PushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=8)


@router.get("/config")
async def push_config():
    ensure_web_push_keys()
    web_ok = web_push_configured()
    fcm_ok = fcm_configured()
    return {
        "enabled": web_ok or fcm_ok,
        "public_key": get_public_vapid_key(),
        "web_push": web_ok,
        "fcm": fcm_ok,
    }


@router.get("/status")
async def push_status(customer: dict = Depends(get_current_customer)):
    ensure_web_push_keys()
    email = str(customer.get("email") or "").strip().lower()
    subs = list_subscriptions_for_email(email)
    return {
        "enabled": push_configured(),
        "subscribed": len(subs) > 0,
        "devices": len(subs),
        "web_push": web_push_configured(),
        "fcm": fcm_configured(),
    }


@router.post("/subscribe")
async def push_subscribe(
    body: PushSubscribeRequest,
    customer: dict = Depends(get_current_customer),
    user_agent: str | None = Header(default=None, alias="User-Agent"),
):
    ensure_web_push_keys()
    channel = str(body.channel or "web").strip().lower() or "web"
    if channel == "fcm":
        if not (body.token or body.endpoint):
            raise HTTPException(status_code=400, detail="Missing FCM token")
    elif not web_push_configured():
        raise HTTPException(status_code=503, detail="Web Push is not configured on this server")
    email = str(customer.get("email") or "").strip().lower()
    try:
        row = upsert_subscription(
            email=email,
            endpoint=str(body.endpoint or body.token or ""),
            keys=body.keys,
            user_agent=user_agent,
            channel=channel,
            platform=body.platform,
            fcm_token=body.token,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "ok": True,
        "id": row["id"],
        "channel": row.get("channel") or channel,
        "devices": len(list_subscriptions_for_email(email)),
    }


@router.delete("/subscribe")
async def push_unsubscribe(body: PushUnsubscribeRequest, customer: dict = Depends(get_current_customer)):
    email = str(customer.get("email") or "").strip().lower()
    removed = delete_subscription(email=email, endpoint=body.endpoint)
    if not removed:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {"ok": True, "devices": len(list_subscriptions_for_email(email))}
