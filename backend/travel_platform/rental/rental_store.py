"""Tenant-scoped fleet rental store (JSON) — availability + bookings + inspections."""

from __future__ import annotations

import json
import math
import os
import threading
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from travel_platform.settings.drivers_store import DEMO_TENANT_ID

_PACKAGE_DIR = Path(__file__).resolve().parent
_LEGACY_STORE_FILE = _PACKAGE_DIR / "rental_store.json"
_LOCK = threading.RLock()


def resolve_rental_store_paths() -> tuple[Path, Path]:
    """Prefer POREIAGO_DATA_DIR; migrate legacy package-local JSON once."""
    data_dir = Path(
        os.getenv("POREIAGO_DATA_DIR")
        or str(Path(__file__).resolve().parents[2] / "data")
    )
    primary = data_dir / "rental_store.json"
    if primary.is_file():
        return data_dir, primary
    if _LEGACY_STORE_FILE.is_file():
        try:
            data_dir.mkdir(parents=True, exist_ok=True)
            if not primary.exists():
                primary.write_text(
                    _LEGACY_STORE_FILE.read_text(encoding="utf-8"),
                    encoding="utf-8",
                )
            return data_dir, primary
        except OSError:
            return _PACKAGE_DIR, _LEGACY_STORE_FILE
    return data_dir, primary


DATA_DIR, STORE_FILE = resolve_rental_store_paths()

# ACRISS-inspired classes (Hertz / Sixt style) + legacy aliases.
VEHICLE_CATEGORIES = (
    "MINI",
    "ECONOMY",
    "COMPACT",
    "INTERMEDIATE",
    "STANDARD",
    "FULLSIZE",
    "PREMIUM",
    "LUXURY",
    "SUV",
    "VAN",
    "MINIBUS",
    # Legacy flat body types — normalized on write.
    "CAR",
)
VEHICLE_STATUSES = ("AVAILABLE", "RENTED", "MAINTENANCE", "CLEANING", "IN_TRANSIT")


def normalize_vehicle_category(
    category: str | None,
    *,
    seats: int | None = None,
    model: str | None = None,
) -> str:
    """Map legacy CAR/… (and model/seats hints) to a canonical rent class."""
    raw = str(category or "").strip().upper()
    canonical = {
        "MINI",
        "ECONOMY",
        "COMPACT",
        "INTERMEDIATE",
        "STANDARD",
        "FULLSIZE",
        "PREMIUM",
        "LUXURY",
        "SUV",
        "VAN",
        "MINIBUS",
    }
    name = str(model or "").strip().lower()
    try:
        seat_n = int(seats) if seats is not None else None
    except (TypeError, ValueError):
        seat_n = None
    if raw in canonical:
        if raw == "VAN" and seat_n is not None and seat_n >= 9:
            return "MINIBUS"
        return raw
    if raw == "SUV" or any(x in name for x in ("tucson", "kuga", "qashqai", "rav4", "sportage")):
        return "SUV"
    if raw == "MINIBUS" or (seat_n is not None and seat_n >= 9):
        return "MINIBUS"
    if raw == "VAN" or any(
        x in name for x in ("vito", "transporter", "multivan", "trafic", "transit", "custom")
    ):
        return "MINIBUS" if seat_n is not None and seat_n >= 9 else "VAN"
    if raw in {"CAR", ""}:
        if any(x in name for x in ("aygo", "i10", "twingo", "picanto")) or (
            seat_n is not None and seat_n <= 4
        ):
            return "MINI"
        if any(x in name for x in ("208", "clio", "yaris", "c3", "polo", "fiesta", "corsa")):
            return "COMPACT"
        if any(x in name for x in ("corolla", "civic", "focus", "golf", "octavia", "astra")):
            return "INTERMEDIATE"
        if seat_n is not None and seat_n <= 4:
            return "MINI"
        return "COMPACT"
    return "COMPACT"


BOOKING_STATUSES = ("RESERVED", "CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED")
ACTIVE_BOOKING_STATUSES = frozenset({"RESERVED", "CONFIRMED", "ACTIVE"})
INSPECTION_TYPES = ("PICKUP_CHECK", "RETURN_CHECK", "PICKUP", "RETURN")
SERVICE_MILEAGE_EVERY = 15_000

# Bookable extras (customer wizard + wallet) — priced into booking.total_cost.
EXTRAS_CATALOG: dict[str, dict[str, Any]] = {
    "extra_insurance": {"title": "SCDW Plus", "eur_per_day": 13.5},
    "super_cover": {"title": "Super Cover", "eur_per_day": 9.5},
    "extra_driver": {"title": "Επιπλέον οδηγός", "eur_per_day": 8.0},
    "child_seat": {"title": "Παιδικό κάθισμα", "eur_per_day": 7.0},
    "gps_pack": {"title": "GPS pack", "eur_per_day": 5.0},
}


def quote_extras(extra_ids: list[str] | None, *, days: int) -> dict[str, Any]:
    """Price selected extras for N rental days."""
    d = max(1, int(days or 1))
    lines: list[dict[str, Any]] = []
    total = 0.0
    seen: set[str] = set()
    for raw in extra_ids or []:
        key = str(raw or "").strip()
        if not key or key in seen:
            continue
        spec = EXTRAS_CATALOG.get(key)
        if not spec:
            continue
        seen.add(key)
        per_day = float(spec["eur_per_day"])
        line_total = round(per_day * d, 2)
        total += line_total
        lines.append(
            {
                "id": key,
                "title": spec["title"],
                "eur_per_day": per_day,
                "days": d,
                "total": line_total,
            }
        )
    return {"lines": lines, "total": round(total, 2), "days": d}


# Stable demo fleet (compact cars + vans) — seeded for empty demo offices.
# Photos are Wikimedia Commons shots of the named models (not mismatched stock cars).
_DEMO_FLEET_MARKER = "demo_rent_fleet_v1"
_WM = "https://upload.wikimedia.org/wikipedia/commons/"
_DEMO_VEHICLE_SPECS: tuple[dict[str, Any], ...] = (
    {
        "id_suffix": "car-i10",
        "plate_number": "DEMO-C01",
        "category": "MINI",
        "model": "Toyota Aygo X",
        "seating_capacity": 4,
        "daily_rate_eur": 32,
        "one_way_surcharge_eur": 25,
        "with_driver_daily_eur": 80,
        "current_mileage": 12400,
        "photo_url": (
            f"{_WM}thumb/a/a2/Toyota_Aygo_X_1X7A0063.jpg/"
            "1280px-Toyota_Aygo_X_1X7A0063.jpg"
        ),
        "description": (
            "Μοντέλο 2026 — μικρό city crossover, ιδανικό για πόλη και εύκολο πάρκινγκ. "
            "Οικονομικό, με κλιματισμό και άνεση για έως 4 επιβάτες."
        ),
    },
    {
        "id_suffix": "car-c3",
        "plate_number": "DEMO-C02",
        "category": "COMPACT",
        "model": "Peugeot 208",
        "seating_capacity": 5,
        "daily_rate_eur": 38,
        "one_way_surcharge_eur": 28,
        "with_driver_daily_eur": 85,
        "current_mileage": 15600,
        "photo_url": (
            f"{_WM}thumb/d/d8/Peugeot_208_B_facelift_DSC_7227.jpg/"
            "1280px-Peugeot_208_B_facelift_DSC_7227.jpg"
        ),
        "description": (
            "Μοντέλο 2026 — συμπαγές hatchback για καθημερινές διαδρομές και κοντινές αποδράσεις. "
            "Άνετη καμπίνα, κλιματισμός και χαμηλή κατανάλωση."
        ),
    },
    {
        "id_suffix": "car-yaris",
        "plate_number": "DEMO-C03",
        "category": "COMPACT",
        "model": "Renault Clio",
        "seating_capacity": 5,
        "daily_rate_eur": 42,
        "one_way_surcharge_eur": 30,
        "with_driver_daily_eur": 90,
        "current_mileage": 18200,
        "photo_url": (
            f"{_WM}thumb/c/c6/Renault_Clio_V_%282023%29_1X7A1577.jpg/"
            "1280px-Renault_Clio_V_%282023%29_1X7A1577.jpg"
        ),
        "description": (
            "Μοντέλο 2026 — συμπαγές και οικονομικό επιβατικό για καθημερινές διαδρομές, πάρκινγκ και "
            "κοντινές αποδράσεις. Εύκολο στην οδήγηση, με χαμηλή κατανάλωση και άνεση για έως 5 επιβάτες."
        ),
    },
    {
        "id_suffix": "van-transporter",
        "plate_number": "DEMO-V01",
        "category": "VAN",
        "model": "VW Multivan",
        "seating_capacity": 7,
        "daily_rate_eur": 95,
        "one_way_surcharge_eur": 50,
        "with_driver_daily_eur": 140,
        "current_mileage": 31200,
        "photo_url": (
            f"{_WM}thumb/c/c5/Volkswagen_T7_Multivan_1X7A0297.jpg/"
            "1280px-Volkswagen_T7_Multivan_1X7A0297.jpg"
        ),
        "description": (
            "Μοντέλο 2026 — ευρύχωρο Multivan για οικογένειες, εκδρομές και μεταφορές με αποσκευές. "
            "Άνετη καμπίνα και χώρος για επιβάτες και εξοπλισμό."
        ),
    },
    {
        "id_suffix": "van-vito",
        "plate_number": "DEMO-V02",
        "category": "VAN",
        "model": "Mercedes Vito",
        "seating_capacity": 8,
        "daily_rate_eur": 110,
        "one_way_surcharge_eur": 55,
        "with_driver_daily_eur": 150,
        "current_mileage": 27800,
        "photo_url": (
            f"{_WM}thumb/5/5c/MERCEDES-BENZ_VITO_%28W447%29_China.jpg/"
            "1280px-MERCEDES-BENZ_VITO_%28W447%29_China.jpg"
        ),
        "description": (
            "Μοντέλο 2026 — premium van για άνετες μετακινήσεις ομάδας ή VIP transfers. "
            "Ήσυχη καμπίνα, άνετα καθίσματα και παρουσία που ταιριάζει σε επαγγελματικές ή τουριστικές μετακινήσεις υψηλής στάθμης."
        ),
    },
    {
        "id_suffix": "van-trafic",
        "plate_number": "DEMO-V03",
        "category": "MINIBUS",
        "model": "Ford Transit Custom",
        "seating_capacity": 9,
        "daily_rate_eur": 88,
        "one_way_surcharge_eur": 45,
        "with_driver_daily_eur": 130,
        "current_mileage": 33400,
        "photo_url": (
            f"{_WM}thumb/e/e4/Ford_Transit_Custom_%282023%29_1X7A1605.jpg/"
            "1280px-Ford_Transit_Custom_%282023%29_1X7A1605.jpg"
        ),
        "description": (
            "Μοντέλο 2026 — ευέλικτο van για τουρισμό και εταιρικές μετακινήσεις. "
            "Ισορροπία χώρου, οικονομίας και ευελιξίας — ιδανικό για αεροδρόμιο, ξενοδοχεία και ημερήσιες εκδρομές με ομάδα."
        ),
    },
)


def _refresh_demo_fleet_copy(data: dict[str, Any], tenant_id: str) -> int:
    """Refresh marketing copy + models on seeded demo vehicles (incl. plate remap)."""
    by_suffix = {spec["id_suffix"]: spec for spec in _DEMO_VEHICLE_SPECS}
    by_plate = {str(spec["plate_number"]).upper(): spec for spec in _DEMO_VEHICLE_SPECS}
    updated = 0
    now = _now()
    for row in data.get("vehicles") or []:
        if row.get("tenant_id") != tenant_id:
            continue
        if str(row.get("notes") or "") != _DEMO_FLEET_MARKER:
            continue
        vid = str(row.get("id") or "")
        plate = str(row.get("plate_number") or "").strip().upper()
        spec = by_plate.get(plate)
        if not spec:
            suffix = None
            for key in by_suffix:
                if vid.endswith(key) or key in vid:
                    suffix = key
                    break
            if not suffix:
                model = str(row.get("model") or "").strip().lower()
                for key, candidate in by_suffix.items():
                    if str(candidate.get("model") or "").strip().lower() == model:
                        suffix = key
                        break
            spec = by_suffix.get(suffix) if suffix else None
        if not spec:
            continue
        changed = False
        for field, cast in (
            ("model", str),
            ("category", str),
            ("seating_capacity", int),
            ("daily_rate_eur", float),
            ("one_way_surcharge_eur", float),
            ("with_driver_daily_eur", float),
            ("description", str),
        ):
            new_val = cast(spec.get(field))
            old_val = row.get(field)
            if field in ("daily_rate_eur", "one_way_surcharge_eur", "with_driver_daily_eur"):
                try:
                    if float(old_val or 0) != float(new_val):
                        row[field] = float(new_val)
                        changed = True
                except (TypeError, ValueError):
                    row[field] = float(new_val)
                    changed = True
            elif field == "seating_capacity":
                if int(old_val or 0) != int(new_val):
                    row[field] = int(new_val)
                    changed = True
            else:
                if str(old_val or "").strip() != str(new_val or "").strip():
                    row[field] = new_val
                    changed = True
        new_photo = str(spec.get("photo_url") or "").strip()
        old_photo = str(row.get("photo_url") or "").strip()
        if new_photo and old_photo != new_photo:
            row["photo_url"] = new_photo
            row["photo_urls"] = [new_photo]
            changed = True
        if changed:
            row["updated_at"] = now
            updated += 1
    return updated


def demo_rental_fleet_allowed() -> bool:
    """Demo fleet auto-seed is opt-in outside production; always off in production unless forced."""
    flag = (os.getenv("RENT_DEMO_FLEET") or "").strip().lower()
    if flag in ("0", "false", "no", "off"):
        return False
    if flag in ("1", "true", "yes", "on"):
        return True
    env = (os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or "development").strip().lower()
    return env not in ("production", "prod")


def ensure_demo_rental_fleet(tenant_id: str | None = None) -> int:
    """
    Seed 3 επιβατικά + 3 van when the tenant has no rental vehicles yet.
    Idempotent — skips if any vehicle already exists for the tenant.
    Disabled in production (set RENT_DEMO_FLEET=true only for explicit demos).
    Returns number of vehicles inserted.
    """
    if not demo_rental_fleet_allowed():
        return 0
    tid = _normalize_tenant(tenant_id)
    with _LOCK:
        data = _read()
        existing = [v for v in data["vehicles"] if v.get("tenant_id") == tid]
        if existing:
            if _refresh_demo_fleet_copy(data, tid):
                _write(data)
            return 0
        now = _now()
        added = 0
        for spec in _DEMO_VEHICLE_SPECS:
            photo = str(spec.get("photo_url") or "").strip() or None
            row = {
                "id": f"demo-rent-{tid[:8]}-{spec['id_suffix']}",
                "tenant_id": tid,
                "plate_number": spec["plate_number"],
                "category": spec["category"],
                "model": spec["model"],
                "seating_capacity": int(spec["seating_capacity"]),
                "current_status": "AVAILABLE",
                "current_mileage": int(spec.get("current_mileage") or 0),
                "daily_rate_eur": float(spec["daily_rate_eur"]),
                "one_way_surcharge_eur": float(spec.get("one_way_surcharge_eur") or 0),
                "with_driver_daily_eur": float(spec.get("with_driver_daily_eur") or 0),
                "gps_device_id": None,
                "photo_url": photo,
                "photo_urls": [photo] if photo else [],
                "description": spec.get("description"),
                "notes": _DEMO_FLEET_MARKER,
                "created_at": now,
                "updated_at": now,
            }
            data["vehicles"].append(row)
            added += 1
        if added:
            _write(data)
        return added


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _normalize_tenant(value: str | None) -> str:
    tid = str(value or "").strip()
    return tid or DEMO_TENANT_ID


def _parse_dt(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        dt = value
    else:
        raw = str(value or "").strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(raw)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _empty() -> dict[str, Any]:
    return {"vehicles": [], "bookings": [], "inspections": []}


def _read() -> dict[str, Any]:
    if not STORE_FILE.is_file():
        return _empty()
    try:
        data = json.loads(STORE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return _empty()
    if not isinstance(data, dict):
        return _empty()
    for key in ("vehicles", "bookings", "inspections"):
        if not isinstance(data.get(key), list):
            data[key] = []
    return data


def _write(data: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STORE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(STORE_FILE)


def _ranges_overlap(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end


def list_vehicles(tenant_id: str | None, *, category: str | None = None) -> list[dict[str, Any]]:
    tid = _normalize_tenant(tenant_id)
    with _LOCK:
        rows = [deepcopy(v) for v in _read()["vehicles"] if v.get("tenant_id") == tid]
    for v in rows:
        v["category"] = normalize_vehicle_category(
            v.get("category"),
            seats=v.get("seating_capacity"),
            model=v.get("model"),
        )
    if category:
        raw_filter = str(category).strip().upper()
        if raw_filter == "CAR":
            passenger = {
                "MINI",
                "ECONOMY",
                "COMPACT",
                "INTERMEDIATE",
                "STANDARD",
                "FULLSIZE",
                "PREMIUM",
                "LUXURY",
            }
            rows = [v for v in rows if str(v.get("category") or "") in passenger]
        else:
            want = normalize_vehicle_category(raw_filter)
            rows = [v for v in rows if str(v.get("category") or "").upper() == want]
    return sorted(rows, key=lambda v: (v.get("category") or "", v.get("plate_number") or ""))


def get_vehicle(tenant_id: str | None, vehicle_id: str) -> dict[str, Any] | None:
    tid = _normalize_tenant(tenant_id)
    with _LOCK:
        for v in _read()["vehicles"]:
            if v.get("tenant_id") == tid and v.get("id") == vehicle_id:
                return deepcopy(v)
    return None


def upsert_vehicle(tenant_id: str | None, body: dict[str, Any], *, vehicle_id: str | None = None) -> dict[str, Any]:
    tid = _normalize_tenant(tenant_id)
    plate = str(body.get("plate_number") or "").strip().upper()
    model = str(body.get("model") or "").strip()
    if not plate or not model:
        raise ValueError("Απαιτούνται πινακίδα και μοντέλο")
    seats = int(body.get("seating_capacity") or 5)
    if seats < 2 or seats > 80:
        raise ValueError("Μη έγκυρη χωρητικότητα")
    category = normalize_vehicle_category(
        body.get("category") or "COMPACT",
        seats=seats,
        model=model,
    )
    if category not in VEHICLE_CATEGORIES:
        raise ValueError("Μη έγκυρη κατηγορία")
    status = str(body.get("current_status") or "AVAILABLE").strip().upper()
    if status not in VEHICLE_STATUSES:
        raise ValueError("Μη έγκυρη κατάσταση οχήματος")
    mileage = max(0, int(body.get("current_mileage") or 0))
    rate = float(body.get("daily_rate_eur") or 0)
    if rate < 0:
        raise ValueError("Μη έγκυρη ημερήσια τιμή")
    one_way = float(body.get("one_way_surcharge_eur") or 0)
    with_driver = float(body.get("with_driver_daily_eur") or 0)
    if one_way < 0 or with_driver < 0:
        raise ValueError("Μη έγκυρη επιπλέον χρέωση")
    year_val = None
    if body.get("year") not in (None, ""):
        try:
            year_val = int(body.get("year"))
        except (TypeError, ValueError) as exc:
            raise ValueError("Μη έγκυρο έτος μοντέλου") from exc
        if year_val < 1980 or year_val > 2100:
            raise ValueError("Μη έγκυρο έτος μοντέλου")

    with _LOCK:
        data = _read()
        existing = None
        if vehicle_id:
            for v in data["vehicles"]:
                if v.get("tenant_id") == tid and v.get("id") == vehicle_id:
                    existing = v
                    break
            if not existing:
                raise ValueError("Το όχημα δεν βρέθηκε")
        for v in data["vehicles"]:
            if v.get("tenant_id") != tid:
                continue
            if str(v.get("plate_number") or "").upper() == plate and (not existing or v.get("id") != existing.get("id")):
                raise ValueError("Η πινακίδα υπάρχει ήδη")

        now = _now()
        row = existing or {
            "id": str(uuid4()),
            "tenant_id": tid,
            "created_at": now,
        }
        row.update(
            {
                "plate_number": plate,
                "category": category,
                "model": model,
                "year": year_val,
                "seating_capacity": seats,
                "current_status": status,
                "current_mileage": mileage,
                "daily_rate_eur": round(rate, 2),
                "one_way_surcharge_eur": round(one_way, 2),
                "with_driver_daily_eur": round(with_driver, 2),
                "gps_device_id": (str(body.get("gps_device_id") or "").strip() or None),
                "photo_url": (str(body.get("photo_url") or "").strip() or None),
                "photo_urls": [
                    str(u).strip()
                    for u in (body.get("photo_urls") or [])
                    if str(u or "").strip()
                ][:12],
                "description": (str(body.get("description") or "").strip() or None),
                "notes": (str(body.get("notes") or "").strip() or None),
                "updated_at": now,
            }
        )
        # Cover photo: explicit photo_url, else first gallery image.
        if not row.get("photo_url") and row.get("photo_urls"):
            row["photo_url"] = row["photo_urls"][0]
        if not existing:
            data["vehicles"].append(row)
        _write(data)
        return deepcopy(row)


def delete_vehicle(tenant_id: str | None, vehicle_id: str) -> bool:
    tid = _normalize_tenant(tenant_id)
    with _LOCK:
        data = _read()
        for b in data["bookings"]:
            if (
                b.get("tenant_id") == tid
                and b.get("vehicle_id") == vehicle_id
                and b.get("rental_status") in ACTIVE_BOOKING_STATUSES
            ):
                raise ValueError("Υπάρχει ενεργή κράτηση — ακυρώστε την πρώτα")
        before = len(data["vehicles"])
        data["vehicles"] = [
            v for v in data["vehicles"] if not (v.get("tenant_id") == tid and v.get("id") == vehicle_id)
        ]
        if len(data["vehicles"]) == before:
            return False
        _write(data)
        return True


def list_bookings(
    tenant_id: str | None,
    *,
    vehicle_id: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    tid = _normalize_tenant(tenant_id)
    with _LOCK:
        rows = [b for b in _read()["bookings"] if b.get("tenant_id") == tid]
    if vehicle_id:
        rows = [b for b in rows if b.get("vehicle_id") == vehicle_id]
    if status:
        st = status.strip().upper()
        rows = [b for b in rows if str(b.get("rental_status") or "").upper() == st]
    return sorted(rows, key=lambda b: b.get("start_time") or "", reverse=True)


def _vehicle_conflicts(
    data: dict[str, Any],
    *,
    tenant_id: str,
    vehicle_id: str,
    start: datetime,
    end: datetime,
    exclude_booking_id: str | None = None,
) -> list[dict[str, Any]]:
    hits = []
    for b in data["bookings"]:
        if b.get("tenant_id") != tenant_id or b.get("vehicle_id") != vehicle_id:
            continue
        if b.get("rental_status") not in ACTIVE_BOOKING_STATUSES:
            continue
        if exclude_booking_id and b.get("id") == exclude_booking_id:
            continue
        b_start = _parse_dt(b["start_time"])
        b_end = _parse_dt(b["end_time"])
        if _ranges_overlap(start, end, b_start, b_end):
            hits.append(b)
    return hits


def _norm_place(value: str | None) -> str:
    return " ".join(str(value or "").strip().lower().split())


def quote_vehicle(
    vehicle: dict[str, Any],
    *,
    start: datetime,
    end: datetime,
    pickup_location: str | None = None,
    dropoff_location: str | None = None,
    driver_mode: str | None = None,
) -> dict[str, Any]:
    """Compute rental quote: base days + optional one-way + with-driver."""
    days = max(1, math.ceil((end - start).total_seconds() / 86400))
    rate = float(vehicle.get("daily_rate_eur") or 0)
    one_way_fee = float(vehicle.get("one_way_surcharge_eur") or 0)
    with_driver_daily = float(vehicle.get("with_driver_daily_eur") or 0)
    mode = str(driver_mode or "SELF_DRIVE").strip().upper() or "SELF_DRIVE"
    pickup = _norm_place(pickup_location)
    dropoff = _norm_place(dropoff_location) or pickup
    is_one_way = bool(pickup and dropoff and pickup != dropoff)
    base_total = round(rate * days, 2)
    driver_surcharge = round(with_driver_daily * days, 2) if mode == "WITH_DRIVER" else 0.0
    one_way_surcharge = round(one_way_fee, 2) if is_one_way else 0.0
    return {
        "suggested_days": days,
        "base_total": base_total,
        "driver_surcharge": driver_surcharge,
        "one_way_surcharge": one_way_surcharge,
        "suggested_total": round(base_total + driver_surcharge + one_way_surcharge, 2),
        "is_one_way": is_one_way,
        "driver_mode": mode,
    }


def check_availability(
    tenant_id: str | None,
    *,
    start_time: str,
    end_time: str,
    category: str | None = None,
    min_seats: int | None = None,
    pickup_location: str | None = None,
    dropoff_location: str | None = None,
    driver_mode: str | None = None,
) -> list[dict[str, Any]]:
    tid = _normalize_tenant(tenant_id)
    start = _parse_dt(start_time)
    end = _parse_dt(end_time)
    if end <= start:
        raise ValueError("Η λήξη πρέπει να είναι μετά την έναρξη")
    seats_need = int(min_seats or 0)
    with _LOCK:
        data = _read()
        out = []
        for v in data["vehicles"]:
            if v.get("tenant_id") != tid:
                continue
            if str(v.get("current_status") or "") == "MAINTENANCE":
                continue
            if category and str(v.get("category") or "").upper() != category.strip().upper():
                continue
            if seats_need and int(v.get("seating_capacity") or 0) < seats_need:
                continue
            conflicts = _vehicle_conflicts(
                data,
                tenant_id=tid,
                vehicle_id=v["id"],
                start=start,
                end=end,
            )
            if conflicts:
                continue
            quote = quote_vehicle(
                v,
                start=start,
                end=end,
                pickup_location=pickup_location,
                dropoff_location=dropoff_location,
                driver_mode=driver_mode,
            )
            out.append(
                {
                    **deepcopy(v),
                    **quote,
                    "fit_score": int(v.get("seating_capacity") or 0) - seats_need,
                }
            )
    # Prefer closest seating fit, then lower price.
    out.sort(key=lambda r: (abs(int(r.get("fit_score") or 0)), float(r.get("suggested_total") or 0)))
    return out


def create_booking(tenant_id: str | None, body: dict[str, Any]) -> dict[str, Any]:
    tid = _normalize_tenant(tenant_id)
    vehicle_id = str(body.get("vehicle_id") or "").strip()
    client_name = str(body.get("client_name") or "").strip()
    start = _parse_dt(body.get("start_time"))
    end = _parse_dt(body.get("end_time"))
    pickup = str(body.get("pickup_location") or "").strip()
    dropoff = str(body.get("dropoff_location") or "").strip() or pickup
    if not vehicle_id or not client_name or not pickup:
        raise ValueError("Συμπληρώστε όχημα, πελάτη και σημείο παραλαβής")
    if end <= start:
        raise ValueError("Η λήξη πρέπει να είναι μετά την έναρξη")

    with _LOCK:
        data = _read()
        vehicle = next(
            (v for v in data["vehicles"] if v.get("tenant_id") == tid and v.get("id") == vehicle_id),
            None,
        )
        if not vehicle:
            raise ValueError("Το όχημα δεν βρέθηκε")
        if str(vehicle.get("current_status") or "") == "MAINTENANCE":
            raise ValueError("Το όχημα είναι σε συντήρηση")
        conflicts = _vehicle_conflicts(
            data,
            tenant_id=tid,
            vehicle_id=vehicle_id,
            start=start,
            end=end,
        )
        if conflicts:
            raise ValueError("Το όχημα δεν είναι διαθέσιμο για αυτές τις ημερομηνίες")

        driver_mode = str(body.get("driver_mode") or "SELF_DRIVE").strip().upper() or "SELF_DRIVE"
        quote = quote_vehicle(
            vehicle,
            start=start,
            end=end,
            pickup_location=pickup,
            dropoff_location=dropoff,
            driver_mode=driver_mode,
        )
        extras_quote = quote_extras(body.get("extras"), days=quote["suggested_days"])
        vehicle_total = float(quote["suggested_total"])
        extras_total = float(extras_quote["total"])
        total = body.get("total_cost")
        if total is None:
            total = round(vehicle_total + extras_total, 2)
        else:
            total = round(float(total), 2)

        channel = str(body.get("channel") or "DESK").strip().upper() or "DESK"
        if channel not in ("DESK", "WALLET"):
            channel = "DESK"

        extra_titles = [line["title"] for line in extras_quote["lines"]]
        notes = str(body.get("notes") or "").strip() or None
        if extra_titles:
            extras_note = f"Extras: {', '.join(extra_titles)}"
            notes = f"{notes} · {extras_note}" if notes else extras_note

        now = _now()
        booking_id = str(uuid4())
        ref_code = f"RB-{booking_id.replace('-', '')[:8].upper()}"

        payment_method = str(body.get("payment_method") or "").strip() or None
        payment_plan = str(body.get("payment_plan") or "").strip() or None
        deposit_percent = body.get("deposit_percent")
        try:
            deposit_percent = int(deposit_percent) if deposit_percent is not None else None
        except (TypeError, ValueError):
            deposit_percent = None
        amount_paid = body.get("amount_paid")
        balance_due = body.get("balance_due")
        try:
            amount_paid = round(float(amount_paid), 2) if amount_paid is not None else None
        except (TypeError, ValueError):
            amount_paid = None
        try:
            balance_due = round(float(balance_due), 2) if balance_due is not None else None
        except (TypeError, ValueError):
            balance_due = None

        # P0/P1: never trust client payment_status, fake card, or forged Stripe IDs.
        # Mark PAID only via trusted server paths (webhook / office confirm) that set
        # body["_server_verified_payment"]=True with a provider reference.
        provider_ref = None
        server_verified = bool(body.get("_server_verified_payment"))
        if server_verified:
            for key in (
                "stripe_session_id",
                "stripe_payment_intent",
                "payment_intent_id",
                "provider_payment_id",
            ):
                cand = str(body.get(key) or "").strip()
                if cand:
                    provider_ref = cand
                    break

        if provider_ref:
            payment_status = "PAID"
            pending_pay = False
            rental_status = "CONFIRMED"
        else:
            # Bank / cash / unproven card stay reserved until office or Stripe confirms.
            pending_pay = True
            payment_status = "PENDING"
            rental_status = "RESERVED"
            # Ignore client-claimed settlement amounts without provider proof.
            amount_paid = 0.0
            balance_due = total

        row = {
            "id": booking_id,
            "reference_code": ref_code,
            "tenant_id": tid,
            "vehicle_id": vehicle_id,
            "client_id": (str(body.get("client_id") or "").strip() or None),
            "client_name": client_name,
            "client_email": (str(body.get("client_email") or "").strip().lower() or None),
            "client_phone": (str(body.get("client_phone") or "").strip() or None),
            "channel": channel,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "pickup_location": pickup,
            "dropoff_location": dropoff,
            "total_cost": total,
            "pricing": {
                "days": quote["suggested_days"],
                "base_total": quote["base_total"],
                "driver_surcharge": quote["driver_surcharge"],
                "one_way_surcharge": quote["one_way_surcharge"],
                "is_one_way": quote["is_one_way"],
                "vehicle_total": vehicle_total,
                "extras_total": extras_total,
                "extras": extras_quote["lines"],
            },
            "extras": [line["id"] for line in extras_quote["lines"]],
            "rental_status": rental_status,
            "driver_mode": driver_mode,
            "assigned_driver_id": (str(body.get("assigned_driver_id") or "").strip() or None),
            "notes": notes,
            "marketing_email": bool(body.get("marketing_email")),
            "marketing_sms": bool(body.get("marketing_sms")),
            "payment_method": payment_method,
            "payment_plan": payment_plan,
            "deposit_percent": deposit_percent,
            "amount_paid": amount_paid if amount_paid is not None else (0.0 if pending_pay else total),
            "balance_due": balance_due
            if balance_due is not None
            else (total if pending_pay else 0.0),
            "payment_status": payment_status,
            "provider_payment_id": provider_ref,
            "legal_doc_signatures": {},
            "created_at": now,
            "updated_at": now,
            "vehicle_plate": vehicle.get("plate_number"),
            "vehicle_model": vehicle.get("model"),
            "vehicle_category": vehicle.get("category"),
        }
        data["bookings"].append(row)
        vehicle["current_status"] = "RENTED"
        vehicle["updated_at"] = now
        _write(data)
        return deepcopy(row)


def confirm_booking_payment(
    tenant_id: str | None,
    booking_id: str,
    *,
    amount_paid: float | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    """
    Office confirms bank/cash (or post-Stripe) settlement.
    Marks payment PAID, rental CONFIRMED, and queues fiscal issuance marker.
    """
    tid = _normalize_tenant(tenant_id)
    bid = str(booking_id or "").strip()
    with _LOCK:
        data = _read()
        booking = next(
            (b for b in data["bookings"] if b.get("tenant_id") == tid and b.get("id") == bid),
            None,
        )
        if not booking:
            raise ValueError("Η κράτηση δεν βρέθηκε")
        status = str(booking.get("rental_status") or "").upper()
        if status == "CANCELLED":
            raise ValueError("Δεν μπορείτε να επιβεβαιώσετε πληρωμή σε ακυρωμένη κράτηση")
        total = float(booking.get("total_cost") or 0)
        paid = amount_paid
        if paid is None:
            paid = total
        try:
            paid = round(float(paid), 2)
        except (TypeError, ValueError) as exc:
            raise ValueError("Μη έγκυρο ποσό πληρωμής") from exc
        if paid < 0 or paid > total + 0.01:
            raise ValueError("Το ποσό πληρωμής είναι εκτός ορίων")
        now = _now()
        booking["payment_status"] = "PAID" if paid + 0.001 >= total else "PARTIAL"
        booking["amount_paid"] = paid
        booking["balance_due"] = round(max(0.0, total - paid), 2)
        booking["provider_payment_id"] = (
            str(booking.get("provider_payment_id") or "").strip()
            or f"office-confirm-{uuid4()}"
        )
        if status in ("RESERVED", "CONFIRMED"):
            booking["rental_status"] = "CONFIRMED"
        booking["fiscal_status"] = booking.get("fiscal_status") or "PENDING_ISSUE"
        booking["payment_confirmed_at"] = now
        if note:
            prev = str(booking.get("notes") or "").strip()
            addon = f"Πληρωμή επιβεβαιώθηκε: {note.strip()}"
            booking["notes"] = f"{prev} · {addon}" if prev else addon
        booking["updated_at"] = now
        _write(data)
        return deepcopy(booking)


def update_booking_status(tenant_id: str | None, booking_id: str, status: str) -> dict[str, Any]:
    tid = _normalize_tenant(tenant_id)
    st = status.strip().upper()
    if st not in BOOKING_STATUSES:
        raise ValueError("Μη έγκυρη κατάσταση κράτησης")
    with _LOCK:
        data = _read()
        booking = next(
            (b for b in data["bookings"] if b.get("tenant_id") == tid and b.get("id") == booking_id),
            None,
        )
        if not booking:
            raise ValueError("Η κράτηση δεν βρέθηκε")
        booking["rental_status"] = st
        booking["updated_at"] = _now()
        vehicle = next(
            (
                v
                for v in data["vehicles"]
                if v.get("tenant_id") == tid and v.get("id") == booking.get("vehicle_id")
            ),
            None,
        )
        if vehicle:
            if st in ("CANCELLED", "COMPLETED"):
                # Free vehicle unless another active booking remains.
                still = _vehicle_conflicts(
                    data,
                    tenant_id=tid,
                    vehicle_id=vehicle["id"],
                    start=_parse_dt("2000-01-01T00:00:00+00:00"),
                    end=_parse_dt("2100-01-01T00:00:00+00:00"),
                    exclude_booking_id=booking_id if st == "CANCELLED" else None,
                )
                # For COMPLETED, exclude this booking from conflict check.
                if st == "COMPLETED":
                    still = [
                        b
                        for b in data["bookings"]
                        if b.get("tenant_id") == tid
                        and b.get("vehicle_id") == vehicle["id"]
                        and b.get("id") != booking_id
                        and b.get("rental_status") in ACTIVE_BOOKING_STATUSES
                    ]
                if st == "CANCELLED":
                    still = [
                        b
                        for b in data["bookings"]
                        if b.get("tenant_id") == tid
                        and b.get("vehicle_id") == vehicle["id"]
                        and b.get("id") != booking_id
                        and b.get("rental_status") in ACTIVE_BOOKING_STATUSES
                    ]
                vehicle["current_status"] = "RENTED" if still else "AVAILABLE"
            elif st == "ACTIVE":
                vehicle["current_status"] = "RENTED"
            vehicle["updated_at"] = _now()
        _write(data)
        return deepcopy(booking)


_LEGAL_DOC_IDS = frozenset(
    {
        "agreement",
        "license_decl",
        "insurance_ack",
        "deposit",
        "gdpr",
        "terms",
    }
)


def save_legal_doc_signature(
    tenant_id: str | None,
    booking_id: str,
    *,
    doc_id: str,
    signature_url: str,
    signer_name: str | None = None,
) -> dict[str, Any]:
    """Attach a customer signature to a booking legal document (non-inspection docs)."""
    tid = _normalize_tenant(tenant_id)
    doc = str(doc_id or "").strip()
    url = str(signature_url or "").strip()
    if doc not in _LEGAL_DOC_IDS:
        raise ValueError("Μη έγκυρο νομικό έγγραφο")
    if not url:
        raise ValueError("Απαιτείται υπογραφή")
    with _LOCK:
        data = _read()
        booking = next(
            (b for b in data["bookings"] if b.get("tenant_id") == tid and b.get("id") == booking_id),
            None,
        )
        if not booking:
            raise ValueError("Η κράτηση δεν βρέθηκε")
        if booking.get("rental_status") == "CANCELLED":
            raise ValueError("Η κράτηση είναι ακυρωμένη")
        sigs = booking.get("legal_doc_signatures")
        if not isinstance(sigs, dict):
            sigs = {}
        sigs[doc] = {
            "signature_url": url,
            "signed_at": _now(),
            "signer_name": (str(signer_name or "").strip() or booking.get("client_name") or None),
        }
        booking["legal_doc_signatures"] = sigs
        booking["updated_at"] = _now()
        _write(data)
        return deepcopy(booking)


def calendar_blocks(tenant_id: str | None, *, days: int = 30) -> list[dict[str, Any]]:
    tid = _normalize_tenant(tenant_id)
    with _LOCK:
        data = _read()
        vehicles = {v["id"]: v for v in data["vehicles"] if v.get("tenant_id") == tid}
        blocks = []
        for b in data["bookings"]:
            if b.get("tenant_id") != tid:
                continue
            if b.get("rental_status") == "CANCELLED":
                continue
            v = vehicles.get(b.get("vehicle_id") or "")
            blocks.append(
                {
                    "id": b["id"],
                    "kind": "rental",
                    "vehicle_id": b.get("vehicle_id"),
                    "plate_number": (v or {}).get("plate_number") or b.get("vehicle_plate"),
                    "model": (v or {}).get("model") or b.get("vehicle_model"),
                    "category": (v or {}).get("category") or b.get("vehicle_category"),
                    "title": b.get("client_name"),
                    "start_time": b.get("start_time"),
                    "end_time": b.get("end_time"),
                    "status": b.get("rental_status"),
                    "pickup_location": b.get("pickup_location"),
                    "dropoff_location": b.get("dropoff_location"),
                    "total_cost": b.get("total_cost"),
                }
            )
        for v in vehicles.values():
            if str(v.get("current_status") or "") == "MAINTENANCE":
                blocks.append(
                    {
                        "id": f"maint-{v['id']}",
                        "kind": "maintenance",
                        "vehicle_id": v["id"],
                        "plate_number": v.get("plate_number"),
                        "model": v.get("model"),
                        "category": v.get("category"),
                        "title": "Συντήρηση",
                        "start_time": None,
                        "end_time": None,
                        "status": "MAINTENANCE",
                    }
                )
            mileage = int(v.get("current_mileage") or 0)
            if mileage and mileage % SERVICE_MILEAGE_EVERY >= SERVICE_MILEAGE_EVERY - 500:
                blocks.append(
                    {
                        "id": f"service-due-{v['id']}",
                        "kind": "service_due",
                        "vehicle_id": v["id"],
                        "plate_number": v.get("plate_number"),
                        "model": v.get("model"),
                        "category": v.get("category"),
                        "title": f"Service κοντά ({mileage} km)",
                        "start_time": None,
                        "end_time": None,
                        "status": "SERVICE_DUE",
                    }
                )
    return blocks


def create_inspection(tenant_id: str | None, body: dict[str, Any]) -> dict[str, Any]:
    tid = _normalize_tenant(tenant_id)
    booking_id = str(body.get("rental_booking_id") or "").strip()
    itype = str(body.get("inspection_type") or "").strip().upper()
    itype = {"PICKUP": "PICKUP_CHECK", "RETURN": "RETURN_CHECK"}.get(itype, itype)
    if itype not in ("PICKUP_CHECK", "RETURN_CHECK"):
        raise ValueError("Μη έγκυρος τύπος επιθεώρησης")
    with _LOCK:
        data = _read()
        booking = next(
            (b for b in data["bookings"] if b.get("tenant_id") == tid and b.get("id") == booking_id),
            None,
        )
        if not booking:
            raise ValueError("Η κράτηση δεν βρέθηκε")
        mileage = max(0, int(body.get("mileage") or 0))
        fuel = float(body.get("fuel_level") or 100)
        fuel = max(0.0, min(100.0, fuel))
        now = _now()
        row = {
            "id": str(uuid4()),
            "tenant_id": tid,
            "rental_booking_id": booking_id,
            "inspection_type": itype,
            "fuel_level": round(fuel, 2),
            "mileage": mileage,
            "damage_notes": (str(body.get("damage_notes") or "").strip() or None),
            "photo_urls": list(body.get("photo_urls") or []),
            "signature_url": (str(body.get("signature_url") or "").strip() or None),
            "inspector_name": (str(body.get("inspector_name") or "").strip() or None),
            "created_at": now,
            "updated_at": now,
        }
        data["inspections"].append(row)
        vehicle = next(
            (
                v
                for v in data["vehicles"]
                if v.get("tenant_id") == tid and v.get("id") == booking.get("vehicle_id")
            ),
            None,
        )
        if vehicle and mileage:
            vehicle["current_mileage"] = max(int(vehicle.get("current_mileage") or 0), mileage)
            vehicle["updated_at"] = now
        if itype == "PICKUP_CHECK" and booking.get("rental_status") in ("CONFIRMED", "RESERVED"):
            booking["rental_status"] = "ACTIVE"
            booking["updated_at"] = now
            if vehicle:
                vehicle["current_status"] = "RENTED"
        if itype == "RETURN_CHECK":
            booking["rental_status"] = "COMPLETED"
            booking["updated_at"] = now
            if vehicle:
                vehicle["current_status"] = "AVAILABLE"
                vehicle["updated_at"] = now
        _write(data)
        return deepcopy(row)


def list_inspections(tenant_id: str | None, *, booking_id: str | None = None) -> list[dict[str, Any]]:
    tid = _normalize_tenant(tenant_id)
    with _LOCK:
        rows = [i for i in _read()["inspections"] if i.get("tenant_id") == tid]
    if booking_id:
        rows = [i for i in rows if i.get("rental_booking_id") == booking_id]
    return sorted(rows, key=lambda i: i.get("created_at") or "", reverse=True)


def list_bookings_for_email(tenant_id: str | None, email: str) -> list[dict[str, Any]]:
    tid = _normalize_tenant(tenant_id)
    needle = str(email or "").strip().lower()
    if not needle:
        return []
    rows = [
        b
        for b in list_bookings(tid)
        if str(b.get("client_email") or "").strip().lower() == needle
    ]
    return rows


def _booking_reference_code(row: dict[str, Any]) -> str:
    existing = str(row.get("reference_code") or "").strip().upper()
    if existing:
        return existing
    bid = str(row.get("id") or "").replace("-", "")
    if len(bid) >= 8:
        return f"RB-{bid[:8].upper()}"
    return str(row.get("id") or "").upper()


def lookup_booking_for_guest(
    tenant_id: str | None,
    *,
    email: str,
    reference: str,
) -> dict[str, Any] | None:
    """Match rental booking by client email + reference_code / id (guest lookup)."""
    needle = str(email or "").strip().lower()
    raw_ref = str(reference or "").strip().upper().replace(" ", "")
    if not needle or len(raw_ref) < 4:
        return None
    variants = {raw_ref, raw_ref.removeprefix("RB-"), raw_ref.removeprefix("BK-")}
    if not raw_ref.startswith("RB-") and len(raw_ref) >= 4:
        variants.add(f"RB-{raw_ref}")
    for row in list_bookings_for_email(tenant_id, needle):
        code = _booking_reference_code(row)
        bid = str(row.get("id") or "").upper()
        compact = bid.replace("-", "")
        candidates = {code, code.removeprefix("RB-"), bid, compact, compact[:8]}
        if variants & {c for c in candidates if c}:
            out = deepcopy(row)
            out["reference_code"] = code
            return out
    return None


def list_clients(tenant_id: str | None) -> list[dict[str, Any]]:
    """Unique rental clients (desk + Wallet) with booking counts."""
    bookings = list_bookings(tenant_id)
    by_key: dict[str, dict[str, Any]] = {}
    for b in bookings:
        email = str(b.get("client_email") or "").strip().lower()
        phone = str(b.get("client_phone") or "").strip()
        name = str(b.get("client_name") or "").strip()
        key = email or phone or name or b.get("id")
        if not key:
            continue
        row = by_key.get(key)
        if not row:
            row = {
                "id": key,
                "client_name": name or "—",
                "client_email": email or None,
                "client_phone": phone or None,
                "channels": set(),
                "booking_count": 0,
                "active_count": 0,
                "total_spent_eur": 0.0,
                "last_booking_at": None,
                "last_status": None,
                "last_vehicle": None,
            }
            by_key[key] = row
        if name and (row["client_name"] == "—" or len(name) > len(row["client_name"])):
            row["client_name"] = name
        if email:
            row["client_email"] = email
        if phone and not row["client_phone"]:
            row["client_phone"] = phone
        channel = str(b.get("channel") or ("WALLET" if email else "DESK")).upper()
        row["channels"].add(channel)
        row["booking_count"] += 1
        if b.get("rental_status") in ACTIVE_BOOKING_STATUSES:
            row["active_count"] += 1
        if b.get("rental_status") != "CANCELLED":
            row["total_spent_eur"] += float(b.get("total_cost") or 0)
        created = b.get("created_at") or b.get("start_time")
        if created and (not row["last_booking_at"] or str(created) > str(row["last_booking_at"])):
            row["last_booking_at"] = created
            row["last_status"] = b.get("rental_status")
            row["last_vehicle"] = b.get("vehicle_plate") or b.get("vehicle_model")
    out = []
    for row in by_key.values():
        out.append(
            {
                **row,
                "channels": sorted(row["channels"]),
                "total_spent_eur": round(row["total_spent_eur"], 2),
            }
        )
    out.sort(key=lambda r: r.get("last_booking_at") or "", reverse=True)
    return out


def cancel_booking_for_customer(
    tenant_id: str | None,
    booking_id: str,
    *,
    email: str,
) -> dict[str, Any]:
    """Customer self-cancel — only CONFIRMED bookings owned by this email."""
    tid = _normalize_tenant(tenant_id)
    needle = str(email or "").strip().lower()
    bid = str(booking_id or "").strip()
    if not needle or not bid:
        raise ValueError("Απαιτείται κράτηση και email")
    with _LOCK:
        data = _read()
        booking = next(
            (b for b in data["bookings"] if b.get("tenant_id") == tid and b.get("id") == bid),
            None,
        )
        if not booking:
            raise ValueError("Η κράτηση δεν βρέθηκε")
        owner = str(booking.get("client_email") or "").strip().lower()
        if owner != needle:
            raise ValueError("Δεν έχετε δικαίωμα σε αυτή την κράτηση")
        status = str(booking.get("rental_status") or "").upper()
        if status == "CANCELLED":
            return deepcopy(booking)
        if status not in ("CONFIRMED", "RESERVED"):
            raise ValueError("Μπορείτε να ακυρώσετε μόνο επιβεβαιωμένες ή δεσμευμένες κρατήσεις")
    return update_booking_status(tid, bid, "CANCELLED")


def public_catalog(tenant_id: str | None, *, category: str | None = None) -> list[dict[str, Any]]:
    """Customer-facing vehicle cards for this office. Demo seed only when allowed."""
    ensure_demo_rental_fleet(tenant_id)
    rows = list_vehicles(tenant_id, category=category)
    out = []
    for v in rows:
        if str(v.get("current_status") or "") == "MAINTENANCE":
            continue
        out.append(
            {
                "id": v["id"],
                "plate_number": v.get("plate_number"),
                "category": v.get("category"),
                "model": v.get("model"),
                "seating_capacity": v.get("seating_capacity"),
                "current_status": v.get("current_status"),
                "daily_rate_eur": v.get("daily_rate_eur"),
                "one_way_surcharge_eur": float(v.get("one_way_surcharge_eur") or 0),
                "with_driver_daily_eur": float(v.get("with_driver_daily_eur") or 0),
                "photo_url": v.get("photo_url") or ((v.get("photo_urls") or [None])[0]),
                "photo_urls": list(v.get("photo_urls") or ([] if not v.get("photo_url") else [v.get("photo_url")])),
                "description": v.get("description"),
            }
        )
    return out


def active_rental_overlays(tenant_id: str | None) -> list[dict[str, Any]]:
    """Active rentals with GPS identity for live-map overlay."""
    tid = _normalize_tenant(tenant_id)
    with _LOCK:
        data = _read()
        vehicles = {v["id"]: v for v in data["vehicles"] if v.get("tenant_id") == tid}
        out = []
        for b in data["bookings"]:
            if b.get("tenant_id") != tid:
                continue
            if b.get("rental_status") not in ACTIVE_BOOKING_STATUSES:
                continue
            v = vehicles.get(b.get("vehicle_id") or "") or {}
            plate = (v.get("plate_number") or b.get("vehicle_plate") or "").strip().upper()
            gps_id = (v.get("gps_device_id") or "").strip()
            out.append(
                {
                    "booking_id": b["id"],
                    "client_name": b.get("client_name"),
                    "rental_status": b.get("rental_status"),
                    "driver_mode": b.get("driver_mode"),
                    "vehicle_id": b.get("vehicle_id"),
                    "plate_number": plate or None,
                    "gps_device_id": gps_id or None,
                    "model": v.get("model") or b.get("vehicle_model"),
                    "category": v.get("category") or b.get("vehicle_category"),
                    "start_time": b.get("start_time"),
                    "end_time": b.get("end_time"),
                    "pickup_location": b.get("pickup_location"),
                    "dropoff_location": b.get("dropoff_location"),
                    "label": f"Ενοικίαση · {b.get('client_name') or plate or '—'}",
                }
            )
    return out


def dashboard_summary(tenant_id: str | None) -> dict[str, Any]:
    tid = _normalize_tenant(tenant_id)
    vehicles = list_vehicles(tid)
    bookings = list_bookings(tid)
    available = sum(1 for v in vehicles if v.get("current_status") == "AVAILABLE")
    rented = sum(1 for v in vehicles if v.get("current_status") == "RENTED")
    maintenance = sum(1 for v in vehicles if v.get("current_status") == "MAINTENANCE")
    active = sum(1 for b in bookings if b.get("rental_status") in ACTIVE_BOOKING_STATUSES)
    revenue = sum(float(b.get("total_cost") or 0) for b in bookings if b.get("rental_status") != "CANCELLED")
    return {
        "vehicles_total": len(vehicles),
        "available": available,
        "rented": rented,
        "maintenance": maintenance,
        "active_bookings": active,
        "revenue_eur": round(revenue, 2),
        "service_alerts": [
            {
                "vehicle_id": v["id"],
                "plate_number": v.get("plate_number"),
                "mileage": v.get("current_mileage"),
            }
            for v in vehicles
            if int(v.get("current_mileage") or 0) % SERVICE_MILEAGE_EVERY
            >= SERVICE_MILEAGE_EVERY - 500
        ],
    }
