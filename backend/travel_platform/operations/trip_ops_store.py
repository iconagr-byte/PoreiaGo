"""Durable trip ops metadata for driver PWA (schedule, destination, stops).

Postgres `trips` stays thin (id/title/seats/price). Rich excursion fields from the
office trip editor are mirrored here under POREIAGO_DATA_DIR so Master QR sessions
can load a real timeline without office localStorage.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_LOCK = threading.Lock()


def _data_dir() -> Path:
    raw = (os.getenv("POREIAGO_DATA_DIR") or "").strip()
    if raw:
        return Path(raw)
    return Path(__file__).resolve().parents[2] / "data"


def _store_path() -> Path:
    return _data_dir() / "trip_ops.json"


def _read_all() -> dict[str, Any]:
    path = _store_path()
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        logger.warning("Failed to read trip ops store: %s", exc)
        return {}


def _write_all(data: dict[str, Any]) -> None:
    path = _store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def get_trip_ops(trip_id: int | str) -> dict[str, Any] | None:
    try:
        key = str(int(trip_id))
    except (TypeError, ValueError):
        return None
    with _LOCK:
        row = _read_all().get(key)
    return dict(row) if isinstance(row, dict) else None


def upsert_trip_ops(trip_id: int | str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        key = str(int(trip_id))
    except (TypeError, ValueError) as exc:
        raise ValueError("Invalid trip_id") from exc

    clean = {
        "id": int(key),
        "title": str(payload.get("title") or "").strip()[:500],
        "destination": str(payload.get("destination") or "").strip()[:500],
        "meeting_point": str(
            payload.get("meeting_point") or payload.get("meetingPoint") or ""
        ).strip()[:500],
        "departure_time": str(
            payload.get("departure_time") or payload.get("departureTime") or ""
        ).strip(),
        "arrival_time": str(
            payload.get("arrival_time") or payload.get("arrivalTime") or ""
        ).strip(),
        "total_seats": int(payload.get("total_seats") or payload.get("totalSeats") or 0) or None,
        "stops": _normalize_stops(payload.get("stops")),
        "segments": _normalize_segments(payload.get("segments")),
    }
    with _LOCK:
        data = _read_all()
        prev = data.get(key) if isinstance(data.get(key), dict) else {}
        merged = {**prev, **{k: v for k, v in clean.items() if v not in (None, "", [])}}
        # Always keep id + allow clearing stops when explicitly provided as empty list.
        merged["id"] = int(key)
        if "stops" in payload:
            merged["stops"] = clean["stops"]
        if "segments" in payload:
            merged["segments"] = clean["segments"]
        data[key] = merged
        _write_all(data)
    return dict(merged)


def _normalize_stops(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or item.get("stop") or item.get("label") or "").strip()
        time_label = str(item.get("time") or item.get("arrival") or "").strip()
        if not name and not time_label:
            continue
        row: dict[str, Any] = {
            "name": name or "Στάση",
            "time": time_label,
        }
        for key in ("lat", "lng", "address", "image"):
            if item.get(key) is not None and item.get(key) != "":
                row[key] = item[key]
        out.append(row)
    return out


def _normalize_segments(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        out.append(
            {
                "sequence": item.get("sequence", 0),
                "segment_type": item.get("segment_type") or item.get("segmentType"),
                "title": item.get("title") or "",
                "starts_at": item.get("starts_at") or item.get("startsAt"),
                "ends_at": item.get("ends_at") or item.get("endsAt"),
                "origin_label": item.get("origin_label") or item.get("originLabel"),
                "destination_label": item.get("destination_label") or item.get("destinationLabel"),
                "metadata": item.get("metadata") if isinstance(item.get("metadata"), dict) else {},
                "flight_id": item.get("flight_id") or item.get("flightId"),
            }
        )
    return out


def build_schedule_from_ops(trip_id: int, ops: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Build driver timeline stops from stored ops / hybrid segments."""
    row = ops if ops is not None else get_trip_ops(trip_id)
    if not row:
        return []

    segments = row.get("segments") or []
    if segments:
        ordered = sorted(segments, key=lambda s: int(s.get("sequence") or 0))
        stops: list[dict[str, Any]] = []
        for i, seg in enumerate(ordered):
            start = seg.get("starts_at") or ""
            time_label = _hhmm(start) or "—"
            meta = seg.get("metadata") or {}
            label = " · ".join(
                p
                for p in (
                    str(seg.get("title") or seg.get("segment_type") or "").strip(),
                    str(meta.get("address") or seg.get("origin_label") or "").strip(),
                )
                if p
            )
            status = "current" if i == 0 else "upcoming"
            stops.append(
                {
                    "time": time_label,
                    "stop": label or "Hybrid stop",
                    "status": status,
                    "trip_id": trip_id,
                    "lat": meta.get("lat"),
                    "lng": meta.get("lng"),
                    "address": meta.get("address"),
                    "bufferNote": seg.get("destination_label") or "",
                    "hybrid": True,
                }
            )
        return stops

    raw_stops = row.get("stops") or []
    if raw_stops:
        out = []
        for i, s in enumerate(raw_stops):
            out.append(
                {
                    "time": str(s.get("time") or "—"),
                    "stop": str(s.get("name") or "Στάση"),
                    "status": "current" if i == 0 else "upcoming",
                    "trip_id": trip_id,
                    "lat": s.get("lat"),
                    "lng": s.get("lng"),
                    "address": s.get("address"),
                }
            )
        return out

    # Minimal 2-point timeline from meeting point → destination.
    meeting = str(row.get("meeting_point") or "").strip()
    destination = str(row.get("destination") or "").strip()
    dep = _hhmm(row.get("departure_time")) or "—"
    arr = _hhmm(row.get("arrival_time")) or "—"
    if meeting or destination:
        stops = []
        if meeting:
            stops.append(
                {
                    "time": dep,
                    "stop": meeting,
                    "status": "current",
                    "trip_id": trip_id,
                }
            )
        if destination:
            stops.append(
                {
                    "time": arr if arr != "—" else dep,
                    "stop": destination,
                    "status": "upcoming" if meeting else "current",
                    "trip_id": trip_id,
                }
            )
        return stops
    return []


def _hhmm(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    # Already HH:MM
    if len(raw) >= 5 and raw[2] == ":" and raw[:2].isdigit():
        return raw[:5]
    try:
        from datetime import datetime

        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt.strftime("%H:%M")
    except Exception:
        return raw[:5] if len(raw) >= 5 else raw
