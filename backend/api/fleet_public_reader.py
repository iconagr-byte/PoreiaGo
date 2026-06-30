"""Read public fleet showcase from fleet_store.json — no heavy platform imports."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

FLEET_STORE = Path(__file__).resolve().parents[1] / "platform" / "fleet" / "fleet_store.json"

DEFAULT_AMENITIES: dict[str, list[str]] = {
    "Luxury Coach": [
        "Wi-Fi onboard",
        "USB & 220V",
        "Κλιματισμός",
        "Ανακλινόμενα leather seats",
        "WC onboard",
        "Mini bar",
    ],
    "Premium Express": [
        "Wi-Fi onboard",
        "USB θύρες",
        "Κλιματισμός",
        "Ανακλινόμενα καθίσματα",
        "Ψυγείο",
    ],
    "Standard": [
        "Κλιματισμός",
        "USB θύρες",
        "Θέρμανση",
        "Μεγάλοι αποθηκευτικοί χώροι",
    ],
}

DEFAULT_SEATS: dict[str, int] = {
    "Luxury Coach": 50,
    "Premium Express": 32,
    "Standard": 55,
}

SUMMARIES: dict[str, str] = {
    "Luxury Coach": "Premium coach για μεγάλες αποστάσεις — άνεση VIP επιπέδου.",
    "Premium Express": "Express στόλος για γρήγορες διαδρομές Ελλάδας & Ευρώπης.",
    "Standard": "Αξιόπιστο coach για ομαδικές εκδρομές και σχολικές μεταφορές.",
}


def _amenities(category: str, raw: list | None) -> list[str]:
    if raw:
        return [str(a).strip() for a in raw if str(a).strip()]
    return list(DEFAULT_AMENITIES.get(category, DEFAULT_AMENITIES["Standard"]))


def _service_status(row: dict) -> str:
    today = date.today()
    last_service = row.get("last_service_date")
    if isinstance(last_service, str):
        try:
            last_service = date.fromisoformat(last_service[:10])
        except ValueError:
            last_service = today
    else:
        last_service = today

    interval_km = int(row.get("service_interval_km") or 15000)
    interval_days = int(row.get("service_interval_days") or 365)
    odo = float(row.get("current_odometer") or 0)
    threshold = row.get("next_service_threshold")
    if threshold is None:
        threshold = float(row.get("last_service_mileage") or 0) + interval_km
    else:
        threshold = float(threshold)

    km_left = threshold - odo
    days_left = interval_days - (today - last_service).days
    if km_left <= 0 or days_left <= 0:
        return "Urgent"
    if km_left <= interval_km * 0.1 or days_left <= 30:
        return "Warning"
    return "OK"


def _public_row(row: dict) -> dict:
    category = str(row.get("category") or "Standard")
    seats = int(row.get("seat_count") or DEFAULT_SEATS.get(category, 49))
    make = str(row.get("make") or "")
    model = str(row.get("model") or "")
    status = _service_status(row)
    status_label = "Διαθέσιμο" if status == "OK" else "Περιορισμένη διαθεσιμότητα"
    return {
        "id": str(row.get("id") or ""),
        "name": f"{make} {model}".strip(),
        "make": make,
        "model": model,
        "category": category,
        "year": int(row.get("year") or 2020),
        "seat_count": seats,
        "amenities": _amenities(category, row.get("amenities")),
        "summary": str(row.get("public_summary") or SUMMARIES.get(category, f"{category} · {seats} θέσεις")),
        "image_url": str(row.get("public_image_url") or "/images/hero-bus-achillio.png"),
        "status_label": status_label,
    }


def _fallback_seed() -> list[dict]:
    today = date.today()
    seeds = [
        ("FL-001", "Mercedes", "Tourismo", 2022, "Luxury Coach", 50),
        ("FL-002", "Scania", "Irizar i6", 2021, "Premium Express", 32),
        ("FL-004", "Mercedes", "Tourismo", 2023, "Luxury Coach", 50),
    ]
    rows = []
    for vid, mk, model, yr, category, seats in seeds:
        rows.append(
            _public_row(
                {
                    "id": vid,
                    "make": mk,
                    "model": model,
                    "year": yr,
                    "category": category,
                    "seat_count": seats,
                    "amenities": DEFAULT_AMENITIES[category],
                    "public_summary": SUMMARIES[category],
                    "public_image_url": "/images/hero-bus-achillio.png",
                    "show_on_website": True,
                    "current_odometer": 42000,
                    "last_service_date": today.isoformat(),
                    "last_service_mileage": 40000,
                    "next_service_threshold": 50000,
                    "service_interval_km": 15000,
                    "service_interval_days": 365,
                }
            )
        )
    return rows


def read_public_fleet() -> list[dict]:
    if not FLEET_STORE.exists():
        return _fallback_seed()

    try:
        raw = json.loads(FLEET_STORE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _fallback_seed()

    rows: list[dict] = []
    for item in raw.get("vehicles", []):
        if not bool(item.get("show_on_website", True)):
            continue
        if _service_status(item) == "Urgent":
            continue
        rows.append(_public_row(item))

    if not rows:
        return _fallback_seed()
    return sorted(rows, key=lambda x: x["name"])
