"""
Background tasks — abandoned recovery, AADE transmission, webhook retry.
"""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from core.config import platform_settings
from database import DATABASE_URL
from travel_platform.revenue.abandoned_recovery import AbandonedBookingRecoveryService
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)

_engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


def _run_async(coro):
    return asyncio.run(coro)


@celery_app.task(name="workers.tasks.scan_pre_departure_sms", bind=True, max_retries=2)
def scan_pre_departure_sms(self):
    """Every 5m: SMS passengers not boarded near departure."""
    try:
        return _run_async(_scan_pre_departure_sms_async())
    except Exception as exc:
        logger.exception("Pre-departure SMS failed")
        raise self.retry(exc=exc, countdown=120) from exc


async def _scan_pre_departure_sms_async() -> dict:
    from ticketing.sms_jobs import scan_all_trips_pre_departure_sms

    return await scan_all_trips_pre_departure_sms(minutes_before=5)


@celery_app.task(name="workers.tasks.scan_abandoned_file_carts", bind=True, max_retries=3)
def scan_abandoned_file_carts(self):
    """Every 15m: file-backed abandoned carts → email/SMS recovery."""
    try:
        return _run_async(_scan_abandoned_file_async())
    except Exception as exc:
        logger.exception("Abandoned file recovery failed")
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


async def _scan_abandoned_file_async() -> dict:
    from travel_platform.revenue.abandoned_carts import scan_and_send_recovery

    return await scan_and_send_recovery()


@celery_app.task(name="workers.tasks.scan_abandoned_bookings_all_tenants", bind=True, max_retries=3)
def scan_abandoned_bookings_all_tenants(self):
    """Every 15m: Postgres PENDING bookings > N minutes (when SaaS DB has rows)."""
    try:
        return _run_async(_scan_abandoned_async())
    except Exception as exc:
        logger.exception("Abandoned Postgres recovery failed")
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


async def _scan_abandoned_async() -> dict:
    stats = {"tenants": 0, "candidates": 0, "sent": 0}
    async with SessionLocal() as session:
        result = await session.execute(
            text("SELECT DISTINCT tenant_id::text AS tid FROM bookings WHERE status = 'PENDING'"),
        )
        tenant_ids = [row["tid"] for row in result.mappings()]
        for tid in tenant_ids:
            stats["tenants"] += 1
            svc = AbandonedBookingRecoveryService(session, UUID(tid))
            candidates = await svc.find_recovery_candidates()
            stats["candidates"] += len(candidates)
            for c in candidates:
                if await svc.process_candidate(c):
                    stats["sent"] += 1
        await session.commit()
    logger.info("Abandoned recovery stats: %s", stats)
    return stats


@celery_app.task(name="workers.tasks.process_fiscal_receipt", bind=True, max_retries=5)
def process_fiscal_receipt(self, fiscal_invoice_id: str):
    """Issue fiscal receipt for a captured payment — runs after booking DB commit."""
    try:
        return _run_async(_process_fiscal_receipt_async(fiscal_invoice_id))
    except Exception as exc:
        logger.exception("Fiscal receipt processing failed id=%s", fiscal_invoice_id)
        raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries)) from exc


async def _process_fiscal_receipt_async(fiscal_invoice_id: str) -> dict:
    from uuid import UUID

    from app.workers.fiscal_receipt_worker import process_fiscal_receipt as run_receipt

    async with SessionLocal() as session:
        result = await run_receipt(session, UUID(fiscal_invoice_id))
        await session.commit()
        return result


@celery_app.task(name="workers.tasks.issue_fiscal_invoice", bind=True, max_retries=5)
def issue_fiscal_invoice(self, fiscal_invoice_id: str):
    """Deprecated alias — use process_fiscal_receipt."""
    return _run_async(_process_fiscal_receipt_async(fiscal_invoice_id))


async def _issue_fiscal_invoice_async(fiscal_invoice_id: str) -> dict:
    return await _process_fiscal_receipt_async(fiscal_invoice_id)


@celery_app.task(name="workers.tasks.transmit_aade_document", bind=True, max_retries=5)
def transmit_aade_document(self, payload: dict):
    """Async fiscal transmission — isolated from HTTP request path."""
    try:
        return _run_async(_transmit_aade_async(payload))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))


async def _transmit_aade_async(payload: dict) -> dict:
    from uuid import UUID

    from app.core.auth_deps import apply_tenant_rls
    from app.services.aade_queue_service import AadeQueueService
    from app.services.fiscal_transmission_service import FiscalTransmissionService

    tenant_id = UUID(payload["tenant_id"])
    booking_id = UUID(payload["booking_id"])
    idempotency_key = payload["idempotency_key"]

    async with SessionLocal() as session:
        await apply_tenant_rls(session, tenant_id)
        queue = AadeQueueService(session)
        submission = await queue.enqueue_invoice(
            tenant_id=tenant_id,
            booking_id=booking_id,
            payload=payload.get("payload") or payload,
            idempotency_key=idempotency_key,
        )
        submission_id = submission.id
        await session.commit()

    async with SessionLocal() as session:
        await apply_tenant_rls(session, tenant_id)
        result = await FiscalTransmissionService(session).transmit_submission(submission_id)
        await session.commit()
        return result


@celery_app.task(name="workers.tasks.dispatch_partner_webhook")
def dispatch_partner_webhook(tenant_id: str, event_type: str, payload: dict):
    """Enqueue from booking service after commit."""
    return _run_async(_dispatch_webhook_async(tenant_id, event_type, payload))


@celery_app.task(name="workers.tasks.refresh_all_driver_stats")
def refresh_all_driver_stats():
    return _run_async(_refresh_driver_stats_async())


async def _refresh_driver_stats_async() -> dict:
    from travel_platform.drivers.stats import DriverStatsService

    stats = {"tenants": 0, "drivers": 0}
    async with SessionLocal() as session:
        result = await session.execute(
            text("SELECT DISTINCT tenant_id::text AS tid FROM drivers WHERE status = 'active'"),
        )
        for row in result.mappings():
            stats["tenants"] += 1
            svc = DriverStatsService(session, UUID(row["tid"]))
            count = await svc.refresh_all_active_drivers()
            stats["drivers"] += count
        await session.commit()
    return stats


@celery_app.task(name="workers.tasks.alert_driver_document_expiry")
def alert_driver_document_expiry():
    return _run_async(_alert_documents_async())


async def _alert_documents_async() -> dict:
    from travel_platform.drivers.document_vault import DriverDocumentVaultService

    sent = 0
    async with SessionLocal() as session:
        tenants = await session.execute(text("SELECT DISTINCT tenant_id::text AS tid FROM drivers"))
        for t in tenants.mappings():
            svc = DriverDocumentVaultService(session, UUID(t["tid"]))
            expiring = await svc.find_expiring_documents(within_days=30)
            for doc in expiring:
                logger.warning(
                    "Document expiry alert: driver=%s type=%s expires=%s",
                    doc["driver_id"],
                    doc["doc_type"],
                    doc["expires_at"],
                )
                await svc.mark_alert_sent(UUID(str(doc["id"])))
                sent += 1
        await session.commit()
    return {"alerts_sent": sent}


@celery_app.task(name="workers.tasks.report_stripe_usage_all_tenants", bind=True, max_retries=2)
def report_stripe_usage_all_tenants(self):
    """Daily: snapshot buses/trips per tenant and push metered usage to Stripe."""
    if not platform_settings.usage_metering_enabled:
        return {"skipped": True, "reason": "disabled"}
    try:
        return _run_async(_report_stripe_usage_async())
    except Exception as exc:
        logger.exception("Stripe usage metering failed")
        raise self.retry(exc=exc, countdown=300) from exc


async def _report_stripe_usage_async() -> dict:
    from app.workers.usage_metering_job import run_usage_metering

    return await run_usage_metering(stripe_only=True)


@celery_app.task(name="workers.tasks.retry_failed_fiscal_receipts", bind=True, max_retries=2)
def retry_failed_fiscal_receipts(self):
    """Every ~15m: retry failed fiscal receipts with cooldown and max auto attempts."""
    from app.services.fiscal_auto_retry_service import (
        FiscalAutoRetryService,
        fiscal_auto_retry_settings,
    )

    settings = fiscal_auto_retry_settings()
    if not settings["enabled"]:
        return {"skipped": True, "reason": "disabled"}

    try:
        return _run_async(_retry_failed_fiscal_async(settings))
    except Exception as exc:
        logger.exception("Fiscal auto-retry job failed")
        raise self.retry(exc=exc, countdown=300) from exc


async def _retry_failed_fiscal_async(settings: dict) -> dict:
    from app.services.fiscal_auto_retry_service import FiscalAutoRetryService

    async with SessionLocal() as session:
        svc = FiscalAutoRetryService(
            session,
            max_retries=int(settings["max_retries"]),
            cooldown_minutes=int(settings["cooldown_minutes"]),
            batch_limit=int(settings["batch_limit"]),
        )
        result = await svc.run_all_tenants()
        await session.commit()
        try:
            from app.observability.fiscal_metrics import record_auto_retry

            record_auto_retry(int(result.get("retried", 0)))
        except Exception:
            logger.debug("Fiscal auto-retry metrics skipped", exc_info=True)
        return result


@celery_app.task(name="workers.tasks.recover_stuck_fiscal_receipts", bind=True, max_retries=2)
def recover_stuck_fiscal_receipts(self):
    """Every 10m: re-dispatch pending/queued fiscal invoices stuck too long."""
    from app.services.fiscal_stuck_recovery_service import (
        FiscalStuckRecoveryService,
        fiscal_stuck_recovery_settings,
    )

    settings = fiscal_stuck_recovery_settings()
    if not settings["enabled"]:
        return {"skipped": True, "reason": "disabled"}

    try:
        return _run_async(_recover_stuck_fiscal_async(settings))
    except Exception as exc:
        logger.exception("Fiscal stuck recovery job failed")
        raise self.retry(exc=exc, countdown=300) from exc


async def _recover_stuck_fiscal_async(settings: dict) -> dict:
    from app.services.fiscal_stuck_recovery_service import FiscalStuckRecoveryService

    async with SessionLocal() as session:
        svc = FiscalStuckRecoveryService(
            session,
            stuck_minutes=int(settings["stuck_minutes"]),
            batch_limit=int(settings["batch_limit"]),
        )
        result = await svc.run_all_tenants()
        await session.commit()
        try:
            from app.observability.fiscal_metrics import record_stuck_recovery

            record_stuck_recovery(int(result.get("redispatched", 0)))
        except Exception:
            logger.debug("Fiscal stuck recovery metrics skipped", exc_info=True)
        return result


@celery_app.task(name="workers.tasks.send_fleet_digest_task", bind=True, max_retries=2)
def send_fleet_digest_task(self):
    """Daily fleet digest email/SMS for tenants with recent GPS."""
    from travel_platform.telemetry.fleet_digest_service import fleet_digest_settings

    if not fleet_digest_settings()["enabled"]:
        return {"skipped": True, "reason": "disabled"}
    try:
        return _run_async(_send_fleet_digest_async())
    except Exception as exc:
        logger.exception("Fleet digest task failed")
        raise self.retry(exc=exc, countdown=300) from exc


async def _send_fleet_digest_async() -> dict:
    from travel_platform.telemetry.fleet_digest_notifications import run_fleet_digest_job

    return await run_fleet_digest_job()


async def _dispatch_webhook_async(tenant_id: str, event_type: str, payload: dict) -> dict:
    from travel_platform.growth.partner_api import PartnerWebhookService, WebhookEventType

    async with SessionLocal() as session:
        await session.execute(
            text("SELECT set_config('app.current_tenant', :tid, true)"),
            {"tid": tenant_id},
        )
        svc = PartnerWebhookService(session, UUID(tenant_id))
        event = await svc.publish_event(WebhookEventType(event_type), payload)
        await session.commit()
        return {"event_id": event.id}


@celery_app.task(name="workers.tasks.send_fiscal_pipeline_alert_task", bind=True, max_retries=2)
def send_fiscal_pipeline_alert_task(self, kind: str = "digest"):
    """Daily digest or immediate admin email when fiscal pipeline has issues."""
    from app.services.fiscal_alert_service import fiscal_alert_settings

    settings = fiscal_alert_settings()
    if not settings["enabled"]:
        return {"skipped": True, "reason": "disabled"}
    try:
        return _run_async(_send_fiscal_alert_async(kind))
    except Exception as exc:
        logger.exception("Fiscal pipeline alert task failed kind=%s", kind)
        raise self.retry(exc=exc, countdown=120) from exc


async def _send_fiscal_alert_async(kind: str) -> dict:
    from app.services.fiscal_alert_service import FiscalAlertService
    from ticketing.fiscal_admin_alert_email import send_fiscal_pipeline_alert

    async with SessionLocal() as session:
        snapshot = await FiscalAlertService(session).collect_snapshot()
        result = await send_fiscal_pipeline_alert(snapshot, kind=kind)  # type: ignore[arg-type]
        await session.commit()
        return {"kind": kind, "snapshot": snapshot.get("totals"), **result}
