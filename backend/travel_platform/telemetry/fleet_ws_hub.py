"""WebSocket hub — admin fleet map egress per tenant."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class FleetEgressWsHub:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}

    async def connect(self, tenant_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._rooms.setdefault(str(tenant_id), set()).add(websocket)

    def disconnect(self, tenant_id: str, websocket: WebSocket) -> None:
        room = self._rooms.get(str(tenant_id))
        if not room:
            return
        room.discard(websocket)
        if not room:
            self._rooms.pop(str(tenant_id), None)

    async def broadcast(self, tenant_id: str, payload: dict[str, Any]) -> None:
        room = list(self._rooms.get(str(tenant_id), set()))
        if not room:
            return
        text = json.dumps(payload, default=str)
        dead: list[WebSocket] = []
        for ws in room:
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(tenant_id, ws)

    def connection_count(self) -> int:
        return sum(len(room) for room in self._rooms.values())


_egress_hub = FleetEgressWsHub()
_redis_tasks: dict[str, asyncio.Task] = {}


def get_fleet_egress_hub() -> FleetEgressWsHub:
    return _egress_hub


async def ensure_redis_bridge(tenant_id: str) -> None:
    """Start one Redis→WS bridge task per tenant when first admin connects."""
    tid = str(tenant_id)
    if tid in _redis_tasks and not _redis_tasks[tid].done():
        return

    async def _bridge() -> None:
        from travel_platform.telemetry.fleet_pubsub import subscribe_fleet_locations

        try:
            async for payload in subscribe_fleet_locations(tid):
                await _egress_hub.broadcast(tid, {"type": "fleet_location", **payload})
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Fleet Redis bridge failed tenant=%s", tid)

    _redis_tasks[tid] = asyncio.create_task(_bridge())
