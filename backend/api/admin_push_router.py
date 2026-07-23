"""Admin Web Push — ειδοποιήσεις στόλου (JWT SaaS)."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field

from travel_platform.notifications.push_subscription_store import (
    delete_subscription,
    list_subscriptions_for_tenant,
    upsert_subscription,
)
from travel_platform.notifications.web_push_service import (
    ensure_web_push_keys,
    get_public_vapid_key,
    web_push_configured,
)

try:
    from app.core.auth_deps import get_current_tenant_id, get_token_payload
except ImportError:

    async def get_token_payload() -> dict:
        raise HTTPException(status_code=503, detail="SaaS auth not available")

    async def get_current_tenant_id() -> UUID:
        raise HTTPException(status_code=503, detail="SaaS auth not available")


router = APIRouter(prefix="/api/admin/push", tags=["Admin Push"])

_ADMIN_ROLES = {"tenant_admin", "dispatcher", "superadmin"}


class AdminPushSubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=8)
    keys: dict[str, str]
    email: EmailStr
    expirationTime: int | None = None


class AdminPushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=8)
    email: EmailStr


async def _require_admin(payload: Annotated[dict, Depends(get_token_payload)]) -> dict:
    roles = set(payload.get("roles") or [])
    if not roles & _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Απαιτείται ρόλος διαχειριστή")
    return payload


@router.get("/config")
async def push_config(_: Annotated[dict, Depends(_require_admin)]):
    ensure_web_push_keys()
    return {
        "enabled": web_push_configured(),
        "public_key": get_public_vapid_key(),
    }


@router.get("/status")
async def push_status(
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[dict, Depends(_require_admin)],
):
    ensure_web_push_keys()
    subs = list_subscriptions_for_tenant(str(tenant_id), audience="admin")
    return {
        "enabled": web_push_configured(),
        "subscribed": len(subs) > 0,
        "devices": len(subs),
    }


@router.post("/subscribe")
async def push_subscribe(
    body: AdminPushSubscribeRequest,
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _: Annotated[dict, Depends(_require_admin)],
    user_agent: str | None = Header(default=None, alias="User-Agent"),
):
    if not web_push_configured():
        raise HTTPException(status_code=503, detail="Web Push δεν είναι ρυθμισμένο (VAPID)")
    try:
        row = upsert_subscription(
            email=str(body.email).strip().lower(),
            endpoint=body.endpoint,
            keys=body.keys,
            user_agent=user_agent,
            tenant_id=str(tenant_id),
            audience="admin",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "ok": True,
        "id": row["id"],
        "devices": len(list_subscriptions_for_tenant(str(tenant_id), audience="admin")),
    }


@router.delete("/subscribe")
async def push_unsubscribe(
    body: AdminPushUnsubscribeRequest,
    _: Annotated[dict, Depends(_require_admin)],
):
    removed = delete_subscription(email=str(body.email).strip().lower(), endpoint=body.endpoint)
    if not removed:
        raise HTTPException(status_code=404, detail="Η εγγραφή δεν βρέθηκε")
    return {"ok": True}


@router.post("/test")
async def push_test(
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    payload: Annotated[dict, Depends(_require_admin)],
):
    """Send an immediate test Web Push to admin devices for this tenant."""
    from travel_platform.notifications.push_subscription_store import (
        list_all_subscriptions,
        list_subscriptions_for_email,
        list_subscriptions_for_tenant,
    )
    from travel_platform.notifications.web_push_service import (
        ensure_web_push_keys,
        send_push_to_subscription,
        web_push_configured,
    )

    ensure_web_push_keys()
    if not web_push_configured():
        raise HTTPException(status_code=503, detail="Web Push δεν είναι ρυθμισμένο (VAPID)")

    email = str(payload.get("email") or "").strip().lower()
    body = {
        "title": "Δοκιμή Push — PoreiaGo",
        "body": "Οι ειδοποιήσεις βάρδιας λειτουργούν σε αυτόν τον υπολογιστή.",
        "tag": "admin-push-test",
        "url": "/admin?tab=fleet_live_map",
        "data": {"type": "driver_shift", "event": "test", "tab": "fleet_live_map"},
        "requireInteraction": True,
    }

    seen: set[str] = set()
    attempted = 0
    sent = 0

    async def _try(sub: dict) -> None:
        nonlocal attempted, sent
        endpoint = str(sub.get("endpoint") or "")
        if not endpoint or endpoint in seen:
            return
        seen.add(endpoint)
        attempted += 1
        result = await send_push_to_subscription(sub, body)
        if result.get("sent"):
            sent += 1

    for sub in list_subscriptions_for_tenant(str(tenant_id), audience="admin"):
        await _try(sub)
    if email:
        for sub in list_subscriptions_for_email(email, audience="admin"):
            await _try(sub)
    if attempted == 0:
        for sub in list_all_subscriptions(audience="admin"):
            await _try(sub)

    if attempted == 0:
        raise HTTPException(
            status_code=404,
            detail="Δεν υπάρχει εγγραφή push — πατήστε «Ενεργοποίηση push» πρώτα",
        )
    return {"ok": True, "attempted": attempted, "sent": sent}
