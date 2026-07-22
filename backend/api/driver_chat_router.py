"""Driver ↔ office chat API — driver JWT endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from api.driver_portal import require_driver_session
from travel_platform.driver.chat_store import (
    append_message,
    list_messages,
    mark_thread_read,
    unread_counts,
)
from travel_platform.settings.drivers_store import get_driver

router = APIRouter(prefix="/api/driver/chat", tags=["driver-chat"])


class ChatSendBody(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


def _driver_context(session: dict) -> tuple[str, str, int | None, str | None]:
    tenant_id = str(session.get("tenant_id") or "")
    driver_id = str(session.get("sub") or session.get("driver_id") or "")
    if not tenant_id or not driver_id or driver_id == "master-qr-driver":
        raise HTTPException(status_code=403, detail="Απαιτείται συνεδρία οδηγού")
    trip_id = session.get("trip_id")
    try:
        trip = int(trip_id) if trip_id is not None else None
    except (TypeError, ValueError):
        trip = None
    driver = get_driver(driver_id)
    name = driver.name if driver else None
    return tenant_id, driver_id, trip, name


@router.get("/messages")
async def driver_list_messages(
    after: str | None = Query(default=None),
    limit: int = Query(100, ge=1, le=500),
    session_payload: dict = Depends(require_driver_session),
):
    tenant_id, driver_id, _, _ = _driver_context(session_payload)
    messages = list_messages(
        tenant_id=tenant_id,
        driver_id=driver_id,
        after_id=after,
        limit=limit,
        viewer="driver",
    )
    counts = unread_counts(tenant_id=tenant_id, driver_id=driver_id)
    return {
        "driver_id": driver_id,
        "messages": messages,
        "unread": counts.get("driver", 0),
    }


@router.post("/messages")
async def driver_send_message(
    body: ChatSendBody,
    session_payload: dict = Depends(require_driver_session),
):
    tenant_id, driver_id, trip_id, name = _driver_context(session_payload)
    try:
        row = append_message(
            tenant_id=tenant_id,
            driver_id=driver_id,
            sender="driver",
            body=body.body,
            trip_id=trip_id,
            sender_name=name,
            sender_user_id=driver_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "message": row}


@router.post("/read")
async def driver_mark_read(session_payload: dict = Depends(require_driver_session)):
    tenant_id, driver_id, _, _ = _driver_context(session_payload)
    changed = mark_thread_read(tenant_id=tenant_id, driver_id=driver_id, reader="driver")
    return {"ok": True, "marked": changed}
