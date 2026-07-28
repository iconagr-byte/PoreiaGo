"""Editable Rent SaaS plan cards (standalone + add-on) — JSON store."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

_SETTINGS_FILE = Path(__file__).resolve().parent / "rent_plan_catalog.json"

DEFAULT_STANDALONE: dict[str, Any] = {
    "badge": "Αυτόνομο συμβόλαιο",
    "name": "PoreiaGo Rent",
    "tagline": "Μόνο ενοικιάσεις οχημάτων — χωρίς λεωφορεία",
    "monthlyEur": 149,
    "features": [
        "Customer app /rent + Rent Wallet",
        "Στόλος ενοικίασης, κρατήσεις, QR check-in",
        "SOS, οδική 24/7, CDW/SCDW, share trip, checklist",
        "Αρχική σελίδα γραφείου μόνο με Rent (χωρίς λεωφορεία)",
        "Desk Ενοικιάσεις στο Control Panel",
    ],
    "ctaLoggedIn": "Επιλογή Rent συμβολαίου",
    "ctaGuest": "Εγγραφή μόνο για Rent",
    "visible": True,
}

DEFAULT_ADDON: dict[str, Any] = {
    "badge": "Add-on σε λεωφορεία",
    "name": "Add-on Ενοικιάσεις",
    "tagline": "Προσθήκη Rent πάνω στο συμβόλαιο λεωφορείων",
    "monthlyEur": 79,
    "features": [
        "Όλα του Rent module πάνω στο υπάρχον πλάνο",
        "Ίδιο /rent app & wallet για πελάτες",
        "SOS · οδική · ασφάλεια · share · checklist",
        "Χωρίς αλλαγή του core συμβολαίου λεωφορείων",
    ],
    "ctaLoggedIn": "Ενεργοποίηση add-on στο συμβόλαιο",
    "ctaGuest": "Θέλω λεωφορεία + Rent",
    "servicesLinkLabel": "Δες δημόσια σελίδα υπηρεσιών →",
    "visible": True,
}

DEFAULT_CATALOG: dict[str, Any] = {
    "sectionTitle": "Ενοικιάσεις — ξεχωριστά",
    "standalone": deepcopy(DEFAULT_STANDALONE),
    "addon": deepcopy(DEFAULT_ADDON),
}


def _normalize_str_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [line.strip() for line in value.splitlines() if line.strip()]
    return []


def _merge_card(base: dict[str, Any], raw: dict | None) -> dict[str, Any]:
    merged = deepcopy(base)
    if not isinstance(raw, dict):
        return merged
    for key in (
        "badge",
        "name",
        "tagline",
        "ctaLoggedIn",
        "ctaGuest",
        "servicesLinkLabel",
    ):
        if key in raw and raw[key] is not None:
            merged[key] = str(raw[key]).strip()
    if "monthlyEur" in raw and raw["monthlyEur"] is not None:
        try:
            merged["monthlyEur"] = float(raw["monthlyEur"])
        except (TypeError, ValueError):
            pass
    if "features" in raw:
        features = _normalize_str_list(raw.get("features"))
        if features:
            merged["features"] = features
    if "visible" in raw:
        merged["visible"] = bool(raw["visible"])
    return merged


def read_rent_plan_catalog() -> dict[str, Any]:
    catalog = deepcopy(DEFAULT_CATALOG)
    if not _SETTINGS_FILE.exists():
        return catalog
    try:
        raw = json.loads(_SETTINGS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, TypeError):
        return catalog
    if not isinstance(raw, dict):
        return catalog
    if raw.get("sectionTitle") is not None:
        catalog["sectionTitle"] = str(raw["sectionTitle"]).strip() or catalog["sectionTitle"]
    catalog["standalone"] = _merge_card(DEFAULT_STANDALONE, raw.get("standalone"))
    catalog["addon"] = _merge_card(DEFAULT_ADDON, raw.get("addon"))
    return catalog


def write_rent_plan_catalog(data: dict[str, Any]) -> dict[str, Any]:
    current = read_rent_plan_catalog()
    if not isinstance(data, dict):
        return current
    if data.get("sectionTitle") is not None:
        current["sectionTitle"] = str(data["sectionTitle"]).strip() or current["sectionTitle"]
    if isinstance(data.get("standalone"), dict):
        current["standalone"] = _merge_card(current["standalone"], data["standalone"])
    if isinstance(data.get("addon"), dict):
        current["addon"] = _merge_card(current["addon"], data["addon"])
    _SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _SETTINGS_FILE.write_text(
        json.dumps(current, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return current
