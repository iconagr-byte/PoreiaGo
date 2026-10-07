"""Asyncio TCP server for Teltonika Codec 8 devices (e.g. FTC961)."""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from travel_platform.telemetry.processor import process_telemetry_payload
from travel_platform.telemetry.teltonika.codec8 import (
    fix_to_telemetry_fields,
    parse_avl_packet,
    parse_imei_login,
)
from travel_platform.telemetry.teltonika.device_store import (
    get_device_by_imei,
    normalize_imei,
    touch_device,
)

logger = logging.getLogger("poreiago.teltonika")

_server: asyncio.AbstractServer | None = None
# IMEIs with an open Codec TCP session on this worker (sparse AVL when parked).
_open_imeis: set[str] = set()
# Refresh map pin while TCP is up — do NOT bump last_seen (that faked online after unplug).
_TCP_KEEPALIVE_SEC = 30
# Half-open sockets after power cut — fail faster than the old 300s idle.
_TCP_AVL_READ_TIMEOUT_SEC = 90
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


def is_imei_tcp_connected(imei: str | None) -> bool:
    """True when this worker holds an open Codec session for the IMEI."""
    key = normalize_imei(imei or "")
    return bool(key) and key in _open_imeis


async def _tcp_session_keepalive(imei: str) -> None:
    """Refresh last-known pin while TCP stays up — without faking a live signal."""
    key = normalize_imei(imei)
    try:
        while key in _open_imeis:
            await asyncio.sleep(_TCP_KEEPALIVE_SEC)
            if key not in _open_imeis:
                break
            # Do not touch_device() here — keepalive must not refresh last_seen_at
            # or tracker_signal_at after GPS power cut (half-open TCP).
            try:
                from travel_platform.telemetry.teltonika.paint_live import (
                    paint_live_pin_from_device,
                )

                device = get_device_by_imei(imei)
                if device:
                    await paint_live_pin_from_device(
                        device,
                        open_channel=False,
                        reason="tcp_keepalive",
                    )
            except Exception:
                logger.debug("Teltonika TCP keepalive paint skipped IMEI=%s", imei, exc_info=True)
    except asyncio.CancelledError:
        raise


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


def _port_is_bound(port: int) -> bool:
    """True when *some* process (often another Gunicorn worker) holds the TCP port.

    Probe via bind — never connect (Codec 8 would treat us as a device login).
    """
    import socket

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 0)
        sock.bind(("127.0.0.1", int(port)))
        return False
    except OSError:
        return True
    finally:
        try:
            sock.close()
        except Exception:
            pass


def get_teltonika_status() -> dict[str, Any]:
    public_ip = (os.getenv("PLATFORM_INGRESS_IP") or os.getenv("TELTONIKA_PUBLIC_HOST") or "").strip()
    host, port = teltonika_bind()
    out = {
        **_status,
        "host": host,
        "port": port,
        "enabled": teltonika_enabled(),
        "open_imeis": len(_open_imeis),
    }
    # Multi-worker: only the binder sets listening=True in-process. Detect the
    # shared TCP port so admin UI does not show a false "TCP offline".
    if teltonika_enabled() and not out.get("listening") and _port_is_bound(port):
        out["listening"] = True
        out["last_error"] = None
    if public_ip:
        out["public_endpoint"] = f"{public_ip}:{port}"
    else:
        out["public_endpoint"] = f"<VPS_IP>:{port}"
    return out


async def _handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    peer = writer.get_extra_info("peername")
    _status["active_connections"] = int(_status.get("active_connections") or 0) + 1
    imei: str | None = None
    keepalive_task: asyncio.Task | None = None
    buf = bytearray()
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
            # Real device Codec login (not a bogus health probe) — mark online and
            # paint immediately so reconnect shows on the map before the next AVL.
            # Keepalive must NOT touch_device (half-open after power cut).
            touch_device(imei)
            _open_imeis.add(normalize_imei(imei))
            keepalive_task = asyncio.create_task(
                _tcp_session_keepalive(imei),
                name=f"teltonika-keepalive-{normalize_imei(imei)[-6:]}",
            )
            logger.info(
                "Teltonika accept IMEI=%s vehicle=%s tenant=%s peer=%s",
                imei,
                device.get("vehicle_code"),
                device.get("tenant_id"),
                peer,
            )
            try:
                from travel_platform.telemetry.teltonika.paint_live import (
                    paint_live_pin_from_device,
                )

                fresh = get_device_by_imei(imei) or device
                await paint_live_pin_from_device(
                    fresh,
                    open_channel=True,
                    reason="imei_accept",
                )
            except Exception:
                logger.debug(
                    "Teltonika IMEI pin paint skipped IMEI=%s",
                    imei,
                    exc_info=True,
                )

        device = get_device_by_imei(imei) or {}
        # Phase 2: AVL packets
        while True:
            chunk = await asyncio.wait_for(
                reader.read(4096), timeout=_TCP_AVL_READ_TIMEOUT_SEC
            )
            if not chunk:
                break
            buf.extend(chunk)
            while True:
                records, consumed, ack = parse_avl_packet(bytes(buf))
                if consumed == 0:
                    break
                if consumed < 0:
                    _status["packets_bad"] = int(_status.get("packets_bad") or 0) + 1
                    preview = bytes(buf[:64]).hex()
                    logger.warning(
                        "Teltonika AVL parse fail IMEI=%s peer=%s buf_len=%s hex64=%s",
                        imei,
                        peer,
                        len(buf),
                        preview,
                    )
                    # Drop one byte and resync
                    del buf[0:1]
                    continue
                del buf[:consumed]
                if not ack:
                    continue
                writer.write(ack)
                await writer.drain()
                _status["packets_ok"] = int(_status.get("packets_ok") or 0) + 1
                # Re-read device in case binding changed
                device = get_device_by_imei(imei) or device
                if not device.get("enabled"):
                    touch_device(imei)
                    continue
                if not records:
                    # Valid AVL (e.g. no GPS yet) — still mark seen. If we already
                    # have a last fix, keep the live pin alive at that position.
                    touch_device(imei)
                    try:
                        from travel_platform.telemetry.teltonika.paint_live import (
                            paint_live_pin_from_device,
                        )

                        fresh = get_device_by_imei(imei) or device
                        await paint_live_pin_from_device(
                            fresh,
                            open_channel=True,
                            reason="avl_keepalive",
                        )
                    except Exception:
                        logger.debug(
                            "Teltonika keepalive pin failed IMEI=%s",
                            imei,
                            exc_info=True,
                        )
                    continue
                try:
                    tenant_id = UUID(str(device["tenant_id"]))
                except Exception:
                    touch_device(imei)
                    continue
                vehicle_code = str(device.get("vehicle_code") or imei)
                driver_raw = device.get("driver_id")
                driver_id = None
                if driver_raw:
                    try:
                        driver_id = UUID(str(driver_raw))
                    except Exception:
                        driver_id = None
                driver_name = str(device.get("label") or vehicle_code)
                last = records[-1]
                accepted = 0
                # Live-map freshness must use server receive time — device GPS
                # clocks are often skewed and would drop the pin as "stale".
                received_at = datetime.now(timezone.utc).isoformat()
                for fix in records:
                    fields = fix_to_telemetry_fields(fix)
                    # Process inline (not only Redis stream) so the live map pin
                    # updates even when the stream consumer lags across workers.
                    payload = {
                        "tenant_id": str(tenant_id),
                        "vehicle_code": vehicle_code,
                        "latitude": fields["latitude"],
                        "longitude": fields["longitude"],
                        "speed_kmh": fields["speed_kmh"],
                        "engine_status": fields["engine_status"],
                        "recorded_at": received_at,
                        "gps_recorded_at": fields["recorded_at"],
                        "tracker_signal_at": received_at,
                        "heading_deg": fields["heading_deg"],
                        "driver_id": str(driver_id) if driver_id else None,
                        "tracker_event_id": fields.get("tracker_event_id"),
                        "source": "teltonika",
                        "imei": imei,
                        "bus_plate": vehicle_code,
                        "driver_name": driver_name,
                        "altitude_m": fields.get("altitude_m"),
                        "satellites": fields.get("satellites"),
                        "priority": fields.get("priority"),
                        "event_io_id": fields.get("event_io_id"),
                        "io": fields.get("io") or {},
                    }
                    try:
                        await process_telemetry_payload(payload)
                        accepted += 1
                    except Exception as exc:
                        logger.warning("Teltonika live ingest failed IMEI=%s: %s", imei, exc)
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
        if imei:
            _open_imeis.discard(normalize_imei(imei))
        if keepalive_task is not None:
            keepalive_task.cancel()
            try:
                await keepalive_task
            except (asyncio.CancelledError, Exception):
                pass
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
