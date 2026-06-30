"""Post-commit fiscal receipt dispatch (Celery or inline fallback)."""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

logger = logging.getLogger(__name__)


def dispatch_fiscal_receipt(fiscal_invoice_id: str) -> None:
    """
    Schedule process_fiscal_receipt without blocking the HTTP caller.

    Prefers Celery; falls back to an inline async run (BackgroundTasks / dev).
    """
    try:
        from workers.tasks import process_fiscal_receipt

        process_fiscal_receipt.delay(fiscal_invoice_id)
        from app.observability.fiscal_metrics import record_fiscal_dispatch

        record_fiscal_dispatch("celery")
        return
    except Exception:
        logger.debug("Celery unavailable for fiscal receipt %s", fiscal_invoice_id, exc_info=True)

    from app.observability.fiscal_metrics import record_fiscal_dispatch

    record_fiscal_dispatch("inline")

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_run_process_fiscal_receipt(fiscal_invoice_id))
    except RuntimeError:
        asyncio.run(_run_process_fiscal_receipt(fiscal_invoice_id))


# Backward-compatible alias
dispatch_fiscal_issuance = dispatch_fiscal_receipt


def dispatch_partner_webhook(tenant_id: str, event_type: str, payload: dict) -> None:
    """Schedule partner/ERP webhook delivery without blocking the caller."""
    try:
        from workers.tasks import dispatch_partner_webhook as celery_dispatch

        celery_dispatch.delay(tenant_id, event_type, payload)
        return
    except Exception:
        logger.debug("Celery unavailable for webhook %s", event_type, exc_info=True)

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_run_partner_webhook(tenant_id, event_type, payload))
    except RuntimeError:
        asyncio.run(_run_partner_webhook(tenant_id, event_type, payload))


async def _run_partner_webhook(tenant_id: str, event_type: str, payload: dict) -> dict:
    from workers.tasks import _dispatch_webhook_async

    return await _dispatch_webhook_async(tenant_id, event_type, payload)


async def _run_process_fiscal_receipt(fiscal_invoice_id: str) -> dict:
    from app.core.database import AsyncSessionLocal
    from app.workers.fiscal_receipt_worker import process_fiscal_receipt

    async with AsyncSessionLocal() as db:
        result = await process_fiscal_receipt(db, UUID(fiscal_invoice_id))
        await db.commit()
        return result
