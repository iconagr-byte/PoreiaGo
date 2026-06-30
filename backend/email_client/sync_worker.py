"""Background IMAP sync — όλοι οι ενεργοί λογαριασμοί EmailSettings."""

from __future__ import annotations

import asyncio
import logging
import os

from .constants import DEFAULT_SYNC_INTERVAL_SEC
from .imap_sync import sync_imap_to_database_async

logger = logging.getLogger(__name__)

_worker_task: asyncio.Task | None = None


async def _sync_loop(interval_sec: int) -> None:
    while True:
        try:
            result = await sync_imap_to_database_async()
            if result.get("synced"):
                logger.info(
                    "IMAP sync: %s messages (%s accounts)",
                    result["synced"],
                    result.get("accounts", 1),
                )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("IMAP background sync failed")
        await asyncio.sleep(interval_sec)


def start_imap_sync_worker() -> asyncio.Task | None:
    global _worker_task
    if os.getenv("IMAP_SYNC_ENABLED", "true").lower() == "false":
        return None
    if _worker_task and not _worker_task.done():
        return _worker_task
    interval = int(os.getenv("IMAP_SYNC_INTERVAL_SEC", str(DEFAULT_SYNC_INTERVAL_SEC)))
    _worker_task = asyncio.create_task(_sync_loop(interval), name="imap-sync-worker")
    logger.info("IMAP sync worker started (interval=%ss)", interval)
    return _worker_task


async def stop_imap_sync_worker() -> None:
    global _worker_task
    if _worker_task and not _worker_task.done():
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
    _worker_task = None
