"""
AADE / myDATA async gateway — queue submissions, poll status, webhook updates.

HTTP handlers enqueue only; workers transmit via platform AadeGateway.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.aade import AadeSubmission, AadeSubmissionStatus

logger = logging.getLogger(__name__)


class AadeQueueService:
    def __init__(self, session: AsyncSession, redis_client: aioredis.Redis | None = None) -> None:
        self._session = session
        self._settings = get_settings()
        self._redis = redis_client

    async def _redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(self._settings.redis_url, decode_responses=True)
        return self._redis

    async def enqueue_invoice(
        self,
        *,
        tenant_id: UUID,
        booking_id: UUID,
        payload: dict[str, Any],
        idempotency_key: str | None = None,
    ) -> AadeSubmission:
        key = idempotency_key or f"{tenant_id}:{booking_id}:{uuid4().hex[:12]}"
        existing = await self._session.execute(
            select(AadeSubmission).where(AadeSubmission.idempotency_key == key),
        )
        row = existing.scalar_one_or_none()
        if row:
            return row

        submission = AadeSubmission(
            tenant_id=tenant_id,
            booking_id=booking_id,
            idempotency_key=key,
            status=AadeSubmissionStatus.QUEUED,
            payload_json=payload,
        )
        self._session.add(submission)
        await self._session.flush()

        r = await self._redis()
        message = json.dumps(
            {
                "submission_id": str(submission.id),
                "tenant_id": str(tenant_id),
                "booking_id": str(booking_id),
                "idempotency_key": key,
                "payload": payload,
            }
        )
        await r.rpush(self._settings.aade_queue_key, message)
        await r.set(
            f"{self._settings.aade_status_key_prefix}{submission.id}",
            AadeSubmissionStatus.QUEUED.value,
            ex=86400 * 7,
        )
        logger.info("AADE queued submission=%s tenant=%s", submission.id, tenant_id)
        return submission

    async def get_status(self, submission_id: UUID) -> AadeSubmissionStatus | None:
        r = await self._redis()
        cached = await r.get(f"{self._settings.aade_status_key_prefix}{submission_id}")
        if cached:
            return AadeSubmissionStatus(cached)
        result = await self._session.execute(
            select(AadeSubmission).where(AadeSubmission.id == submission_id),
        )
        row = result.scalar_one_or_none()
        return row.status if row else None

    async def mark_processing(self, submission_id: UUID) -> None:
        await self._update_status(submission_id, AadeSubmissionStatus.PROCESSING)

    async def mark_accepted(
        self,
        submission_id: UUID,
        *,
        mark: str,
        aade_uid: str,
    ) -> None:
        result = await self._session.execute(
            select(AadeSubmission).where(AadeSubmission.id == submission_id),
        )
        row = result.scalar_one_or_none()
        if not row:
            return
        row.status = AadeSubmissionStatus.ACCEPTED
        row.mark = mark
        row.aade_uid = aade_uid
        await self._update_status(submission_id, AadeSubmissionStatus.ACCEPTED)

    async def mark_failed(self, submission_id: UUID, error: str) -> None:
        result = await self._session.execute(
            select(AadeSubmission).where(AadeSubmission.id == submission_id),
        )
        row = result.scalar_one_or_none()
        if row:
            row.status = AadeSubmissionStatus.FAILED
            row.error_message = error[:2000]
        await self._update_status(submission_id, AadeSubmissionStatus.FAILED)

    async def handle_webhook(self, payload: dict[str, Any]) -> None:
        """Process AADE callback / polling result."""
        submission_id = payload.get("submission_id")
        status = payload.get("status")
        if not submission_id:
            return
        sid = UUID(str(submission_id))
        if status == "accepted":
            await self.mark_accepted(
                sid,
                mark=str(payload.get("mark", "")),
                aade_uid=str(payload.get("uid", "")),
            )
        elif status in ("rejected", "failed"):
            await self.mark_failed(sid, str(payload.get("error", status)))

    async def _update_status(self, submission_id: UUID, status: AadeSubmissionStatus) -> None:
        r = await self._redis()
        await r.set(
            f"{self._settings.aade_status_key_prefix}{submission_id}",
            status.value,
            ex=86400 * 7,
        )

    @staticmethod
    def poll_payload(submission: AadeSubmission) -> dict[str, Any]:
        return {
            "submission_id": str(submission.id),
            "status": submission.status.value,
            "mark": submission.mark,
            "aade_uid": submission.aade_uid,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
