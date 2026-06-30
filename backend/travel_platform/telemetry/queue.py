"""
Telemetry ingestion queue — Redis Streams for high throughput (thousands/min).
Falls back to asyncio in-memory queue when Redis unavailable (dev).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, Awaitable, Callable

logger = logging.getLogger(__name__)

STREAM_KEY = "telemetry:ingest"
CONSUMER_GROUP = "telemetry-workers"
CONSUMER_NAME = os.getenv("HOSTNAME", "worker-1")

_redis = None
_memory_queue: asyncio.Queue | None = None
_handler: Callable[[dict[str, Any]], Awaitable[None]] | None = None


async def _get_redis():
    global _redis
    if _redis is not None:
        return _redis
    try:
        import redis.asyncio as aioredis

        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _redis = aioredis.from_url(url, decode_responses=True)
        await _redis.ping()
        return _redis
    except Exception as e:
        logger.warning("Redis unavailable, using in-memory telemetry queue: %s", e)
        return None


async def enqueue_telemetry(payload: dict[str, Any]) -> str:
    """Fast ACK path — push to stream and return message id."""
    r = await _get_redis()
    if r:
        msg_id = await r.xadd(STREAM_KEY, {"json": json.dumps(payload)}, maxlen=500_000)
        return str(msg_id)
    q = _memory_queue_instance()
    await q.put(payload)
    return f"mem-{id(payload)}"


def _memory_queue_instance() -> asyncio.Queue:
    global _memory_queue
    if _memory_queue is None:
        _memory_queue = asyncio.Queue(maxsize=100_000)
    return _memory_queue


async def ensure_consumer_group() -> None:
    r = await _get_redis()
    if not r:
        return
    try:
        await r.xgroup_create(STREAM_KEY, CONSUMER_GROUP, id="0", mkstream=True)
    except Exception as e:
        if "BUSYGROUP" not in str(e):
            logger.debug("xgroup_create: %s", e)


async def start_consumer(handler: Callable[[dict[str, Any]], Awaitable[None]]) -> None:
    """Start background consumer (call from FastAPI lifespan)."""
    global _handler
    _handler = handler
    await ensure_consumer_group()
    asyncio.create_task(_consume_loop())


async def _consume_loop() -> None:
    assert _handler is not None
    while True:
        r = await _get_redis()
        if r:
            try:
                entries = await r.xreadgroup(
                    CONSUMER_GROUP,
                    CONSUMER_NAME,
                    {STREAM_KEY: ">"},
                    count=100,
                    block=2000,
                )
                for _stream, messages in entries or []:
                    for msg_id, fields in messages:
                        try:
                            data = json.loads(fields.get("json", "{}"))
                            await _handler(data)
                            await r.xack(STREAM_KEY, CONSUMER_GROUP, msg_id)
                        except Exception:
                            logger.exception("telemetry process failed id=%s", msg_id)
            except Exception:
                logger.exception("redis xreadgroup error")
                await asyncio.sleep(1)
        else:
            q = _memory_queue_instance()
            try:
                payload = await asyncio.wait_for(q.get(), timeout=2.0)
                await _handler(payload)
            except asyncio.TimeoutError:
                pass
            except Exception:
                logger.exception("memory queue handler error")
