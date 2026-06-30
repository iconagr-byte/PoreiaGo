from __future__ import annotations

import json
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import AadeEnqueueRequest, AadeStatusResponse
from app.core.auth_deps import get_client_ip, get_current_tenant_id, get_current_user_id, get_tenant_db, require_roles
from app.core.config import get_settings
from app.core.webhook import verify_webhook_signature
from app.models.audit import AuditAction
from app.models.user import UserRole
from app.services.aade_queue_service import AadeQueueService
from app.services.audit_service import AuditService

router = APIRouter(prefix="/aade", tags=["SaaS AADE"])


@router.post(
    "/enqueue",
    response_model=AadeStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_roles(UserRole.TENANT_ADMIN, UserRole.DISPATCHER))],
)
async def enqueue_aade(
    body: AadeEnqueueRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    actor_id: Annotated[UUID, Depends(get_current_user_id)],
):
    submission = await AadeQueueService(db).enqueue_invoice(
        tenant_id=tenant_id,
        booking_id=body.booking_id,
        payload=body.payload,
        idempotency_key=body.idempotency_key,
    )
    await AuditService(db).record(
        tenant_id=tenant_id,
        actor_id=actor_id,
        actor_email=None,
        action=AuditAction.CREATE,
        resource_type="aade_submission",
        resource_id=str(submission.id),
        ip_address=await get_client_ip(request),
        detail="queued",
    )
    return AadeStatusResponse(
        submission_id=submission.id,
        status=submission.status.value,
        mark=submission.mark,
    )


@router.get("/status/{submission_id}", response_model=AadeStatusResponse)
async def aade_status(
    submission_id: UUID,
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
):
    from sqlalchemy import select
    from app.models.aade import AadeSubmission

    result = await db.execute(select(AadeSubmission).where(AadeSubmission.id == submission_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return AadeStatusResponse(
        submission_id=row.id,
        status=row.status.value,
        mark=row.mark,
    )


@router.post("/webhook")
async def aade_webhook(request: Request):
    """AADE status callback — HMAC (X-Webhook-Signature) + tenant_id in JSON body."""
    from app.core.auth_deps import apply_tenant_rls
    from app.core.database import AsyncSessionLocal

    body = await request.body()
    settings = get_settings()
    if settings.aade_webhook_secret and not verify_webhook_signature(
        settings.aade_webhook_secret,
        body,
        request.headers.get("X-Webhook-Signature"),
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    try:
        payload = json.loads(body.decode() or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid JSON") from exc

    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="tenant_id required")
    async with AsyncSessionLocal() as db:
        await apply_tenant_rls(db, UUID(str(tenant_id)))
        await AadeQueueService(db).handle_webhook(payload)
        await db.commit()
    return {"ok": True}
