"""Background worker — daily purge of expired trip_coordinates."""

from __future__ import annotations

import asyncio
import logging
import os

logger = logging.getLogger(__name__)

SWEEP_INTERVAL_SEC = float(os.getenv("TELEMETRY_GPS_RETENTION_SWEEP_SEC", str(24 * 3600)))
_retention_task: asyncio.Task | None = None


async def _gps_retention_loop() -> None:
    from travel_platform.telemetry.gps_retention_service import purge_expired_gps_all

    while True:
        try:
            await asyncio.sleep(SWEEP_INTERVAL_SEC)
            totals = await purge_expired_gps_all()
            if totals:
                deleted = sum(totals.values())
                logger.info("GPS retention sweep deleted %s rows across %s tenants", deleted, len(totals))
                try:
                    from travel_platform.telemetry.fleet_metrics import record_gps_retention_purge

                    for tid, count in totals.items():
                        record_gps_retention_purge(tenant_id=tid, deleted=count)
                except Exception:
                    pass
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("GPS retention sweep failed")


def start_gps_retention_worker() -> None:
    global _retention_task
    if _retention_task and not _retention_task.done():
        return
    _retention_task = asyncio.create_task(_gps_retention_loop())
    logger.info("GPS retention worker started (interval=%ss)", SWEEP_INTERVAL_SEC)
