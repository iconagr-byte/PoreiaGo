"""Teltonika Codec 8 / 8E AVL parser (FTC961 and similar)."""

from __future__ import annotations

import struct
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


def crc16_ibm(data: bytes) -> int:
    """CRC-16/IBM (ARC) used by Teltonika AVL packets."""
    crc = 0
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 1:
                crc = (crc >> 1) ^ 0xA001
            else:
                crc >>= 1
            crc &= 0xFFFF
    return crc


@dataclass
class GpsFix:
    latitude: float
    longitude: float
    altitude_m: int
    angle_deg: int
    satellites: int
    speed_kmh: float
    recorded_at: datetime
    priority: int = 0
    event_io_id: int | None = None
    io: dict[int, int] = field(default_factory=dict)

    def engine_status(self) -> str:
        # Common ignition IOs across Teltonika firmwares.
        for io_id in (239, 1, 21):
            if io_id in self.io:
                return "on" if self.io[io_id] else "off"
        if self.speed_kmh >= 3:
            return "on"
        return "off"

    def tracker_event_id(self) -> int | None:
        """Map Green Driving type (IO 253) → PoreiaGo tracker_event_id."""
        gd = self.io.get(253)
        if gd == 1:
            return 102  # harsh acceleration
        if gd == 2:
            return 101  # harsh braking
        if gd == 3:
            return 103  # harsh cornering
        # Speeding (IO 255 on some firmwares) or explicit event id
        if self.event_io_id in (101, 102, 103, 105):
            return int(self.event_io_id)
        if self.io.get(255):
            return 105
        return None


def parse_imei_login(data: bytes) -> tuple[str | None, int]:
    """Return (imei, bytes_consumed). Incomplete → (None, 0)."""
    if len(data) < 2:
        return None, 0
    length = struct.unpack(">H", data[:2])[0]
    if length < 10 or length > 20:
        return None, -1  # malformed
    if len(data) < 2 + length:
        return None, 0
    imei = data[2 : 2 + length].decode("ascii", errors="ignore").strip()
    if not imei.isdigit():
        return None, -1
    return imei, 2 + length


def _read_io_map(buf: bytes, offset: int, *, id_width: int) -> tuple[dict[int, int], int, int]:
    """Parse IO section. Returns (io_map, event_io_id, new_offset)."""
    if id_width == 1:
        event_io_id = buf[offset]
        offset += 1
        total_n = buf[offset]
        offset += 1
    else:
        event_io_id = struct.unpack(">H", buf[offset : offset + 2])[0]
        offset += 2
        total_n = buf[offset]
        offset += 1

    io: dict[int, int] = {}
    for size, fmt in ((1, ">B"), (2, ">H"), (4, ">I"), (8, ">Q")):
        count = buf[offset]
        offset += 1
        for _ in range(count):
            if id_width == 1:
                io_id = buf[offset]
                offset += 1
            else:
                io_id = struct.unpack(">H", buf[offset : offset + 2])[0]
                offset += 2
            value = struct.unpack(fmt, buf[offset : offset + size])[0]
            offset += size
            io[io_id] = int(value)
    # total_n is informational; some firmwares leave it inconsistent — ignore mismatch
    _ = total_n
    return io, event_io_id, offset


def _parse_avl_record(buf: bytes, offset: int, *, codec_id: int) -> tuple[GpsFix, int]:
    ts_ms = struct.unpack(">Q", buf[offset : offset + 8])[0]
    offset += 8
    priority = buf[offset]
    offset += 1
    lon_raw = struct.unpack(">i", buf[offset : offset + 4])[0]
    offset += 4
    lat_raw = struct.unpack(">i", buf[offset : offset + 4])[0]
    offset += 4
    altitude = struct.unpack(">h", buf[offset : offset + 2])[0]
    offset += 2
    angle = struct.unpack(">H", buf[offset : offset + 2])[0]
    offset += 2
    satellites = buf[offset]
    offset += 1
    speed = struct.unpack(">H", buf[offset : offset + 2])[0]
    offset += 2

    id_width = 2 if codec_id == 0x8E else 1
    io, event_io_id, offset = _read_io_map(buf, offset, id_width=id_width)

    recorded = datetime.fromtimestamp(ts_ms / 1000.0, tz=timezone.utc)
    fix = GpsFix(
        latitude=lat_raw / 10_000_000.0,
        longitude=lon_raw / 10_000_000.0,
        altitude_m=int(altitude),
        angle_deg=int(angle),
        satellites=int(satellites),
        speed_kmh=float(speed),
        recorded_at=recorded,
        priority=int(priority),
        event_io_id=int(event_io_id),
        io=io,
    )
    return fix, offset


def parse_avl_packet(data: bytes) -> tuple[list[GpsFix] | None, int, bytes | None]:
    """
    Parse one Teltonika AVL data packet.

    Returns (records|None if incomplete, bytes_consumed, ack_payload|None).
    ack_payload is 4-byte BE count of accepted records when complete.
    Malformed → (None, -1, None).
    """
    if len(data) < 8:
        return None, 0, None
    preamble = data[0:4]
    if preamble != b"\x00\x00\x00\x00":
        # Some devices skip preamble when framing is already TCP — still require zeros
        # for standard Codec 8.
        return None, -1, None
    data_len = struct.unpack(">I", data[4:8])[0]
    # data_len covers codec..N2; total packet = 8 + data_len + 4 (CRC)
    total = 8 + data_len + 4
    if data_len < 1 or data_len > 512_000:
        return None, -1, None
    if len(data) < total:
        return None, 0, None

    codec_data = data[8 : 8 + data_len]
    crc_recv = struct.unpack(">I", data[8 + data_len : total])[0] & 0xFFFF
    crc_calc = crc16_ibm(codec_data)
    if crc_recv != crc_calc:
        return None, -1, None

    codec_id = codec_data[0]
    if codec_id not in (0x08, 0x8E):
        return None, -1, None
    n1 = codec_data[1]
    offset = 2
    records: list[GpsFix] = []
    try:
        for _ in range(n1):
            fix, offset = _parse_avl_record(codec_data, offset, codec_id=codec_id)
            # Skip invalid GPS (0,0) or no satellites — still count for ACK
            if abs(fix.latitude) > 0.0001 or abs(fix.longitude) > 0.0001:
                if -90 <= fix.latitude <= 90 and -180 <= fix.longitude <= 180:
                    records.append(fix)
        n2 = codec_data[offset]
        if n2 != n1:
            # Soft-accept; still ACK n1
            pass
    except (IndexError, struct.error):
        return None, -1, None

    ack = struct.pack(">I", n1)
    return records, total, ack


def build_minimal_codec8_packet(
    *,
    latitude: float,
    longitude: float,
    speed_kmh: int = 0,
    ts: datetime | None = None,
    ignition: int = 1,
    io_extra: dict[int, int] | None = None,
) -> bytes:
    """Test helper — build a 1-record Codec 8 AVL packet."""
    when = ts or datetime.now(timezone.utc)
    ts_ms = int(when.timestamp() * 1000)
    lat_i = int(round(latitude * 10_000_000))
    lon_i = int(round(longitude * 10_000_000))
    body = bytearray()
    body.append(0x08)  # codec
    body.append(0x01)  # N1
    body += struct.pack(">Q", ts_ms)
    body.append(0)  # priority
    body += struct.pack(">i", lon_i)
    body += struct.pack(">i", lat_i)
    body += struct.pack(">h", 10)  # altitude
    body += struct.pack(">H", 90)  # angle
    body.append(8)  # satellites
    body += struct.pack(">H", int(speed_kmh))
    body.append(0)  # event io id
    body.append(1)  # total io count (approx)
    # N1 one-byte IOs
    ones: list[tuple[int, int]] = [(239, ignition)]
    if io_extra:
        for k, v in io_extra.items():
            if 0 <= int(v) <= 255:
                ones.append((int(k), int(v)))
    body.append(len(ones))
    for io_id, val in ones:
        body.append(io_id)
        body.append(val)
    body.append(0)  # N2
    body.append(0)  # N4
    body.append(0)  # N8
    body.append(0x01)  # N2 trailing count
    crc = crc16_ibm(bytes(body))
    packet = b"\x00\x00\x00\x00" + struct.pack(">I", len(body)) + bytes(body) + struct.pack(">I", crc)
    return packet


def fix_to_telemetry_fields(fix: GpsFix) -> dict[str, Any]:
    return {
        "latitude": fix.latitude,
        "longitude": fix.longitude,
        "speed_kmh": fix.speed_kmh,
        "heading_deg": float(fix.angle_deg),
        "engine_status": fix.engine_status(),
        "recorded_at": fix.recorded_at.isoformat(),
        "tracker_event_id": fix.tracker_event_id(),
    }
