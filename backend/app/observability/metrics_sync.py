"""Refresh Prometheus gauges from the database on scrape."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.observability.fiscal_metrics import apply_fiscal_snapshot, metrics_enabled

logger = logging.getLogger(__name__)


async def refresh_fiscal_gauges(session: AsyncSession) -> None:
    if not metrics_enabled():
        return
    try:
        from app.services.platform_health_service import fiscal_pipeline_snapshot

        snapshot = await fiscal_pipeline_snapshot(session)
        apply_fiscal_snapshot(snapshot)
    except Exception:
        logger.warning("Failed to refresh fiscal Prometheus gauges", exc_info=True)


def refresh_fleet_prometheus_gauges() -> None:
    if not metrics_enabled():
        return
    try:
        from travel_platform.telemetry.fleet_metrics import refresh_fleet_gauges

        refresh_fleet_gauges()
    except Exception:
        logger.warning("Failed to refresh fleet Prometheus gauges", exc_info=True)
