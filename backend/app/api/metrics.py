"""Prometheus metrics scrape endpoint."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.observability.fiscal_metrics import metrics_enabled
from app.observability.metrics_sync import refresh_fiscal_gauges, refresh_fleet_prometheus_gauges

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Metrics"])


@router.get("/metrics")
async def prometheus_metrics() -> Response:
    """Expose Prometheus text format (fiscal gauges refreshed on each scrape)."""
    if not metrics_enabled():
        raise HTTPException(status_code=404, detail="Metrics disabled")

    try:
        from app.core.database import AsyncSessionLocal

        async with AsyncSessionLocal() as session:
            await refresh_fiscal_gauges(session)
    except Exception:
        logger.warning("Metrics scrape: fiscal gauge refresh skipped", exc_info=True)

    refresh_fleet_prometheus_gauges()

    from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
