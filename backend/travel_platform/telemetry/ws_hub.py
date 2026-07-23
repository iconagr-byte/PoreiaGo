"""
WebSocket hubs — passenger ETA + admin telemetry alerts.

Push on: ETA refresh, new alert, optional throttled position updates for subscribed trips.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

from travel_platform.telemetry.eta_serializers import snapshot_to_payload

logger = logging.getLogger(__name__)

ETA_PUSH_INTERVAL_SEC = 30


class EtaWsHub:
    def __init__(self) -> None:
        self._rooms: dict[int, set[WebSocket]] = {}
        self._push_task: asyncio.Task | None = None

    def subscriber_count(self, trip_id: int) -> int:
        return len(self._rooms.get(trip_id, set()))

    def active_trip_ids(self) -> list[int]:
        return [tid for tid, conns in self._rooms.items() if conns]

    async def connect(self, trip_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._rooms.setdefault(trip_id, set()).add(websocket)
        self._ensure_push_loop()

    def disconnect(self, trip_id: int, websocket: WebSocket) -> None:
        room = self._rooms.get(trip_id)
        if not room:
            return
        room.discard(websocket)
        if not room:
            self._rooms.pop(trip_id, None)

    async def broadcast_trip(self, trip_id: int, payload: dict[str, Any]) -> None:
        room = list(self._rooms.get(trip_id, set()))
        if not room:
            return
        text = json.dumps(payload)
        dead: list[WebSocket] = []
        for ws in room:
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(trip_id, ws)

    def _ensure_push_loop(self) -> None:
        if self._push_task is None or self._push_task.done():
            self._push_task = asyncio.create_task(self._throttled_eta_push_loop())

    async def _throttled_eta_push_loop(self) -> None:
        from travel_platform.telemetry.eta_intelligence import get_eta_service, push_eta_snapshot
        from uuid import UUID

        demo_tenant = UUID("00000000-0000-0000-0000-000000000001")
        while self.active_trip_ids():
            try:
                eta_svc = get_eta_service()
                for trip_id in self.active_trip_ids():
                    snap = eta_svc.get_cached(demo_tenant, trip_id)
                    if snap:
                        await push_eta_snapshot(snap)
                    else:
                        from travel_platform.telemetry.processor import get_live_fleet

                        live = get_live_fleet()
                        vehicle = next(
                            (v for v in live.list_active(demo_tenant) if v.trip_id == trip_id),
                            None,
                        )
                        if vehicle:
                            snap = await eta_svc.compute_eta(
                                tenant_id=demo_tenant,
                                trip_id=trip_id,
                                origin_lat=vehicle.lat,
                                origin_lng=vehicle.lng,
                            )
                            if snap:
                                eta_svc._cache[(str(demo_tenant), trip_id)] = snap
                                await push_eta_snapshot(snap)
            except Exception:
                logger.exception("ETA WS push loop error")
            await asyncio.sleep(ETA_PUSH_INTERVAL_SEC)


class AlertsWsHub:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}

    async def connect(self, tenant_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._rooms.setdefault(tenant_id, set()).add(websocket)

    def disconnect(self, tenant_id: str, websocket: WebSocket) -> None:
        room = self._rooms.get(tenant_id)
        if not room:
            return
        room.discard(websocket)
        if not room:
            self._rooms.pop(tenant_id, None)

    async def broadcast_alert(self, tenant_id: str, alert: dict[str, Any]) -> None:
        payload = {"type": "telemetry_alert", **alert}
        room = list(self._rooms.get(tenant_id, set()))
        text = json.dumps(payload)
        dead: list[WebSocket] = []
        for ws in room:
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(tenant_id, ws)


_eta_hub = EtaWsHub()
_alerts_hub = AlertsWsHub()


def get_eta_ws_hub() -> EtaWsHub:
    return _eta_hub


def get_alerts_ws_hub() -> AlertsWsHub:
    return _alerts_hub


async def push_eta_snapshot(snap) -> None:
    """Broadcast ETA to passenger WS subscribers."""
    payload = snapshot_to_payload(snap)
    await get_eta_ws_hub().broadcast_trip(snap.trip_id, payload)


async def push_telemetry_alert(alert: dict[str, Any]) -> None:
    """Broadcast to the alert tenant room and legacy demo room (tenant-id drift)."""
    from travel_platform.operations.master_qr_local import DEFAULT_TENANT

    primary = str(alert.get("tenant_id") or "").strip()
    rooms = []
    for tid in (primary, DEFAULT_TENANT):
        if tid and tid not in rooms:
            rooms.append(tid)
    hub = get_alerts_ws_hub()
    for tid in rooms:
        await hub.broadcast_alert(tid, alert)
