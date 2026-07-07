"""Driver PWA Web Push — εγγραφή συσκευής οδηγού."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from api.driver_portal import require_driver_session
from travel_platform.notifications.push_subscription_store import (
    delete_subscription,
    list_subscriptions_for_driver,
    upsert_subscription,
)
from travel_platform.notifications.web_push_service import get_public_vapid_key, web_push_configured

router = APIRouter(prefix="/api/driver/push", tags=["Driver Push"])


class DriverPushSubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=8)
    keys: dict[str, str]
    expirationTime: int | None = None


class DriverPushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=8)


def _driver_email(session: dict) -> str:
    tenant_id = str(session.get("tenant_id") or "")
    driver_id = str(session.get("sub") or session.get("driver_id") or "device")
    return f"driver:{driver_id}@{tenant_id or 'local'}"


@router.get("/config")
async def driver_push_config():
    return {
        "enabled": web_push_configured(),
        "public_key": get_public_vapid_key(),
    }


@router.get("/status")
async def driver_push_status(session: dict = Depends(require_driver_session)):
    tenant_id = str(session.get("tenant_id") or "")
    driver_id = str(session.get("sub") or session.get("driver_id") or "")
    subs = list_subscriptions_for_driver(tenant_id, driver_id)
    return {
        "enabled": web_push_configured(),
        "subscribed": len(subs) > 0,
        "devices": len(subs),
    }


@router.post("/subscribe")
async def driver_push_subscribe(
    body: DriverPushSubscribeRequest,
    session: dict = Depends(require_driver_session),
    user_agent: str | None = Header(default=None, alias="User-Agent"),
):
    if not web_push_configured():
        raise HTTPException(status_code=503, detail="Web Push δεν είναι ρυθμισμένο (VAPID)")
    tenant_id = str(session.get("tenant_id") or "")
    driver_id = str(session.get("sub") or session.get("driver_id") or "")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Λείπει tenant από τη συνεδρία οδηγού")
    try:
        row = upsert_subscription(
            email=_driver_email(session),
            endpoint=body.endpoint,
            keys=body.keys,
            user_agent=user_agent,
            tenant_id=tenant_id,
            audience="driver",
            driver_id=driver_id or None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "ok": True,
        "id": row["id"],
        "devices": len(list_subscriptions_for_driver(tenant_id, driver_id)),
    }


@router.delete("/subscribe")
async def driver_push_unsubscribe(
    body: DriverPushUnsubscribeRequest,
    session: dict = Depends(require_driver_session),
):
    removed = delete_subscription(email=_driver_email(session), endpoint=body.endpoint)
    if not removed:
        raise HTTPException(status_code=404, detail="Η εγγραφή δεν βρέθηκε")
    return {"ok": True}
