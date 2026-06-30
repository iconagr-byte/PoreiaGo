"""Admin — retry failed SMTP emails from queue."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ticketing.email_dispatch import process_email_retry_queue
from ticketing.email_retry_queue import list_queued_emails

router = APIRouter(tags=["email-retry"])


@router.get("/api/admin/platform/email-retry-queue")
async def get_email_retry_queue(limit: int = Query(default=50, ge=1, le=200)):
    rows = list_queued_emails(limit=limit)
    return {
        "count": len(rows),
        "items": [
            {
                "id": r.get("id"),
                "at": r.get("at"),
                "to": r.get("to"),
                "subject": r.get("subject"),
                "attempts": r.get("attempts"),
                "queue_attempts": r.get("queue_attempts"),
                "last_error": r.get("last_error"),
            }
            for r in rows
        ],
    }


@router.post("/api/admin/platform/email-retry-queue/process")
async def process_email_retry_queue_endpoint(limit: int = Query(default=20, ge=1, le=100)):
    try:
        return await process_email_retry_queue(limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
