"""Platform health snapshot — DB, Redis, fiscal pipeline."""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


def _redis_ping() -> tuple[bool, str | None]:
    broker = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0").strip()
    if not broker.startswith("redis://"):
        return False, f"unsupported broker: {broker}"
    try:
        import redis

        client = redis.from_url(broker, socket_connect_timeout=2)
        client.ping()
        return True, broker
    except Exception as exc:
        return False, str(exc)


async def check_redis() -> dict[str, Any]:
    try:
        ok, detail = await asyncio.to_thread(_redis_ping)
    except Exception as exc:
        ok, detail = False, str(exc)
    return {
        "status": "ok" if ok else "fail",
        "broker": os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"),
        "detail": None if ok else detail,
    }


async def check_database(session: AsyncSession) -> dict[str, Any]:
    try:
        await session.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:
        logger.warning("Health DB check failed: %s", exc)
        return {"status": "fail", "detail": str(exc)}


async def fiscal_pipeline_snapshot(session: AsyncSession) -> dict[str, Any]:
    from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceStatus
    from app.services.fiscal_auto_retry_service import fiscal_auto_retry_settings
    from app.services.fiscal_stuck_recovery_service import fiscal_stuck_recovery_settings

    counts: dict[str, int] = {}
    for status in FiscalInvoiceStatus:
        result = await session.execute(
            select(func.count())
            .select_from(FiscalInvoice)
            .where(FiscalInvoice.status == status),
        )
        counts[status.value] = int(result.scalar() or 0)

    stuck_settings = fiscal_stuck_recovery_settings()
    stuck_minutes = int(stuck_settings["stuck_minutes"])
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=stuck_minutes)

    stuck_result = await session.execute(
        select(func.count())
        .select_from(FiscalInvoice)
        .where(
            FiscalInvoice.status.in_(
                (FiscalInvoiceStatus.PENDING, FiscalInvoiceStatus.QUEUED),
            ),
            FiscalInvoice.updated_at <= cutoff,
        ),
    )
    stuck_candidates = int(stuck_result.scalar() or 0)

    failed = counts.get(FiscalInvoiceStatus.FAILED.value, 0)
    pending = counts.get(FiscalInvoiceStatus.PENDING.value, 0)
    queued = counts.get(FiscalInvoiceStatus.QUEUED.value, 0)
    issued = counts.get(FiscalInvoiceStatus.ISSUED.value, 0)
    open_count = pending + queued + failed

    if failed > 0 or stuck_candidates > 0:
        health = "degraded"
    elif open_count > 0:
        health = "busy"
    else:
        health = "ok"

    auto_settings = fiscal_auto_retry_settings()
    return {
        "health": health,
        "issued": issued,
        "failed": failed,
        "pending": pending,
        "queued": queued,
        "open": open_count,
        "stuck_candidates": stuck_candidates,
        "pipeline": {
            "auto_retry_enabled": bool(auto_settings["enabled"]),
            "auto_retry_max": int(auto_settings["max_retries"]),
            "stuck_recovery_enabled": bool(stuck_settings["enabled"]),
            "stuck_after_minutes": stuck_minutes,
        },
    }


def resolve_overall_status(
    *,
    db_status: str,
    redis_status: str,
    fiscal_health: str | None,
) -> str:
    if db_status != "ok":
        return "unhealthy"
    if redis_status != "ok":
        return "degraded"
    if fiscal_health == "degraded":
        return "degraded"
    return "ok"


async def build_platform_health(
    session: AsyncSession | None = None,
    *,
    include_fiscal: bool = True,
) -> dict[str, Any]:
    redis = await check_redis()
    db = {"status": "skip"}
    fiscal: dict[str, Any] | None = None

    if session is not None:
        db = await check_database(session)
        if include_fiscal and db.get("status") == "ok":
            try:
                fiscal = await fiscal_pipeline_snapshot(session)
            except Exception as exc:
                logger.warning("Fiscal health snapshot failed: %s", exc)
                fiscal = {"health": "unknown", "error": str(exc)}

    overall = resolve_overall_status(
        db_status=str(db.get("status", "skip")),
        redis_status=str(redis.get("status", "fail")),
        fiscal_health=fiscal.get("health") if fiscal else None,
    )

    payload: dict[str, Any] = {
        "status": overall,
        "service": "aerostride",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "redis": redis,
        "database": db,
    }
    if fiscal is not None:
        payload["fiscal"] = fiscal

    try:
        from app.services.billing_service import stripe_readiness

        billing = stripe_readiness()
        payload["billing"] = {
            "checkout_ready": billing["checkout_ready"],
            "portal_ready": billing["portal_ready"],
        }
    except Exception:
        pass

    return payload
