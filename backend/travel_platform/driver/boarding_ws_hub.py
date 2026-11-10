"""Trip-scoped boarding WebSocket hub — office / driver tablets."""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class BoardingConnectionManager:
    def __init__(self) -> None:
        self._by_trip: dict[int, list[WebSocket]] = {}

    async def connect(self, trip_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._by_trip.setdefault(int(trip_id), []).append(websocket)

    def disconnect(self, trip_id: int, websocket: WebSocket) -> None:
        tid = int(trip_id)
        conns = self._by_trip.get(tid) or []
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self._by_trip.pop(tid, None)

    async def broadcast(self, trip_id: int, payload: dict[str, Any]) -> int:
        tid = int(trip_id)
        conns = list(self._by_trip.get(tid) or [])
        if not conns:
            return 0
        body = json.dumps(payload, ensure_ascii=False, default=str)
        dead: list[WebSocket] = []
        sent = 0
        for ws in conns:
            try:
                await ws.send_text(body)
                sent += 1
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(tid, ws)
        return sent


boarding_manager = BoardingConnectionManager()


async def broadcast_boarding_update(trip_id: int, payload: dict[str, Any]) -> int:
    return await boarding_manager.broadcast(int(trip_id), payload)
