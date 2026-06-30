"""Seat pricing & amenities per bus layout — JSON store."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

_SETTINGS_FILE = Path(__file__).resolve().parent / "seat_pricing.json"

DEFAULT_LAYOUT_PRICING: dict[str, Any] = {
    "show_popup": True,
    "standard_mode": "trip_price",
    "standard_price_eur": None,
    "vip_mode": "markup",
    "vip_price_eur": None,
    "vip_markup_pct": 25,
    "standard_amenities": ["Κλιματισμός", "USB θύρες", "Αποσκευές κάτω από θέση"],
    "vip_amenities": [
        "Extra legroom",
        "USB & 220V",
        "Ανακλινόμενα leather seats",
        "Προτεραιότητα επιβίβασης",
    ],
    "seat_overrides": {},
}

DEFAULT_ASIDE_PANEL: dict[str, Any] = {
    "show_trip_card": True,
    "show_legend": True,
    "show_pricing": True,
    "show_amenities": True,
    "show_availability": True,
    "show_vehicle_photo": False,
    "show_route_stops": False,
    "show_tips": True,
    "show_deposit_note": True,
    "show_selected_seats": True,
    "trip_card_title": "Η εκδρομή σας",
    "amenities_title": "Παροχές onboard",
    "standard_amenities_label": "Standard",
    "vip_amenities_label": "",
    "vehicle_image_url": "",
    "route_stops": [],
    "tips": [],
    "legend_hint": "",
    "deposit_note": "",
    "availability_label": "",
}

DEFAULT_LAYOUT_PRICING["aside_panel"] = deepcopy(DEFAULT_ASIDE_PANEL)

DEFAULT_SEAT_PRICING: dict[str, Any] = {
    "layouts": {
        "luxury-coach": deepcopy(DEFAULT_LAYOUT_PRICING),
        "premium-express": {
            **deepcopy(DEFAULT_LAYOUT_PRICING),
            "vip_markup_pct": 15,
            "vip_amenities": ["Extra legroom", "USB θύρες", "Ψυγείο nearby"],
        },
        "vip-minibus": {
            **deepcopy(DEFAULT_LAYOUT_PRICING),
            "vip_markup_pct": 20,
            "standard_amenities": ["Κλιματισμός", "Premium audio"],
            "vip_amenities": ["Front row panorama", "USB & 220V", "Welcome drink"],
            "aside_panel": {
                **deepcopy(DEFAULT_ASIDE_PANEL),
                "show_vehicle_photo": True,
                "tips": [
                    "Ιδανικό για μικρές ομάδες",
                    "Οι μπροστινές θέσεις έχουν πανοραμική θέα",
                ],
                "deposit_note": "Προκαταβολή {percent}% online · υπόλοιπο κατά την επιβίβαση.",
            },
        },
    }
}

LAYOUT_IDS = ("luxury-coach", "premium-express", "vip-minibus")


def _normalize_seat_override(value: Any) -> dict[str, Any]:
    """Normalize seat override to { price_eur?, amenities? }."""
    if isinstance(value, (int, float)):
        return {"price_eur": float(value)}
    if isinstance(value, str):
        try:
            return {"price_eur": float(value)}
        except ValueError:
            return {}
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        if value.get("price_eur") is not None:
            try:
                out["price_eur"] = float(value["price_eur"])
            except (TypeError, ValueError):
                pass
        if isinstance(value.get("amenities"), list):
            amenities = [str(a).strip() for a in value["amenities"] if str(a).strip()]
            if amenities:
                out["amenities"] = amenities
        return out
    return {}


def _normalize_str_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [line.strip() for line in value.splitlines() if line.strip()]
    return []


def _merge_aside_panel(raw: dict | None) -> dict[str, Any]:
    base = deepcopy(DEFAULT_ASIDE_PANEL)
    if not raw:
        return base
    merged = {**base, **raw}
    for key in (
        "show_trip_card",
        "show_legend",
        "show_pricing",
        "show_amenities",
        "show_availability",
        "show_vehicle_photo",
        "show_route_stops",
        "show_tips",
        "show_deposit_note",
        "show_selected_seats",
    ):
        if key.startswith("show_"):
            merged[key] = bool(merged.get(key))
    for key in (
        "trip_card_title",
        "amenities_title",
        "standard_amenities_label",
        "vip_amenities_label",
        "vehicle_image_url",
        "legend_hint",
        "deposit_note",
        "availability_label",
    ):
        merged[key] = str(merged.get(key) or "").strip()
    merged["route_stops"] = _normalize_str_list(merged.get("route_stops"))
    merged["tips"] = _normalize_str_list(merged.get("tips"))
    return merged


def _merge_layout(raw: dict | None) -> dict[str, Any]:
    base = deepcopy(DEFAULT_LAYOUT_PRICING)
    if not raw:
        return base
    merged = {**base, **raw}
    if isinstance(raw.get("seat_overrides"), dict):
        merged["seat_overrides"] = {
            str(k).upper(): _normalize_seat_override(v)
            for k, v in raw["seat_overrides"].items()
            if _normalize_seat_override(v)
        }
    for key in ("standard_amenities", "vip_amenities"):
        if isinstance(merged.get(key), list):
            merged[key] = [str(a).strip() for a in merged[key] if str(a).strip()]
    if isinstance(raw.get("aside_panel"), dict) or "aside_panel" in merged:
        merged["aside_panel"] = _merge_aside_panel(raw.get("aside_panel") or merged.get("aside_panel"))
    else:
        merged["aside_panel"] = deepcopy(DEFAULT_ASIDE_PANEL)
    return merged


def read_seat_pricing() -> dict[str, Any]:
    layouts = deepcopy(DEFAULT_SEAT_PRICING["layouts"])
    if not _SETTINGS_FILE.exists():
        return {"layouts": layouts}
    try:
        raw = json.loads(_SETTINGS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, TypeError):
        return {"layouts": layouts}
    stored = raw.get("layouts") or {}
    for layout_id in LAYOUT_IDS:
        if layout_id in stored:
            layouts[layout_id] = _merge_layout(stored[layout_id])
    return {"layouts": layouts}


def write_seat_pricing(data: dict[str, Any]) -> dict[str, Any]:
    current = read_seat_pricing()
    patch_layouts = data.get("layouts") or {}
    for layout_id, patch in patch_layouts.items():
        if layout_id not in LAYOUT_IDS:
            continue
        current["layouts"][layout_id] = _merge_layout({**current["layouts"][layout_id], **patch})
    _SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _SETTINGS_FILE.write_text(
        json.dumps(current, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return current


def get_layout_pricing(layout_id: str) -> dict[str, Any]:
    all_data = read_seat_pricing()
    return all_data["layouts"].get(layout_id, deepcopy(DEFAULT_LAYOUT_PRICING))
