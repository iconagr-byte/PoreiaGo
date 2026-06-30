from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from core.dependencies import get_actor_id, get_audit_service, get_tenant_db, get_tenant_id
from travel_platform.compliance.audit_trail import AuditTrailService
from travel_platform.growth.partner_api import PartnerWebhookService, WebhookEventType
from schemas.platform.growth import WebhookRegisterRequest
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.post("/webhooks")
async def register_webhook(
    body: WebhookRegisterRequest,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    actor_id: Annotated[str | None, Depends(get_actor_id)],
    audit: Annotated[AuditTrailService, Depends(get_audit_service)],
):
    svc = PartnerWebhookService(session, tenant_id, audit=audit, actor_id=actor_id)
    event_types = [WebhookEventType(e) for e in body.event_types]
    sub = await svc.register_subscription(body.partner_name, str(body.target_url), event_types)
    return {
        "id": str(sub.id),
        "partner_name": sub.partner_name,
        "target_url": sub.target_url,
        "event_types": sub.event_types,
    }


@router.get("/audit")
async def query_audit_trail(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_db)],
    resource_type: str | None = None,
    financial_only: bool = False,
    limit: int = Query(50, le=500),
):
    from travel_platform.compliance.audit_trail import AuditTrailService

    audit = AuditTrailService(session)
    events = await audit.query(
        tenant_id,
        resource_type=resource_type,
        financial_only=financial_only,
        limit=limit,
    )
    return {"events": events}
