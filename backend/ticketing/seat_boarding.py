"""Seat helpers for multi-passenger boarding (one QR per seat)."""

from __future__ import annotations

import json
import re
from typing import Any

_SEAT_SPLIT = re.compile(r"[,;/|]+")


def parse_seat_list(raw: Any) -> list[str]:
    if isinstance(raw, (list, tuple)):
        return [str(s).strip() for s in raw if str(s).strip()]
    text = str(raw or "").strip()
    if not text:
        return []
    return [p.strip() for p in _SEAT_SPLIT.split(text) if p.strip()]


def normalize_seat(seat: str | None) -> str:
    return str(seat or "").strip().upper().replace(" ", "")


def booking_seat_codes(booking: dict) -> list[str]:
    spec = booking.get("special_requirements") or {}
    if not isinstance(spec, dict):
        spec = {}
    passengers = spec.get("passengers") or []
    from_party = [
        normalize_seat(p.get("seat"))
        for p in passengers
        if isinstance(p, dict) and normalize_seat(p.get("seat"))
    ]
    if from_party:
        return from_party
    return [normalize_seat(s) for s in parse_seat_list(booking.get("seat_number"))]


def boarded_seats_from_spec(spec: dict | None) -> list[str]:
    if not isinstance(spec, dict):
        return []
    raw = spec.get("boarded_seats") or []
    if not isinstance(raw, list):
        return []
    return [normalize_seat(s) for s in raw if normalize_seat(s)]


def passenger_name_for_seat(booking: dict, seat: str | None) -> str:
    code = normalize_seat(seat)
    spec = booking.get("special_requirements") or {}
    if isinstance(spec, dict):
        for p in spec.get("passengers") or []:
            if isinstance(p, dict) and normalize_seat(p.get("seat")) == code and p.get("name"):
                return str(p["name"]).strip()
    return str(booking.get("customer_name") or "").strip()


def dump_special_requirements(spec: dict) -> str:
    return json.dumps(spec, ensure_ascii=False)
