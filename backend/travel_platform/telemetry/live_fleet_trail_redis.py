"""
Redis (or in-memory) ring buffer of live vehicle GPS trails.

Every driver GPS tick appends a point so the admin map can draw the full path
while the vehicle is active, and shift-end can flush the path into history.
"""

from __future__ import annotations

import json
import logging
import math
import os
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

_TRAIL_PREFIX = "fleet:trail:"
_redis = None
_memory: dict[str, list[dict[str, Any]]] = {}


def _max_points() -> int:
    try:
        return max(200, int(os.getenv("FLEET_TRAIL_MAX_POINTS", "3000")))
    except ValueError:
        return 3000


def _min_move_m() -> float:
    try:
        return max(0.5, float(os.getenv("FLEET_TRAIL_MIN_MOVE_M", "3")))
    except ValueError:
        return 3.0


def _ttl_seconds() -> int:
    try:
        return max(3600, int(os.getenv("FLEET_TRAIL_TTL_SEC", "86400")))
    except ValueError:
        return 86400


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
        logger.debug("Fleet trail Redis unavailable: %s", exc)
        return None


def _trail_key(tenant_id: str, vehicle_id: str) -> str:
    return f"{_TRAIL_PREFIX}{tenant_id}:{vehicle_id}"


def _haversine_m(a: dict[str, Any], b: dict[str, Any]) -> float:
    try:
        lat1, lng1 = float(a["lat"]), float(a["lng"])
        lat2, lng2 = float(b["lat"]), float(b["lng"])
    except (KeyError, TypeError, ValueError):
        return 9999.0
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def _point_payload(
    *,
    lat: float,
    lng: float,
    speed_kmh: float | None = None,
    heading_deg: float | None = None,
    recorded_at: datetime | str | None = None,
    trip_id: int | None = None,
    driver_id: str | None = None,
) -> dict[str, Any]:
    if isinstance(recorded_at, datetime):
        ts = recorded_at.astimezone(timezone.utc).isoformat()
    elif recorded_at:
        ts = str(recorded_at)
    else:
        ts = datetime.now(timezone.utc).isoformat()
    return {
        "lat": round(float(lat), 6),
        "lng": round(float(lng), 6),
        "s": round(float(speed_kmh or 0), 1),
        "h": round(float(heading_deg), 1) if heading_deg is not None else None,
        "t": ts,
        "trip_id": trip_id,
        "driver_id": str(driver_id) if driver_id else None,
    }


def _should_append(last: dict[str, Any] | None, nxt: dict[str, Any]) -> bool:
    if not last:
        return True
    return _haversine_m(last, nxt) >= _min_move_m()


async def append_trail_point(
    tenant_id: str,
    vehicle_id: str,
    *,
    lat: float,
    lng: float,
    speed_kmh: float | None = None,
    heading_deg: float | None = None,
    recorded_at: datetime | str | None = None,
    trip_id: int | None = None,
    driver_id: str | None = None,
) -> bool:
    """Append one GPS point to the vehicle trail (deduped by min move)."""
    tid = str(tenant_id or "").strip()
    vid = str(vehicle_id or "").strip()
    if not tid or not vid:
        return False
    if not (-90 <= float(lat) <= 90 and -180 <= float(lng) <= 180):
        return False

    point = _point_payload(
        lat=lat,
        lng=lng,
        speed_kmh=speed_kmh,
        heading_deg=heading_deg,
        recorded_at=recorded_at,
        trip_id=trip_id,
        driver_id=driver_id,
    )
    key = _trail_key(tid, vid)
    max_n = _max_points()
    ttl = _ttl_seconds()

    r = await _get_redis()
    if r:
        try:
            raw_last = await r.lindex(key, -1)
            last = json.loads(raw_last) if raw_last else None
            if not _should_append(last if isinstance(last, dict) else None, point):
                # Refresh TTL even when stationary so trail survives idle.
                await r.expire(key, ttl)
                return False
            pipe = r.pipeline()
            pipe.rpush(key, json.dumps(point, default=str))
            pipe.ltrim(key, -max_n, -1)
            pipe.expire(key, ttl)
            await pipe.execute()
            return True
        except Exception as exc:
            logger.warning("Redis trail append failed: %s", exc)

    # In-process fallback (single worker / Redis down).
    pts = _memory.setdefault(key, [])
    last = pts[-1] if pts else None
    if not _should_append(last, point):
        return False
    pts.append(point)
    if len(pts) > max_n:
        del pts[: len(pts) - max_n]
    return True


async def load_trail(
    tenant_id: str,
    vehicle_id: str,
    *,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    tid = str(tenant_id or "").strip()
    vid = str(vehicle_id or "").strip()
    if not tid or not vid:
        return []
    key = _trail_key(tid, vid)
    cap = limit or _max_points()

    r = await _get_redis()
    if r:
        try:
            raw_list = await r.lrange(key, -cap, -1)
            out: list[dict[str, Any]] = []
            for raw in raw_list or []:
                try:
                    row = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if isinstance(row, dict) and row.get("lat") is not None and row.get("lng") is not None:
                    out.append(row)
            return out
        except Exception as exc:
            logger.debug("Redis trail load failed: %s", exc)

    pts = _memory.get(key) or []
    return pts[-cap:]


async def load_trails_for_tenant(
    tenant_id: str,
    vehicle_ids: list[str],
    *,
    limit: int | None = None,
) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {}
    for vid in vehicle_ids:
        trail = await load_trail(tenant_id, vid, limit=limit)
        if trail:
            out[str(vid)] = trail
    return out


async def drain_trail(tenant_id: str, vehicle_id: str) -> list[dict[str, Any]]:
    """Return all points and delete the trail key (used on shift end → history)."""
    tid = str(tenant_id or "").strip()
    vid = str(vehicle_id or "").strip()
    if not tid or not vid:
        return []
    key = _trail_key(tid, vid)
    points = await load_trail(tid, vid)
    r = await _get_redis()
    if r:
        try:
            await r.delete(key)
        except Exception:
            pass
    _memory.pop(key, None)
    return points


async def delete_trail(tenant_id: str, vehicle_id: str) -> None:
    await drain_trail(tenant_id, vehicle_id)


def clear_memory_trails_for_tests() -> None:
    _memory.clear()


def trail_points_for_api(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compact shape for LiveVehicleResponse (map-friendly)."""
    out: list[dict[str, Any]] = []
    for p in points or []:
        try:
            out.append(
                {
                    "lat": float(p["lat"]),
                    "lng": float(p["lng"]),
                    "t": p.get("t"),
                    "s": p.get("s"),
                    "h": p.get("h"),
                }
            )
        except (KeyError, TypeError, ValueError):
            continue
    return out
