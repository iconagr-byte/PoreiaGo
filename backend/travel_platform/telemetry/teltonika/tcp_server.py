"""Asyncio TCP server for Teltonika Codec 8 devices (e.g. FTC961)."""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any
from uuid import UUID

from travel_platform.telemetry.ingestion import TelemetryIngestionService
from travel_platform.telemetry.teltonika.codec8 import (
    fix_to_telemetry_fields,
    parse_avl_packet,
    parse_imei_login,
)
from travel_platform.telemetry.teltonika.device_store import get_device_by_imei, touch_device

logger = logging.getLogger("poreiago.teltonika")

_server: asyncio.AbstractServer | None = None
_status: dict[str, Any] = {
    "enabled": False,
    "listening": False,
    "host": "0.0.0.0",
    "port": 5027,
    "active_connections": 0,
    "accepted_imeis": 0,
    "rejected_imeis": 0,
    "packets_ok": 0,
    "packets_bad": 0,
    "last_error": None,
}


def teltonika_enabled() -> bool:
    raw = (os.getenv("TELTONIKA_TCP_ENABLED") or "1").strip().lower()
    return raw not in {"0", "false", "no", "off"}


def teltonika_bind() -> tuple[str, int]:
    host = (os.getenv("TELTONIKA_TCP_HOST") or "0.0.0.0").strip() or "0.0.0.0"
    try:
        port = int((os.getenv("TELTONIKA_TCP_PORT") or "5027").strip() or "5027")
    except ValueError:
        port = 5027
    return host, port


def get_teltonika_status() -> dict[str, Any]:
    public_ip = (os.getenv("PLATFORM_INGRESS_IP") or os.getenv("TELTONIKA_PUBLIC_HOST") or "").strip()
    host, port = teltonika_bind()
    out = {**_status, "host": host, "port": port, "enabled": teltonika_enabled()}
    if public_ip:
        out["public_endpoint"] = f"{public_ip}:{port}"
    else:
        out["public_endpoint"] = f"<VPS_IP>:{port}"
    return out


async def _handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    peer = writer.get_extra_info("peername")
    _status["active_connections"] = int(_status.get("active_connections") or 0) + 1
    imei: str | None = None
    buf = bytearray()
    ingest = TelemetryIngestionService()
    try:
        # Phase 1: IMEI login
        while imei is None:
            chunk = await asyncio.wait_for(reader.read(256), timeout=30)
            if not chunk:
                return
            buf.extend(chunk)
            parsed, consumed = parse_imei_login(bytes(buf))
            if consumed < 0:
                writer.write(b"\x00")
                await writer.drain()
                _status["rejected_imeis"] = int(_status.get("rejected_imeis") or 0) + 1
                return
            if consumed == 0:
                continue
            imei = parsed
            del buf[:consumed]
            device = get_device_by_imei(imei)
            if not device or not device.get("enabled"):
                writer.write(b"\x00")
                await writer.drain()
                _status["rejected_imeis"] = int(_status.get("rejected_imeis") or 0) + 1
                logger.info("Teltonika reject IMEI=%s peer=%s (unbound/disabled)", imei, peer)
                return
            writer.write(b"\x01")
            await writer.drain()
            _status["accepted_imeis"] = int(_status.get("accepted_imeis") or 0) + 1
            logger.info(
                "Teltonika accept IMEI=%s vehicle=%s tenant=%s peer=%s",
                imei,
                device.get("vehicle_code"),
                device.get("tenant_id"),
                peer,
            )

        device = get_device_by_imei(imei) or {}
        # Phase 2: AVL packets
        while True:
            chunk = await asyncio.wait_for(reader.read(4096), timeout=300)
            if not chunk:
                break
            buf.extend(chunk)
            while True:
                records, consumed, ack = parse_avl_packet(bytes(buf))
                if consumed == 0:
                    break
                if consumed < 0:
                    _status["packets_bad"] = int(_status.get("packets_bad") or 0) + 1
                    # Drop one byte and resync
                    del buf[0:1]
                    continue
                del buf[:consumed]
                if not ack:
                    continue
                writer.write(ack)
                await writer.drain()
                _status["packets_ok"] = int(_status.get("packets_ok") or 0) + 1
                if not records:
                    continue
                # Re-read device in case binding changed
                device = get_device_by_imei(imei) or device
                if not device.get("enabled"):
                    continue
                try:
                    tenant_id = UUID(str(device["tenant_id"]))
                except Exception:
                    continue
                vehicle_code = str(device.get("vehicle_code") or imei)
                driver_raw = device.get("driver_id")
                driver_id = None
                if driver_raw:
                    try:
                        driver_id = UUID(str(driver_raw))
                    except Exception:
                        driver_id = None
                last = records[-1]
                accepted = 0
                for fix in records:
                    fields = fix_to_telemetry_fields(fix)
                    try:
                        await ingest.accept_update(
                            tenant_id=tenant_id,
                            vehicle_code=vehicle_code,
                            latitude=fields["latitude"],
                            longitude=fields["longitude"],
                            speed_kmh=fields["speed_kmh"],
                            engine_status=fields["engine_status"],
                            recorded_at=fields["recorded_at"],
                            heading_deg=fields["heading_deg"],
                            driver_id=driver_id,
                            tracker_event_id=fields.get("tracker_event_id"),
                        )
                        accepted += 1
                    except Exception as exc:
                        logger.warning("Teltonika enqueue failed IMEI=%s: %s", imei, exc)
                touch_device(
                    imei,
                    lat=last.latitude,
                    lng=last.longitude,
                    speed_kmh=last.speed_kmh,
                    points=accepted,
                )
    except asyncio.TimeoutError:
        logger.debug("Teltonika timeout peer=%s imei=%s", peer, imei)
    except Exception as exc:
        _status["last_error"] = str(exc)[:240]
        logger.exception("Teltonika client error peer=%s imei=%s", peer, imei)
    finally:
        _status["active_connections"] = max(0, int(_status.get("active_connections") or 1) - 1)
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass


async def start_teltonika_tcp_server() -> None:
    global _server
    if not teltonika_enabled():
        _status["enabled"] = False
        _status["listening"] = False
        logger.info("Teltonika TCP server disabled (TELTONIKA_TCP_ENABLED=0)")
        return
    if _server is not None:
        return
    host, port = teltonika_bind()
    try:
        _server = await asyncio.start_server(_handle_client, host=host, port=port)
        _status.update({"enabled": True, "listening": True, "host": host, "port": port, "last_error": None})
        logger.info("Teltonika Codec 8 TCP listening on %s:%s", host, port)
    except Exception as exc:
        _status.update(
            {
                "enabled": True,
                "listening": False,
                "last_error": str(exc)[:240],
            }
        )
        logger.exception("Teltonika TCP failed to bind %s:%s", host, port)


async def stop_teltonika_tcp_server() -> None:
    global _server
    if _server is None:
        return
    _server.close()
    await _server.wait_closed()
    _server = None
    _status["listening"] = False
