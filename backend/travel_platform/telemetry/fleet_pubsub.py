"""Redis Pub/Sub for live fleet positions — channel:fleet_loc:<tenant_id>."""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, AsyncIterator

logger = logging.getLogger(__name__)

CHANNEL_PREFIX = "channel:fleet_loc:"
FLEET_ALERTS_CHANNEL = "fleet_alerts"
_redis = None


def fleet_channel(tenant_id: str) -> str:
    return f"{CHANNEL_PREFIX}{tenant_id}"


async def _get_redis():
    global _redis
    if _redis is not None:
        return _redis
    try:
        import redis.asyncio as aioredis

        url = os.getenv("REDIS_URL", os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"))
        client = aioredis.from_url(url, decode_responses=True)
        await client.ping()
        _redis = client
        return _redis
    except Exception as exc:
        logger.warning("Fleet pub/sub Redis unavailable: %s", exc)
        return None


async def publish_fleet_location(tenant_id: str, payload: dict[str, Any]) -> bool:
    r = await _get_redis()
    if not r:
        return False
    body = json.dumps(payload, ensure_ascii=False, default=str)
    await r.publish(fleet_channel(str(tenant_id)), body)
    return True


async def publish_fleet_alert(payload: dict[str, Any]) -> bool:
    """Urgent SOS / incident — Backoffice WebSocket bridge listens on fleet_alerts."""
    r = await _get_redis()
    if not r:
        return False
    body = json.dumps(payload, ensure_ascii=False, default=str)
    await r.publish(FLEET_ALERTS_CHANNEL, body)
    return True


async def subscribe_fleet_alerts() -> AsyncIterator[dict[str, Any]]:
    """Yield SOS / critical alerts from global fleet_alerts channel."""
    r = await _get_redis()
    if not r:
        return
    pubsub = r.pubsub()
    await pubsub.subscribe(FLEET_ALERTS_CHANNEL)
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if not message:
                await asyncio.sleep(0.05)
                continue
            if message.get("type") != "message":
                continue
            data = message.get("data")
            if isinstance(data, bytes):
                data = data.decode("utf-8")
            try:
                yield json.loads(data)
            except json.JSONDecodeError:
                logger.debug("Invalid fleet_alerts JSON")
    finally:
        await pubsub.unsubscribe(FLEET_ALERTS_CHANNEL)
        await pubsub.close()


async def subscribe_fleet_locations(tenant_id: str) -> AsyncIterator[dict[str, Any]]:
    """Yield decoded payloads from tenant fleet channel."""
    r = await _get_redis()
    if not r:
        return
    pubsub = r.pubsub()
    channel = fleet_channel(str(tenant_id))
    await pubsub.subscribe(channel)
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if not message:
                await asyncio.sleep(0.05)
                continue
            if message.get("type") != "message":
                continue
            data = message.get("data")
            if isinstance(data, bytes):
                data = data.decode("utf-8")
            try:
                yield json.loads(data)
            except json.JSONDecodeError:
                logger.debug("Invalid fleet pub/sub JSON")
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
