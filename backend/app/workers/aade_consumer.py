"""
Redis consumer for AADE queue — run as separate process:

    python -m app.workers.aade_consumer
"""

from __future__ import annotations

import asyncio
import json
import logging
from uuid import UUID

import redis.asyncio as aioredis

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.core.auth_deps import apply_tenant_rls
from app.services.aade_queue_service import AadeQueueService
from app.services.fiscal_transmission_service import FiscalTransmissionService
from core.exceptions import FiscalAPIError

logger = logging.getLogger(__name__)


async def process_message(raw: str) -> None:
    data = json.loads(raw)
    tenant_id = data["tenant_id"]
    submission_id = data["submission_id"]

    async with AsyncSessionLocal() as session:
        await apply_tenant_rls(session, UUID(tenant_id))
        svc = AadeQueueService(session)
        try:
            result = await FiscalTransmissionService(session).transmit_submission(UUID(submission_id))
            logger.info(
                "AADE consumer success submission=%s provider=%s mark=%s",
                submission_id,
                result.get("provider"),
                result.get("mark"),
            )
            await session.commit()
        except FiscalAPIError as exc:
            logger.exception("AADE worker failure submission=%s", submission_id)
            await svc.mark_failed(UUID(submission_id), str(exc.message))
            await session.commit()
        except Exception as exc:
            logger.exception("AADE worker failure submission=%s", submission_id)
            await svc.mark_failed(UUID(submission_id), str(exc))
            await session.commit()


async def run_consumer() -> None:
    settings = get_settings()
    r = aioredis.from_url(settings.redis_url, decode_responses=True)
    logger.info("AADE consumer listening on %s", settings.aade_queue_key)
    while True:
        item = await r.blpop(settings.aade_queue_key, timeout=5)
        if not item:
            await asyncio.sleep(0.1)
            continue
        _, raw = item
        await process_message(raw)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_consumer())


if __name__ == "__main__":
    main()
