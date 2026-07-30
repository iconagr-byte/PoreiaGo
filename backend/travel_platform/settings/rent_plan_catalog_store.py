"""Editable Rent SaaS plan cards (standalone + add-on) — durable JSON store."""

from __future__ import annotations

import json
import os
from copy import deepcopy
from pathlib import Path
from typing import Any

# Prefer persistent volume in production (docker mount /app/data).
_DATA_DIR = Path(
    os.getenv("POREIAGO_DATA_DIR") or Path(__file__).resolve().parents[2] / "data"
)
_SETTINGS_FILE = _DATA_DIR / "rent_plan_catalog.json"
# Legacy path inside the image — used only to migrate once after deploy.
_LEGACY_SETTINGS_FILE = Path(__file__).resolve().parent / "rent_plan_catalog.json"

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
        "Όλα του Rent module πάνω στο υπάρχον πλάνο λεωφορείων",
        "Ξεχωριστό Rent Wallet (/rent/wallet) — πράσινο, όχι το My Wallet λεωφορείων",
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


def _load_raw_file(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, TypeError):
        return None
    return raw if isinstance(raw, dict) else None


def _apply_raw(catalog: dict[str, Any], raw: dict[str, Any]) -> dict[str, Any]:
    if raw.get("sectionTitle") is not None:
        catalog["sectionTitle"] = str(raw["sectionTitle"]).strip() or catalog["sectionTitle"]
    catalog["standalone"] = _merge_card(DEFAULT_STANDALONE, raw.get("standalone"))
    catalog["addon"] = _merge_card(DEFAULT_ADDON, raw.get("addon"))
    return catalog


def read_rent_plan_catalog() -> dict[str, Any]:
    catalog = deepcopy(DEFAULT_CATALOG)
    raw = _load_raw_file(_SETTINGS_FILE)
    if raw is None:
        # Fall back to legacy image path (pre-volume). Next save writes to /app/data.
        raw = _load_raw_file(_LEGACY_SETTINGS_FILE)
    if raw is None:
        return catalog
    return _apply_raw(catalog, raw)


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
    tmp = _SETTINGS_FILE.with_suffix(".json.tmp")
    payload = json.dumps(current, indent=2, ensure_ascii=False)
    tmp.write_text(payload, encoding="utf-8")
    tmp.replace(_SETTINGS_FILE)
    return current
