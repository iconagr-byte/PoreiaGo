"""
Redis mirror of live fleet positions.

WebSockets are often blocked by Traefik/proxies, so the admin map falls back to
HTTP poll. In-memory LiveFleetService alone is empty after restarts / across
workers — this store makes HTTP `/fleet/live` see the latest GPS from any
driver ingest process.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

_KEY_PREFIX = "fleet:live:vehicle:"
_TENANT_INDEX_PREFIX = "fleet:live:tenant:"
_redis = None


def _ttl_seconds() -> int:
    try:
        return max(60, int(os.getenv("FLEET_LIVE_REDIS_TTL_SEC", "180")))
    except ValueError:
        return 180


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
        logger.debug("Live fleet Redis unavailable: %s", exc)
        return None


def _vehicle_key(tenant_id: str, vehicle_id: str) -> str:
    return f"{_KEY_PREFIX}{tenant_id}:{vehicle_id}"


def _tenant_index_key(tenant_id: str) -> str:
    return f"{_TENANT_INDEX_PREFIX}{tenant_id}"


def _json_default(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def serialize_vehicle_meta(meta: dict[str, Any]) -> dict[str, Any]:
    """Normalize meta for Redis JSON (ISO timestamps)."""
    out: dict[str, Any] = {}
    for key, value in meta.items():
        if isinstance(value, datetime):
            out[key] = value.isoformat()
        else:
            out[key] = value
    return out


async def save_live_vehicle(meta: dict[str, Any]) -> bool:
    """Upsert one live vehicle blob. Returns False when Redis is down."""
    tenant_id = str(meta.get("tenant_id") or "").strip()
    vehicle_id = str(meta.get("vehicle_id") or "").strip()
    if not tenant_id or not vehicle_id:
        return False
    if meta.get("lat") is None or meta.get("lng") is None:
        return False

    r = await _get_redis()
    if not r:
        return False

    payload = serialize_vehicle_meta(meta)
    key = _vehicle_key(tenant_id, vehicle_id)
    index = _tenant_index_key(tenant_id)
    ttl = _ttl_seconds()
    try:
        pipe = r.pipeline()
        pipe.set(key, json.dumps(payload, default=_json_default), ex=ttl)
        pipe.sadd(index, vehicle_id)
        pipe.expire(index, ttl)
        await pipe.execute()
        return True
    except Exception as exc:
        logger.warning("Failed to save live vehicle to Redis: %s", exc)
        return False


async def load_live_vehicles(tenant_id: str) -> list[dict[str, Any]]:
    """Load non-expired vehicle metas for a tenant from Redis."""
    tid = str(tenant_id or "").strip()
    if not tid:
        return []
    r = await _get_redis()
    if not r:
        return []

    try:
        vehicle_ids = await r.smembers(_tenant_index_key(tid))
    except Exception as exc:
        logger.debug("Live fleet Redis index read failed: %s", exc)
        return []

    if not vehicle_ids:
        return []

    out: list[dict[str, Any]] = []
    stale: list[str] = []
    for vid in vehicle_ids:
        try:
            raw = await r.get(_vehicle_key(tid, vid))
        except Exception:
            continue
        if not raw:
            stale.append(vid)
            continue
        try:
            meta = json.loads(raw)
        except json.JSONDecodeError:
            stale.append(vid)
            continue
        if not isinstance(meta, dict):
            continue
        if meta.get("lat") is None or meta.get("lng") is None:
            continue
        out.append(meta)

    if stale:
        try:
            await r.srem(_tenant_index_key(tid), *stale)
        except Exception:
            pass
    return out


async def load_live_vehicle(tenant_id: str, vehicle_id: str) -> dict[str, Any]:
    tid = str(tenant_id or "").strip()
    vid = str(vehicle_id or "").strip()
    if not tid or not vid:
        return {}
    r = await _get_redis()
    if not r:
        return {}
    try:
        raw = await r.get(_vehicle_key(tid, vid))
    except Exception:
        return {}
    if not raw:
        return {}
    try:
        meta = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return meta if isinstance(meta, dict) else {}


def parse_updated_at(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        updated = value
    elif isinstance(value, str):
        try:
            updated = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if updated.tzinfo is None:
        updated = updated.replace(tzinfo=timezone.utc)
    return updated
