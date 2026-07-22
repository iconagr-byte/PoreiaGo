"""Background sweep — οδηγοί χωρίς πρόσφατο GPS → offline στον admin χάρτη."""

from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)

_watcher_task: asyncio.Task | None = None
SWEEP_INTERVAL_SEC = 15


async def _handle_stale_session(session: dict) -> None:
    from travel_platform.telemetry.driver_shift_notifications import notify_driver_shift
    from travel_platform.telemetry.fleet_metrics import record_stale_offline
    from travel_platform.telemetry.fleet_ws_hub import get_fleet_egress_hub

    tenant_id = str(session.get("tenant_id") or "")
    record_stale_offline(tenant_id)
    driver_id = str(session.get("sub") or session.get("driver_id") or "driver")
    trip_id = session.get("trip_id")
    payload = {
        "type": "fleet_driver_offline",
        "tenant_id": tenant_id,
        "driver_id": driver_id,
        "trip_id": trip_id,
        "reason": "stale_gps",
    }
    if tenant_id:
        await get_fleet_egress_hub().broadcast(tenant_id, payload)
    asyncio.create_task(
        notify_driver_shift("offline", session, body={"reason": "stale_gps"}),
    )


async def _stale_driver_loop() -> None:
    from travel_platform.telemetry.driver_gps_heartbeat import collect_stale_sessions
    from travel_platform.telemetry.settings_store import get_telemetry_settings

    while True:
        try:
            await asyncio.sleep(SWEEP_INTERVAL_SEC)
            settings = get_telemetry_settings()
            stale_seconds = int(getattr(settings, "driver_stale_seconds", 360))
            for session in collect_stale_sessions(stale_seconds=stale_seconds):
                if session:
                    await _handle_stale_session(session)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Stale driver watcher tick failed")


def start_stale_driver_watcher() -> None:
    global _watcher_task
    if _watcher_task and not _watcher_task.done():
        return
    _watcher_task = asyncio.create_task(_stale_driver_loop())
    logger.info("Stale driver GPS watcher started (interval=%ss)", SWEEP_INTERVAL_SEC)
