"""Background worker — scheduled fleet digest email/SMS."""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

_worker_task: asyncio.Task | None = None


def _seconds_until_next_digest(hour: int) -> float:
    now = datetime.now(timezone.utc)
    target = now.replace(hour=hour % 24, minute=0, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return max(60.0, (target - now).total_seconds())


async def _fleet_digest_loop() -> None:
    from travel_platform.telemetry.fleet_digest_notifications import run_fleet_digest_job
    from travel_platform.telemetry.fleet_digest_service import fleet_digest_settings

    while True:
        cfg = fleet_digest_settings()
        wait = _seconds_until_next_digest(int(cfg["digest_hour"]))
        try:
            await asyncio.sleep(wait)
            result = await run_fleet_digest_job()
            if result.get("tenants"):
                logger.info("Fleet digest sent for %s tenants", result["tenants"])
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Fleet digest worker tick failed")


def start_fleet_digest_worker() -> None:
    if os.getenv("FLEET_DIGEST_WORKER", "true").lower() in ("0", "false", "no"):
        return
    global _worker_task
    if _worker_task and not _worker_task.done():
        return
    _worker_task = asyncio.create_task(_fleet_digest_loop())
    logger.info("Fleet digest worker started")
