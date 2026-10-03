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
from travel_platform.notifications.web_push_service import (
    ensure_web_push_keys,
    get_public_vapid_key,
    web_push_configured,
)

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
    ensure_web_push_keys()
    return {
        "enabled": web_push_configured(),
        "public_key": get_public_vapid_key(),
    }


@router.get("/status")
async def driver_push_status(session: dict = Depends(require_driver_session)):
    ensure_web_push_keys()
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
    ensure_web_push_keys()
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


class DriverPushTestRequest(BaseModel):
    endpoint: str | None = Field(default=None, min_length=8)


@router.post("/test")
async def driver_push_test(
    body: DriverPushTestRequest = DriverPushTestRequest(),
    session: dict = Depends(require_driver_session),
):
    """Ping this driver's registered devices (prefer the phone that clicked test)."""
    import time

    from travel_platform.notifications.web_push_service import (
        ensure_web_push_keys,
        send_push_to_subscription,
        web_push_configured,
    )

    ensure_web_push_keys()
    if not web_push_configured():
        raise HTTPException(status_code=503, detail="Web Push δεν είναι ρυθμισμένο (VAPID)")

    tenant_id = str(session.get("tenant_id") or "")
    driver_id = str(session.get("sub") or session.get("driver_id") or "")
    prefer_endpoint = str(body.endpoint or "").strip()
    subs = list_subscriptions_for_driver(tenant_id, driver_id)
    if not subs:
        raise HTTPException(
            status_code=404,
            detail="Δεν υπάρχει εγγραφή push — πατήστε «Ενεργοποίηση push» στο app οδηγού",
        )

    payload = {
        "title": "Δοκιμή Push — Οδηγός",
        "body": "Οι ειδοποιήσεις βάρδιας λειτουργούν σε αυτή τη συσκευή.",
        "tag": f"driver-push-test-{int(time.time())}",
        "url": "/driver",
        "data": {"type": "driver_shift", "event": "test"},
        "requireInteraction": True,
        "renotify": True,
    }

    seen: set[str] = set()
    attempted = 0
    sent = 0
    errors: list[str] = []
    this_device_sent = False

    async def _try(sub: dict) -> None:
        nonlocal attempted, sent, this_device_sent
        endpoint = str(sub.get("endpoint") or "")
        if not endpoint or endpoint in seen:
            return
        seen.add(endpoint)
        attempted += 1
        result = await send_push_to_subscription(sub, payload)
        if result.get("sent"):
            sent += 1
            if prefer_endpoint and endpoint == prefer_endpoint:
                this_device_sent = True
        elif result.get("error"):
            errors.append(str(result["error"])[:160])
        elif result.get("removed"):
            errors.append("ληγμένη εγγραφή — ενεργοποιήστε ξανά")

    if prefer_endpoint:
        match = next((s for s in subs if str(s.get("endpoint") or "") == prefer_endpoint), None)
        if match:
            await _try(match)
    for sub in subs:
        await _try(sub)

    return {
        "ok": True,
        "attempted": attempted,
        "sent": sent,
        "errors": errors[:5],
        "this_device_sent": this_device_sent if prefer_endpoint else None,
    }
