"""
Partner API — webhook subscriptions and outbound event delivery for hotels, museums, etc.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_service import TenantScopedService
from core.config import platform_settings
from core.exceptions import WebhookDeliveryError

logger = logging.getLogger(__name__)


class WebhookEventType(str, Enum):
    BOOKING_CONFIRMED = "booking.confirmed"
    BOOKING_CANCELLED = "booking.cancelled"
    TRIP_DEPARTED = "trip.departed"
    TRIP_COMPLETED = "trip.completed"
    PASSENGER_BOARDED = "passenger.boarded"
    FISCAL_RECEIPT_ISSUED = "fiscal.receipt_issued"
    FLEET_LOCATION = "fleet.location"


@dataclass(frozen=True)
class WebhookEvent:
    id: str
    type: WebhookEventType
    tenant_id: UUID
    payload: dict[str, Any]
    occurred_at: datetime


@dataclass(frozen=True)
class WebhookSubscription:
    id: UUID
    partner_name: str
    target_url: str
    event_types: list[str]
    secret_ref: str
    active: bool


class PartnerWebhookService(TenantScopedService):
    """Register partners and dispatch signed webhook payloads."""

    async def register_subscription(
        self,
        partner_name: str,
        target_url: str,
        event_types: list[WebhookEventType],
    ) -> WebhookSubscription:
        await self._bind_tenant_rls()
        sub_id = uuid4()
        secret_ref = f"webhook/{self._tenant_id}/{sub_id}"
        await self._session.execute(
            text("""
                INSERT INTO webhook_subscriptions (
                    id, tenant_id, partner_name, target_url, event_types, secret_ref, active
                )
                VALUES (:id, :tenant, :partner, :url, :events::jsonb, :secret, true)
            """),
            {
                "id": str(sub_id),
                "tenant": str(self._tenant_id),
                "partner": partner_name,
                "url": target_url,
                "events": json.dumps([e.value for e in event_types]),
                "secret": secret_ref,
            },
        )
        await self._audit(
            "partner.webhook_registered",
            "webhook_subscription",
            str(sub_id),
            metadata={"partner": partner_name, "url": target_url},
        )
        return WebhookSubscription(
            id=sub_id,
            partner_name=partner_name,
            target_url=target_url,
            event_types=[e.value for e in event_types],
            secret_ref=secret_ref,
            active=True,
        )

    async def publish_event(self, event_type: WebhookEventType, payload: dict[str, Any]) -> WebhookEvent:
        event = WebhookEvent(
            id=str(uuid4()),
            type=event_type,
            tenant_id=self._tenant_id,
            payload=payload,
            occurred_at=datetime.now(timezone.utc),
        )
        subs = await self._active_subscriptions_for(event_type)
        for sub in subs:
            await self._deliver(sub, event)
        return event

    async def _active_subscriptions_for(self, event_type: WebhookEventType) -> list[WebhookSubscription]:
        await self._bind_tenant_rls()
        r = await self._session.execute(
            text("""
                SELECT id, partner_name, target_url, event_types, secret_ref, active
                FROM webhook_subscriptions
                WHERE tenant_id = :tenant AND active = true
                  AND event_types @> :etype::jsonb
            """),
            {"tenant": str(self._tenant_id), "etype": json.dumps([event_type.value])},
        )
        return [
            WebhookSubscription(
                id=UUID(str(row["id"])),
                partner_name=row["partner_name"],
                target_url=row["target_url"],
                event_types=row["event_types"] or [],
                secret_ref=row["secret_ref"],
                active=row["active"],
            )
            for row in r.mappings()
        ]

    async def _deliver(self, sub: WebhookSubscription, event: WebhookEvent) -> None:
        body = json.dumps(
            {
                "id": event.id,
                "type": event.type.value,
                "tenant_id": str(event.tenant_id),
                "occurred_at": event.occurred_at.isoformat(),
                "data": event.payload,
            },
            separators=(",", ":"),
        )
        signing_secret = await self._resolve_secret(sub.secret_ref)
        signature = hmac.new(signing_secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        headers = {
            "Content-Type": "application/json",
            "X-PoreiaGo-Event": event.type.value,
            "X-PoreiaGo-Signature": f"sha256={signature}",
            "X-PoreiaGo-Delivery": event.id,
        }
        timeout = platform_settings.webhook_delivery_timeout_seconds
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(sub.target_url, content=body, headers=headers)
                resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.error("Webhook delivery failed partner=%s: %s", sub.partner_name, e)
            raise WebhookDeliveryError(f"Delivery to {sub.partner_name} failed") from e
        await self._audit(
            "partner.webhook_delivered",
            "webhook_subscription",
            str(sub.id),
            metadata={"event_id": event.id, "event_type": event.type.value},
        )

    async def _resolve_secret(self, secret_ref: str) -> str:
        # Production: Vault.read(secret_ref)
        return platform_settings.webhook_signing_secret or "dev-webhook-secret"
