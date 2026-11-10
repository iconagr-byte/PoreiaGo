"""Prometheus metrics scrape endpoint."""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from app.observability.fiscal_metrics import metrics_enabled
from app.observability.metrics_sync import refresh_fiscal_gauges, refresh_fleet_prometheus_gauges

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Metrics"])


def _metrics_authorized(request: Request) -> bool:
    """Allow scrape when public, or when METRICS_TOKEN matches Bearer/query."""
    public = (os.getenv("METRICS_PUBLIC") or "true").strip().lower() in ("1", "true", "yes", "on")
    token = (os.getenv("METRICS_TOKEN") or "").strip()
    if public and not token:
        return True
    if not token:
        return False
    auth = request.headers.get("Authorization") or ""
    bearer = auth[7:].strip() if auth.startswith("Bearer ") else ""
    q = (request.query_params.get("token") or "").strip()
    return bearer == token or q == token


@router.get("/metrics")
async def prometheus_metrics(request: Request) -> Response:
    """Expose Prometheus text format (fiscal gauges refreshed on each scrape)."""
    if not metrics_enabled():
        raise HTTPException(status_code=404, detail="Metrics disabled")
    if not _metrics_authorized(request):
        raise HTTPException(status_code=401, detail="metrics auth required")

    try:
        from app.core.database import AsyncSessionLocal

        async with AsyncSessionLocal() as session:
            await refresh_fiscal_gauges(session)
    except Exception:
        logger.warning("Metrics scrape: fiscal gauge refresh skipped", exc_info=True)

    refresh_fleet_prometheus_gauges()

    from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
