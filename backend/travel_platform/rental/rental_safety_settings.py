"""Rental trip safety contacts & insurance franchises — JSON store."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

_SETTINGS_FILE = Path(__file__).resolve().parent / "rental_safety_settings.json"

DEFAULT_SAFETY_SETTINGS: dict[str, Any] = {
    "office_phone": "",
    "roadside_phone_24_7": "+302111900000",
    "roadside_label": "Οδική βοήθεια 24/7",
    "emergency_sms": "",
    "cdw_franchise_eur": 600.0,
    "scdw_franchise_eur": 0.0,
    "scdw_daily_eur": 8.0,
}


def _ensure_file() -> None:
    if not _SETTINGS_FILE.exists():
        _SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        _SETTINGS_FILE.write_text(
            json.dumps(DEFAULT_SAFETY_SETTINGS, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


def read_safety_settings() -> dict[str, Any]:
    _ensure_file()
    try:
        raw = json.loads(_SETTINGS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    out = deepcopy(DEFAULT_SAFETY_SETTINGS)
    for key in DEFAULT_SAFETY_SETTINGS:
        if key in raw and raw[key] is not None:
            out[key] = raw[key]
    return out


def update_safety_settings(patch: dict[str, Any] | None) -> dict[str, Any]:
    current = read_safety_settings()
    if not isinstance(patch, dict):
        return current
    for key in DEFAULT_SAFETY_SETTINGS:
        if key not in patch:
            continue
        value = patch[key]
        if key in ("cdw_franchise_eur", "scdw_franchise_eur", "scdw_daily_eur"):
            try:
                current[key] = round(float(value), 2)
            except (TypeError, ValueError):
                continue
        elif key in ("office_phone", "roadside_phone_24_7", "roadside_label", "emergency_sms"):
            current[key] = str(value or "").strip()
    _SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _SETTINGS_FILE.write_text(
        json.dumps(current, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return deepcopy(current)


def footer_phone_fallback() -> str:
    """Site appearance footer phone as office fallback."""
    try:
        from api.site_appearance_router import _read_appearance

        appearance = _read_appearance()
        phone = str(appearance.get("footer_contact_phone") or "").strip()
        if phone:
            return phone
    except Exception:
        pass
    return ""


def resolve_safety_contacts() -> dict[str, Any]:
    settings = read_safety_settings()
    office = str(settings.get("office_phone") or "").strip() or footer_phone_fallback()
    roadside = str(settings.get("roadside_phone_24_7") or "").strip()
    return {
        "office_phone": office,
        "roadside_phone_24_7": roadside,
        "roadside_label": str(settings.get("roadside_label") or DEFAULT_SAFETY_SETTINGS["roadside_label"]),
        "emergency_sms": str(settings.get("emergency_sms") or "").strip() or None,
        "cdw_franchise_eur": float(settings.get("cdw_franchise_eur") or 0),
        "scdw_franchise_eur": float(settings.get("scdw_franchise_eur") or 0),
        "scdw_daily_eur": float(settings.get("scdw_daily_eur") or 0),
    }


def insurance_cover_payload() -> dict[str, Any]:
    contacts = resolve_safety_contacts()
    cdw = contacts["cdw_franchise_eur"]
    scdw = contacts["scdw_franchise_eur"]
    return {
        "title": "Ασφαλιστική κάλυψη CDW / SCDW",
        "cdw_franchise_eur": cdw,
        "scdw_franchise_eur": scdw,
        "scdw_daily_eur": contacts["scdw_daily_eur"],
        "cdw": {
            "label": "CDW (Collision Damage Waiver)",
            "covers": [
                "Καλύπτει ζημιές στο αμάξωμα από σύγκρουση ή ανατροπή, μείον την απαλλαγή (franchise).",
                "Ισχύει όταν τηρούνται οι όροι μίσθωσης και οι κανόνες οδήγησης.",
            ],
            "excludes": [
                "Ελαστικά, ζάντες και κάτω μέρος οχήματος (υπόστρωμα / undercarriage).",
                "Ζημιές από αμέλεια, οδήγηση υπό επήρεια ή εκτός επιτρεπόμενων οδών.",
                "Χαμένα κλειδιά, εσωτερικό, παρμπρίζ και γυαλιά (εκτός αν καλύπτονται ξεχωριστά).",
                "Πρόστιμα ΚΟΚ και ζημιές τρίτων πέραν της βασικής αστικής ευθύνης.",
            ],
            "franchise_note": f"Απαλλαγή (franchise) CDW: €{cdw:.0f} ανά συμβάν.",
        },
        "scdw": {
            "label": "SCDW (Super CDW)",
            "covers": [
                "Μειώνει ή μηδενίζει την απαλλαγή του CDW.",
                "Συνιστάται για πλήρη ηρεμία κατά τη διάρκεια της ενοικίασης.",
            ],
            "excludes": [
                "Οι ίδιες εξαιρέσεις με το CDW (ελαστικά, υπόστρωμα, αμέλεια κ.λπ.).",
                "Δεν αντικαθιστά την υποχρέωση υπεύθυνης χρήσης του οχήματος.",
            ],
            "franchise_note": (
                f"Με SCDW η απαλλαγή γίνεται €{scdw:.0f}."
                if scdw > 0
                else "Με SCDW η απαλλαγή μηδενίζεται (€0)."
            ),
        },
        "ack_label": "Διάβασα την ασφαλιστική κάλυψη",
    }
