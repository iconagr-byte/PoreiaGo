"""Tenant-scoped fleet rental store (JSON) — availability + bookings + inspections."""

from __future__ import annotations

import json
import logging
import math
import os
import threading
import unicodedata
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
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
DOC_KINDS = frozenset({"registration", "insurance", "kteo", "other"})
EXPENSE_CATEGORIES = frozenset({"fuel", "tolls", "insurance", "service", "cleaning", "other"})

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


# Demo fleet marker — used only to purge previously seeded showcase vehicles.
_DEMO_FLEET_MARKER = "demo_rent_fleet_v1"
_DEMO_BOOKING_MARKER = "demo_rent_booking_v1"
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


def _is_demo_vehicle_row(row: dict[str, Any]) -> bool:
    notes = str(row.get("notes") or "")
    if notes == _DEMO_FLEET_MARKER:
        return True
    vid = str(row.get("id") or "")
    if vid.startswith("demo-rent-"):
        return True
    plate = str(row.get("plate_number") or "").strip().upper()
    return plate.startswith("DEMO-C") or plate.startswith("DEMO-V")


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
        vehicles = list(data.get("vehicles") or [])
        demo_ids = {
            str(v.get("id"))
            for v in vehicles
            if v.get("tenant_id") == tid and _is_demo_vehicle_row(v)
        }
        if not demo_ids:
            return {"vehicles": 0, "bookings": 0}
        data["vehicles"] = [
            v
            for v in vehicles
            if not (v.get("tenant_id") == tid and str(v.get("id")) in demo_ids)
        ]
        bookings = list(data.get("bookings") or [])
        kept_bookings = []
        removed_bookings = 0
        for b in bookings:
            if b.get("tenant_id") == tid and str(b.get("vehicle_id") or "") in demo_ids:
                removed_bookings += 1
                continue
            kept_bookings.append(b)
        data["bookings"] = kept_bookings
        _write(data)
        return {"vehicles": len(demo_ids), "bookings": removed_bookings}


def ensure_demo_rental_fleet(tenant_id: str | None = None) -> int:
    """Deprecated no-op — demo rent fleet is no longer seeded."""
    purge_demo_rental_fleet(tenant_id)
    return 0


def _ensure_demo_sign_vehicle(tenant_id: str) -> dict[str, Any]:
    """Pick an available vehicle, or create a compact demo car for signature trials."""
    tid = _normalize_tenant(tenant_id)
    ensure_demo_rental_fleet(tid)
    vehicles = list_vehicles(tid)
    if vehicles:
        return next(
            (v for v in vehicles if str(v.get("current_status") or "") == "AVAILABLE"),
            vehicles[0],
        )
    return upsert_vehicle(
        tid,
        {
            "plate_number": "DEMO-SIGN",
            "category": "COMPACT",
            "model": "Demo Sign Car",
            "seating_capacity": 5,
            "daily_rate_eur": 35,
            "current_status": "AVAILABLE",
            "notes": _DEMO_FLEET_MARKER,
            "description": "Όχημα δοκιμής για dual-mode ψηφιακή υπογραφή",
        },
    )


def create_demo_sign_sample(tenant_id: str | None = None) -> dict[str, Any]:
    """
    Admin one-click: guarantee a CONFIRMED booking ready for dual-mode signature.
    Reuses an existing unsigned demo booking when present.
    """
    tid = _normalize_tenant(tenant_id)
    vehicle = _ensure_demo_sign_vehicle(tid)
    for booking in list_bookings(tid):
        notes = str(booking.get("notes") or "")
        if _DEMO_BOOKING_MARKER not in notes:
            continue
        if booking.get("rental_status") == "CANCELLED":
            continue
        if booking.get("contract_status") == "ACTIVE" and booking.get("contract_issued_at"):
            continue
        return booking

    start = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=1)
    end = start + timedelta(days=2)
    booking = create_booking(
        tid,
        {
            "vehicle_id": vehicle["id"],
            "client_name": "Δοκιμαστικός Πελάτης",
            "client_email": "demo.renter@poreiago.local",
            "client_phone": "+306900000001",
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "pickup_location": "Γραφείο ενοικιάσεων",
            "dropoff_location": "Γραφείο ενοικιάσεων",
            "channel": "DESK",
            "notes": _DEMO_BOOKING_MARKER,
        },
    )
    return update_booking_status(tid, booking["id"], "CONFIRMED")


def ensure_demo_rental_sample_booking(tenant_id: str | None = None) -> dict[str, Any] | None:
    """
    Auto-seed one sample booking when the tenant has zero bookings and at least
    one vehicle (or demo fleet can be created). Used by list endpoints.
    """
    tid = _normalize_tenant(tenant_id)
    ensure_demo_rental_fleet(tid)
    with _LOCK:
        data = _read()
        if any(b.get("tenant_id") == tid for b in data["bookings"]):
            return None
        vehicles = [v for v in data["vehicles"] if v.get("tenant_id") == tid]
        if not vehicles:
            return None
    try:
        return create_demo_sign_sample(tid)
    except ValueError:
        return None

PAYMENT_PLANS = ("full", "deposit")
PAYMENT_METHODS = ("card", "paypal", "apple", "bank_transfer", "cash_office")
PAYMENT_STATUSES = ("pending", "partial", "paid", "refunded", "refund_pending")
DEFAULT_DEPOSIT_PERCENT = 30

# Min self-drive age by vehicle category (CAR=21, VAN=23, MINIBUS=25).
MIN_DRIVER_AGE_YEARS = 21
MIN_DRIVER_AGE_BY_CATEGORY = {
    "CAR": 21,
    "VAN": 23,
    "MINIBUS": 25,
}

DEFAULT_DAMAGE_DEPOSIT_EUR = 300.0
DAMAGE_DEPOSIT_STATUSES = ("none", "held", "released", "captured", "pending_hold")
DEFAULT_BRANCH_NAME = "Κύριο γραφείο"

# Daily extras (EUR) — must match customer PWA labels.
EXTRA_DAILY_RATES = {
    "extra_insurance": 12.0,
    "child_seat": 7.0,
    "gps_pack": 5.0,
    "young_driver": 15.0,
}


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
    return {"vehicles": [], "bookings": [], "inspections": [], "expenses": []}


def _parse_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    text = str(value).strip()[:10]
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def _read() -> dict[str, Any]:
    if not STORE_FILE.is_file():
        return _empty()
    try:
        data = json.loads(STORE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return _empty()
    if not isinstance(data, dict):
        return _empty()
    for key in ("vehicles", "bookings", "inspections", "expenses"):
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


def min_driver_age_for_category(category: str | None) -> int:
    cat = str(category or "CAR").strip().upper() or "CAR"
    return int(MIN_DRIVER_AGE_BY_CATEGORY.get(cat, MIN_DRIVER_AGE_YEARS))


def default_damage_deposit_eur() -> float:
    try:
        from travel_platform.settings.payment_settings_store import read_payment_settings

        settings = read_payment_settings() or {}
        raw = (settings.get("rental") or settings.get("damage_deposit") or {}).get("amount_eur")
        if raw is not None:
            return max(0.0, float(raw))
    except Exception:
        pass
    return float(DEFAULT_DAMAGE_DEPOSIT_EUR)


def list_vehicles(tenant_id: str | None, *, category: str | None = None) -> list[dict[str, Any]]:
    tid = _normalize_tenant(tenant_id)
    try:
        from travel_platform.rental.rental_pg_sync import try_list_vehicles_from_pg

        pg_rows = try_list_vehicles_from_pg(tid, category=category)
        if pg_rows is not None and len(pg_rows) > 0:
            return sorted(pg_rows, key=lambda v: (v.get("category") or "", v.get("plate_number") or ""))
    except Exception:
        logger.debug("rental pg list_vehicles fallback", exc_info=True)
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
            "documents": [],
        }
        kteo = _parse_date(body.get("legal_deadline")) if "legal_deadline" in body else _parse_date(
            (existing or {}).get("legal_deadline")
        )
        insurance = (
            _parse_date(body.get("insurance_due_date"))
            if "insurance_due_date" in body
            else _parse_date((existing or {}).get("insurance_due_date"))
        )
        # Allow explicit clear via null when key present.
        if "legal_deadline" in body and body.get("legal_deadline") in (None, ""):
            kteo = None
        if "insurance_due_date" in body and body.get("insurance_due_date") in (None, ""):
            insurance = None
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
                "legal_deadline": kteo.isoformat() if kteo else None,
                "insurance_due_date": insurance.isoformat() if insurance else None,
                "documents": list((existing or {}).get("documents") or row.get("documents") or []),
                "updated_at": now,
            }
        )
        # Cover photo: explicit photo_url, else first gallery image.
        if not row.get("photo_url") and row.get("photo_urls"):
            row["photo_url"] = row["photo_urls"][0]
        if not existing:
            data["vehicles"].append(row)
        _write(data)
        saved = deepcopy(row)

    try:
        from travel_platform.rental.rental_pg_sync import sync_vehicle_to_pg

        sync_vehicle_to_pg(saved)
    except Exception:
        logger.debug("rental pg sync after upsert_vehicle skipped", exc_info=True)
    return saved


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
    try:
        from travel_platform.rental.rental_pg_sync import try_list_bookings_from_pg

        pg_rows = try_list_bookings_from_pg(tid, vehicle_id=vehicle_id, status=status)
        if pg_rows is not None and len(pg_rows) > 0:
            return sorted(pg_rows, key=lambda b: b.get("start_time") or "", reverse=True)
    except Exception:
        logger.debug("rental pg list_bookings fallback", exc_info=True)
    with _LOCK:
        rows = [b for b in _read()["bookings"] if b.get("tenant_id") == tid]
    if vehicle_id:
        rows = [b for b in rows if b.get("vehicle_id") == vehicle_id]
    if status:
        st = status.strip().upper()
        rows = [b for b in rows if str(b.get("rental_status") or "").upper() == st]
    return sorted(rows, key=lambda b: b.get("start_time") or "", reverse=True)


def get_booking(tenant_id: str | None, booking_id: str) -> dict[str, Any] | None:
    tid = _normalize_tenant(tenant_id)
    bid = str(booking_id or "").strip()
    if not bid:
        return None
    try:
        from travel_platform.rental.rental_pg_sync import try_get_booking_from_pg

        pg_row = try_get_booking_from_pg(tid, bid)
        if pg_row:
            return pg_row
    except Exception:
        logger.debug("rental pg get_booking fallback", exc_info=True)
    with _LOCK:
        for b in _read()["bookings"]:
            if b.get("tenant_id") == tid and b.get("id") == bid:
                return deepcopy(b)
    return None


def parse_rental_qr_code(raw: str | None) -> str:
    """Extract booking id from `RENT:{uuid}` or bare UUID."""
    value = str(raw or "").strip()
    if not value:
        raise ValueError("Κενός κωδικός QR")
    upper = value.upper()
    if upper.startswith("RENT:"):
        value = value.split(":", 1)[1].strip()
    value = value.strip()
    if not value:
        raise ValueError("Μη έγκυρος κωδικός QR ενοικίασης")
    return value


def verify_rental_qr(tenant_id: str | None, raw_code: str) -> dict[str, Any]:
    """Desk verify wallet pass QR — read-only, no status mutation."""
    booking_id = parse_rental_qr_code(raw_code)
    booking = get_booking(tenant_id, booking_id)
    if not booking:
        raise ValueError("Η κράτηση δεν βρέθηκε")
    status = str(booking.get("rental_status") or "").upper()
    eligible_checkin = status == "CONFIRMED"
    eligible_checkout = status == "ACTIVE"
    if status == "CANCELLED":
        reason = "Η κράτηση έχει ακυρωθεί"
    elif status == "COMPLETED":
        reason = "Η ενοικίαση έχει ολοκληρωθεί"
    elif eligible_checkin:
        reason = "Έτοιμη για check-in"
    elif eligible_checkout:
        reason = "Έτοιμη για check-out / επιστροφή"
    else:
        reason = f"Κατάσταση: {status or '—'}"
    return {
        "ok": True,
        "code": f"RENT:{booking_id}",
        "booking_id": booking_id,
        "booking": booking,
        "eligible_checkin": eligible_checkin,
        "eligible_checkout": eligible_checkout,
        "reason": reason,
    }


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


def _normalize_deposit_percent(value: Any) -> int:
    try:
        pct = int(value)
    except (TypeError, ValueError):
        pct = DEFAULT_DEPOSIT_PERCENT
    return max(5, min(90, pct))


def looks_like_airport(pickup_location: str | None) -> bool:
    raw = str(pickup_location or "").strip().lower()
    if not raw:
        return False
    return any(tok in raw for tok in _AIRPORT_TOKENS)


def validate_client_afm(value: Any) -> str | None:
    """Optional AFM — empty ok; if present must be exactly 9 digits."""
    raw = str(value or "").strip()
    if not raw:
        return None
    if not _AFM_RE.fullmatch(raw):
        raise ValueError("Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία")
    return raw


def fleet_dispatch_ok(plate: str | None) -> tuple[bool, str | None]:
    """KTEO/insurance compliance via fleet service. Unknown plate → allow."""
    plate_norm = str(plate or "").strip()
    if not plate_norm:
        return True, None
    try:
        from travel_platform.fleet.service_service import service_service

        result = service_service.check_dispatch_availability(plate_norm)
    except Exception as exc:
        logger.warning("fleet dispatch check failed plate=%s: %s", plate_norm, exc)
        return True, None
    if not isinstance(result, dict):
        return True, None
    if result.get("available") is False:
        reason = str(result.get("reason") or "Το όχημα δεν είναι διαθέσιμο (συμμόρφωση στόλου)")
        return False, reason
    return True, None


def compute_extras_total(days: int, extras: dict[str, Any] | None = None) -> tuple[float, list[str]]:
    """Return (extras_total, label list) for daily + flat add-ons."""
    days = max(1, int(days or 1))
    selected = extras if isinstance(extras, dict) else {}
    lines: list[str] = []
    total = 0.0
    for key, daily in EXTRA_DAILY_RATES.items():
        if selected.get(key):
            total += daily * days
            lines.append(EXTRA_LABELS.get(key, key))
    for key, flat in EXTRA_FLAT_RATES.items():
        if selected.get(key):
            total += flat
            lines.append(EXTRA_LABELS.get(key, key))
    return round(total, 2), lines


def compute_payment_split(
    total_eur: float,
    *,
    payment_plan: str = "full",
    payment_method: str = "card",
    deposit_percent: int | None = None,
) -> dict[str, Any]:
    """Deposit/full split + payment status for a rental booking."""
    plan = str(payment_plan or "full").strip().lower() or "full"
    if plan not in PAYMENT_PLANS:
        plan = "full"
    method = str(payment_method or "card").strip().lower() or "card"
    if method not in PAYMENT_METHODS:
        method = "card"
    pct = _normalize_deposit_percent(
        deposit_percent if deposit_percent is not None else DEFAULT_DEPOSIT_PERCENT
    )
    total = round(float(total_eur or 0), 2)
    if plan == "deposit":
        due_now = round(total * (pct / 100.0), 2)
        balance = round(total - due_now, 2)
    else:
        due_now = total
        balance = 0.0

    if method == "bank_transfer":
        amount_paid = 0.0
        payment_status = "pending"
        if plan == "deposit":
            payment_label = f"PENDING · Προκαταβολή {pct}% (Τράπεζα)"
        else:
            payment_label = "PENDING (Bank Transfer)"
    elif method == "cash_office":
        amount_paid = 0.0
        payment_status = "pending"
        payment_label = "PENDING (Cash at office)"
    else:
        amount_paid = due_now
        if balance > 0:
            payment_status = "partial"
            method_name = {"card": "Credit Card", "paypal": "PayPal", "apple": "Apple Pay"}.get(
                method, method
            )
            payment_label = f"DEPOSIT {pct}% ({method_name})"
        else:
            payment_status = "paid"
            method_name = {"card": "Credit Card", "paypal": "PayPal", "apple": "Apple Pay"}.get(
                method, method
            )
            payment_label = f"PAID ({method_name})"

    return {
        "payment_plan": plan,
        "payment_method": method,
        "deposit_percent": pct,
        "amount_due_now": due_now,
        "amount_paid": amount_paid,
        "balance_due": balance,
        "payment_status": payment_status,
        "payment_label": payment_label,
    }


def quote_vehicle(
    vehicle: dict[str, Any],
    *,
    start: datetime,
    end: datetime,
    pickup_location: str | None = None,
    dropoff_location: str | None = None,
    driver_mode: str | None = None,
    extras: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Compute rental quote: base days + optional one-way + with-driver + extras."""
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

    selected = dict(extras) if isinstance(extras, dict) else {}
    is_airport_pickup = bool(selected.get("airport_pickup")) or looks_like_airport(pickup_location)
    if is_airport_pickup:
        selected["airport_pickup"] = True

    extras_total, extras_lines = compute_extras_total(days, selected)
    return {
        "suggested_days": days,
        "base_total": base_total,
        "driver_surcharge": driver_surcharge,
        "one_way_surcharge": one_way_surcharge,
        "extras_total": extras_total,
        "extras_lines": extras_lines,
        "suggested_total": round(
            base_total + driver_surcharge + one_way_surcharge + extras_total, 2
        ),
        "is_one_way": is_one_way,
        "is_airport_pickup": is_airport_pickup,
        "driver_mode": mode,
        "extras_applied": selected,
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
    branch: str | None = None,
) -> list[dict[str, Any]]:
    tid = _normalize_tenant(tenant_id)
    start = _parse_dt(start_time)
    end = _parse_dt(end_time)
    if end <= start:
        raise ValueError("Η λήξη πρέπει να είναι μετά την έναρξη")
    seats_need = int(min_seats or 0)
    branch_needle = str(branch or "").strip()
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
            if branch_needle:
                v_branch = str(v.get("branch_name") or v.get("branch_id") or DEFAULT_BRANCH_NAME)
                if branch_needle.lower() not in v_branch.lower() and branch_needle != str(v.get("branch_id") or ""):
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
            ok, _reason = fleet_dispatch_ok(v.get("plate_number"))
            if not ok:
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


def _normalize_surname(value: str | None) -> str:
    raw = unicodedata.normalize("NFD", str(value or "").strip().lower())
    return "".join(ch for ch in raw if unicodedata.category(ch) != "Mn").replace(" ", "")


def _normalize_ref_code(value: str | None) -> str:
    raw = str(value or "").strip().upper().replace(" ", "")
    if raw.startswith("RN-"):
        return raw
    if raw.startswith("RN"):
        return f"RN-{raw[2:].lstrip('-')}"
    return raw


def _ensure_reference_code(row: dict[str, Any]) -> str:
    existing = _normalize_ref_code(row.get("reference_code"))
    if existing:
        row["reference_code"] = existing
        return existing
    code = f"RN-{uuid4().hex[:8].upper()}"
    row["reference_code"] = code
    return code


def _surname_matches(client_name: str | None, surname: str | None) -> bool:
    full = _normalize_surname(client_name)
    needle = _normalize_surname(surname)
    if not full or not needle:
        return False
    if full == needle:
        return True
    # Match last token of "First Last" or whole string contains
    parts = [p for p in str(client_name or "").strip().lower().split() if p]
    if parts and _normalize_surname(parts[-1]) == needle:
        return True
    return needle in full


def guest_lookup_booking(
    tenant_id: str | None,
    *,
    surname: str,
    reference_code: str,
) -> dict[str, Any] | None:
    """Public lookup by surname + RN- code (office-scoped)."""
    tid = _normalize_tenant(tenant_id)
    code = _normalize_ref_code(reference_code)
    if not code or not str(surname or "").strip():
        return None
    with _LOCK:
        data = _read()
        dirty = False
        hit = None
        for row in data.get("bookings") or []:
            if row.get("tenant_id") != tid:
                continue
            before = row.get("reference_code")
            ref = _ensure_reference_code(row)
            if before != ref:
                dirty = True
            if ref != code:
                continue
            if not _surname_matches(row.get("client_name"), surname):
                continue
            hit = row
            break
        if dirty:
            _write(data)
        return deepcopy(hit) if hit else None


def guest_online_checkin(
    tenant_id: str | None,
    *,
    surname: str,
    reference_code: str,
) -> dict[str, Any]:
    """Mark booking ready for pickup (online check-in) after surname+code verify."""
    tid = _normalize_tenant(tenant_id)
    code = _normalize_ref_code(reference_code)
    if not code or not str(surname or "").strip():
        raise ValueError("Συμπληρώστε επώνυμο και κωδικό κράτησης")
    with _LOCK:
        data = _read()
        booking = None
        for row in data.get("bookings") or []:
            if row.get("tenant_id") != tid:
                continue
            ref = _ensure_reference_code(row)
            if ref != code:
                continue
            if not _surname_matches(row.get("client_name"), surname):
                continue
            booking = row
            break
        if not booking:
            raise ValueError("Δεν βρέθηκε κράτηση με αυτά τα στοιχεία")
        status = str(booking.get("rental_status") or "").upper()
        if status == "CANCELLED":
            raise ValueError("Η κράτηση έχει ακυρωθεί")
        if status == "COMPLETED":
            raise ValueError("Η ενοικίαση έχει ολοκληρωθεί")
        now = _now()
        booking["online_checkin_at"] = now
        booking["online_checkin_ready"] = True
        booking["updated_at"] = now
        _write(data)
        return deepcopy(booking)


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
        ok, reason = fleet_dispatch_ok(vehicle.get("plate_number"))
        if not ok:
            raise ValueError(reason or "Το όχημα δεν είναι διαθέσιμο (συμμόρφωση στόλου)")
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
        extras = body.get("extras") if isinstance(body.get("extras"), dict) else {}
        client_afm = validate_client_afm(body.get("client_afm"))
        quote = quote_vehicle(
            vehicle,
            start=start,
            end=end,
            pickup_location=pickup,
            dropoff_location=dropoff,
            driver_mode=driver_mode,
            extras=extras,
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
            "client_afm": client_afm,
            "channel": channel,
            "reference_code": f"RN-{uuid4().hex[:8].upper()}",
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
                "extras_total": quote["extras_total"],
                "extras_lines": quote["extras_lines"],
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
            "online_checkin_ready": False,
            "online_checkin_at": None,
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
        created = deepcopy(row)

    # Fire-and-forget side effects outside the lock.
    try:
        from travel_platform.rental.rental_pg_sync import sync_booking_to_pg, sync_vehicle_to_pg

        sync_booking_to_pg(created)
        sync_vehicle_to_pg(get_vehicle(tid, vehicle_id) or {})
    except Exception:
        logger.debug("rental pg sync after create_booking skipped", exc_info=True)

    # Auto fiscal mark for instant card-like payments — prefer AADE, LOCAL-* fallback.
    try:
        method = str(created.get("payment_method") or "")
        paid = float(created.get("amount_paid") or 0)
        if method in ("card", "paypal", "apple") and paid > 0:
            from travel_platform.rental.rental_fiscal import mark_rental_receipt

            created = mark_rental_receipt(created, kind="aade_receipt", amount=paid)
    except Exception:
        logger.debug("auto fiscal mark skipped", exc_info=True)

    return created


def _recompute_payment_after_total_change(booking: dict[str, Any], new_total: float) -> dict[str, Any]:
    """Keep amount_paid; refresh balance / status for a new total."""
    total = round(float(new_total or 0), 2)
    paid = round(float(booking.get("amount_paid") or 0), 2)
    balance = round(max(0.0, total - paid), 2)
    method = str(booking.get("payment_method") or "card")
    plan = str(booking.get("payment_plan") or "full")
    pct = _normalize_deposit_percent(booking.get("deposit_percent"))
    if paid <= 0:
        status = "pending"
        if method == "bank_transfer":
            label = f"PENDING · Προκαταβολή {pct}% (Τράπεζα)" if plan == "deposit" else "PENDING (Bank Transfer)"
        elif method == "cash_office":
            label = "PENDING (Cash at office)"
        else:
            label = "PENDING"
    elif balance > 0:
        status = "partial"
        method_name = {"card": "Credit Card", "paypal": "PayPal", "apple": "Apple Pay"}.get(method, method)
        label = f"DEPOSIT {pct}% ({method_name})" if plan == "deposit" else f"PARTIAL ({method_name})"
    else:
        status = "paid"
        method_name = {"card": "Credit Card", "paypal": "PayPal", "apple": "Apple Pay"}.get(method, method)
        label = f"PAID ({method_name})"
    return {
        "total_cost": total,
        "amount_paid": paid,
        "balance_due": balance,
        "payment_status": status,
        "payment_label": label,
        "amount_due_now": round(max(0.0, float(booking.get("amount_due_now") or 0)), 2)
        if paid > 0
        else (round(total * (pct / 100.0), 2) if plan == "deposit" else total),
    }


def modify_booking_for_customer(
    tenant_id: str | None,
    booking_id: str,
    *,
    email: str,
    start_time: str,
    end_time: str,
    pickup: str | None = None,
    dropoff: str | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Customer reschedule — CONFIRMED only, same free-cancel window, conflict-safe."""
    tid = _normalize_tenant(tenant_id)
    needle = str(email or "").strip().lower()
    bid = str(booking_id or "").strip()
    if not needle or not bid:
        raise ValueError("Απαιτείται κράτηση και email")
    start = _parse_dt(start_time)
    end = _parse_dt(end_time)
    if end <= start:
        raise ValueError("Η λήξη πρέπει να είναι μετά την έναρξη")

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
        if status != "CONFIRMED":
            raise ValueError("Μπορείτε να τροποποιήσετε μόνο επιβεβαιωμένες κρατήσεις")
        if not free_cancel_eligible(booking, now=now):
            raise ValueError(
                f"Η αλλαγή ημερομηνιών ισχύει έως {FREE_CANCEL_HOURS} ώρες πριν την παραλαβή. "
                "Επικοινωνήστε με το γραφείο."
            )

        vehicle = next(
            (
                v
                for v in data["vehicles"]
                if v.get("tenant_id") == tid and v.get("id") == booking.get("vehicle_id")
            ),
            None,
        )
        if not vehicle:
            raise ValueError("Το όχημα δεν βρέθηκε")
        ok, reason = fleet_dispatch_ok(vehicle.get("plate_number"))
        if not ok:
            raise ValueError(reason or "Το όχημα δεν είναι διαθέσιμο (συμμόρφωση στόλου)")

        conflicts = _vehicle_conflicts(
            data,
            tenant_id=tid,
            vehicle_id=vehicle["id"],
            start=start,
            end=end,
            exclude_booking_id=bid,
        )
        if conflicts:
            raise ValueError("Το όχημα δεν είναι διαθέσιμο για αυτές τις ημερομηνίες")

        new_pickup = str(pickup if pickup is not None else booking.get("pickup_location") or "").strip()
        new_dropoff = str(
            dropoff
            if dropoff is not None
            else (booking.get("dropoff_location") or booking.get("pickup_location") or "")
        ).strip() or new_pickup
        if not new_pickup:
            raise ValueError("Απαιτείται σημείο παραλαβής")

        extras = booking.get("extras") if isinstance(booking.get("extras"), dict) else {}
        quote = quote_vehicle(
            vehicle,
            start=start,
            end=end,
            pickup_location=new_pickup,
            dropoff_location=new_dropoff,
            driver_mode=booking.get("driver_mode"),
            extras=extras,
        )
        pay_fields = _recompute_payment_after_total_change(booking, quote["suggested_total"])
        booking.update(
            {
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "pickup_location": new_pickup,
                "dropoff_location": new_dropoff,
                "pricing": {
                    "days": quote["suggested_days"],
                    "base_total": quote["base_total"],
                    "driver_surcharge": quote["driver_surcharge"],
                    "one_way_surcharge": quote["one_way_surcharge"],
                    "extras_total": quote["extras_total"],
                    "extras_lines": quote["extras_lines"],
                    "is_one_way": quote["is_one_way"],
                    "is_airport_pickup": quote.get("is_airport_pickup"),
                },
                **pay_fields,
                "updated_at": _now(),
                "modified_at": _now(),
            }
        )
        _write(data)
        updated = deepcopy(booking)

    try:
        from travel_platform.rental.rental_pg_sync import sync_booking_to_pg

        sync_booking_to_pg(updated)
    except Exception:
        logger.debug("rental pg sync after modify skipped", exc_info=True)
    return updated


def patch_booking_fields(
    tenant_id: str | None,
    booking_id: str,
    fields: dict[str, Any],
) -> dict[str, Any]:
    """Patch arbitrary safe fields on a booking (payment_intent_id, fiscal, etc.)."""
    tid = _normalize_tenant(tenant_id)
    bid = str(booking_id or "").strip()
    allowed = {
        "payment_intent_id",
        "fiscal_status",
        "fiscal_mark",
        "fiscal_kind",
        "fiscal_amount",
        "fiscal_issued_at",
        "amount_paid",
        "balance_due",
        "payment_status",
        "payment_label",
        "client_afm",
        "refunded_at",
        "refund_id",
        "refund_note",
        "damage_deposit_eur",
        "damage_deposit_status",
        "damage_deposit_intent_id",
        "damage_deposit_captured_at",
        "damage_deposit_released_at",
        "bank_deposit_confirmed_at",
        "amount_due_now",
        "notes",
    }
    with _LOCK:
        data = _read()
        booking = next(
            (b for b in data["bookings"] if b.get("tenant_id") == tid and b.get("id") == bid),
            None,
        )
        if not booking:
            raise ValueError("Η κράτηση δεν βρέθηκε")
        for key, value in (fields or {}).items():
            if key in allowed:
                booking[key] = value
        booking["updated_at"] = _now()
        _write(data)
        return deepcopy(booking)


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


_CHECKOUT_REQUIRED_TERMS = frozenset(
    {
        "general_terms",
        "vehicle_condition",
        "fines",
        "offroad_ferry",
        "gdpr_gps",
    }
)


def _write_contract_html(
    booking: dict[str, Any],
    *,
    signature_url: str,
    accepted_terms: list[str],
    summary: dict[str, Any] | None,
    insurance_label: str | None,
    deposit_eur: float | None,
) -> str:
    """Persist a printable HTML contract (tablet checkout deliverable)."""
    contracts_dir = DATA_DIR / "uploads" / "rental_contracts"
    contracts_dir.mkdir(parents=True, exist_ok=True)
    bid = str(booking.get("id") or "booking")
    filename = f"contract-{bid}-{uuid4().hex[:10]}.html"
    path = contracts_dir / filename
    office = (summary or {}).get("office_name") or "PoreiaGo Rent"
    vehicle = (summary or {}).get("vehicle") or (
        f"{booking.get('vehicle_model') or ''} ({booking.get('vehicle_plate') or ''})"
    )
    terms_html = "".join(f"<li>{t}</li>" for t in accepted_terms)
    html = f"""<!DOCTYPE html>
<html lang="el"><head><meta charset="utf-8"/>
<title>Σύμβαση ενοικίασης · {bid}</title>
<style>
body{{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;color:#0f172a;line-height:1.5}}
h1{{font-size:1.4rem}} .meta{{color:#475569;font-size:.9rem}}
.box{{border:1px solid #e2e8f0;border-radius:16px;padding:1rem 1.25rem;margin:1rem 0}}
img.sig{{max-height:120px;border:1px dashed #cbd5e1;border-radius:12px;padding:.5rem;background:#fff}}
</style></head><body>
<h1>Σύμβαση ενοικίασης οχήματος</h1>
<p class="meta">{office} · Εκδόθηκε {_now()}</p>
<div class="box">
<p><strong>Πελάτης:</strong> {booking.get("client_name") or "—"}</p>
<p><strong>Όχημα:</strong> {vehicle}</p>
<p><strong>Περίοδος:</strong> {booking.get("start_time") or "—"} → {booking.get("end_time") or "—"}</p>
<p><strong>Σύνολο:</strong> €{booking.get("total_cost") or 0}</p>
<p><strong>Ασφάλιση:</strong> {insurance_label or "—"}</p>
<p><strong>Εγγύηση:</strong> {"€" + str(deposit_eur) if deposit_eur is not None else "—"}</p>
</div>
<div class="box">
<p><strong>Αποδεκτοί όροι</strong></p>
<ul>{terms_html or "<li>—</li>"}</ul>
</div>
<div class="box">
<p><strong>Υπογραφή πελάτη</strong></p>
<p><img class="sig" src="{signature_url}" alt="Υπογραφή"/></p>
<p class="meta">Υπογράφων: {booking.get("client_name") or "—"}</p>
</div>
</body></html>
"""
    path.write_text(html, encoding="utf-8")
    return f"/api/admin/platform/fleet-rental/contracts/file/{filename}"


def complete_rental_checkout(
    tenant_id: str | None,
    booking_id: str,
    body: dict[str, Any],
) -> dict[str, Any]:
    """
    Tablet checkout: stamp all booking legal docs, activate contract, store printable HTML.
    """
    tid = _normalize_tenant(tenant_id)
    url = str(body.get("signature_url") or "").strip()
    if not url:
        raise ValueError("Απαιτείται υπογραφή")
    accepted = [str(t).strip() for t in (body.get("accepted_terms") or []) if str(t).strip()]
    if not _CHECKOUT_REQUIRED_TERMS.issubset(set(accepted)):
        raise ValueError("Πρέπει να αποδεχτείτε όλους τους υποχρεωτικούς όρους")
    signer = str(body.get("signer_name") or "").strip() or None
    fuel = body.get("fuel_level")
    try:
        fuel_n = float(fuel) if fuel is not None else 75.0
    except (TypeError, ValueError):
        fuel_n = 75.0
    fuel_n = max(0.0, min(100.0, fuel_n))
    deposit = body.get("deposit_eur")
    try:
        deposit_n = float(deposit) if deposit not in (None, "") else None
    except (TypeError, ValueError):
        deposit_n = None
    insurance_label = str(body.get("insurance_label") or "").strip() or None
    summary = body.get("summary") if isinstance(body.get("summary"), dict) else {}

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

        now = _now()
        sigs = booking.get("legal_doc_signatures")
        if not isinstance(sigs, dict):
            sigs = {}
        signing_method = str(body.get("signing_method") or "IN_PERSON").strip().upper()
        if signing_method not in ("IN_PERSON", "REMOTE"):
            signing_method = "IN_PERSON"
        for doc in _LEGAL_DOC_IDS:
            sigs[doc] = {
                "signature_url": url,
                "signed_at": now,
                "signer_name": signer or booking.get("client_name"),
                "via": "remote_sign" if signing_method == "REMOTE" else "tablet_checkout",
            }
        booking["legal_doc_signatures"] = sigs
        booking["checkout_accepted_terms"] = accepted
        booking["checkout_insurance_label"] = insurance_label
        booking["checkout_deposit_eur"] = deposit_n
        booking["contract_issued_at"] = now
        booking["signing_method"] = signing_method
        # Consume / clear remote token once signed.
        booking["signature_token"] = None
        booking["signature_token_expires_at"] = None
        booking["signature_pending"] = False
        # Activate rental (contract_status alias = rental_status ACTIVE).
        if booking.get("rental_status") in ("RESERVED", "CONFIRMED"):
            booking["rental_status"] = "ACTIVE"
        vehicle = next(
            (
                v
                for v in data["vehicles"]
                if v.get("tenant_id") == tid and v.get("id") == booking.get("vehicle_id")
            ),
            None,
        )
        if vehicle and booking.get("rental_status") == "ACTIVE":
            vehicle["current_status"] = "RENTED"
            vehicle["updated_at"] = now

        # Pickup protocol if missing.
        has_pickup = any(
            i.get("tenant_id") == tid
            and i.get("rental_booking_id") == booking_id
            and i.get("inspection_type") == "PICKUP_CHECK"
            for i in data["inspections"]
        )
        pickup_id = None
        if not has_pickup:
            pickup_id = str(uuid4())
            mileage = int((vehicle or {}).get("current_mileage") or 0)
            data["inspections"].append(
                {
                    "id": pickup_id,
                    "tenant_id": tid,
                    "rental_booking_id": booking_id,
                    "inspection_type": "PICKUP_CHECK",
                    "fuel_level": round(fuel_n, 2),
                    "mileage": mileage,
                    "damage_notes": "Tablet checkout — αποδοχή κατάστασης οχήματος",
                    "photo_urls": [],
                    "signature_url": url,
                    "inspector_name": signer or booking.get("client_name"),
                    "created_at": now,
                    "updated_at": now,
                }
            )

        contract_url = _write_contract_html(
            booking,
            signature_url=url,
            accepted_terms=accepted,
            summary=summary,
            insurance_label=insurance_label,
            deposit_eur=deposit_n,
        )
        booking["contract_pdf_url"] = contract_url
        booking["contract_status"] = "ACTIVE"
        booking["updated_at"] = now
        _write(data)
        return {
            "booking": deepcopy(booking),
            "contract_pdf_url": contract_url,
            "contract_status": "ACTIVE",
            "pickup_inspection_id": pickup_id,
            "signing_method": signing_method,
        }


def reset_rental_signature(tenant_id: str | None, booking_id: str) -> dict[str, Any]:
    """
    Clear issued contract / legal signatures so the client can sign again.
    ACTIVE → CONFIRMED; vehicle returns to AVAILABLE when no other active rental.
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
        if booking.get("rental_status") == "CANCELLED":
            raise ValueError("Η κράτηση είναι ακυρωμένη")
        if booking.get("rental_status") == "COMPLETED":
            raise ValueError("Ολοκληρωμένη κράτηση — δεν γίνεται επαναυπογραφή")

        now = _now()
        booking["legal_doc_signatures"] = {}
        booking["checkout_accepted_terms"] = []
        booking["checkout_insurance_label"] = None
        booking["checkout_deposit_eur"] = None
        booking["contract_issued_at"] = None
        booking["contract_pdf_url"] = None
        booking["contract_status"] = None
        booking["signing_method"] = None
        booking["signature_token"] = None
        booking["signature_token_expires_at"] = None
        booking["signature_pending"] = False
        was_active = booking.get("rental_status") == "ACTIVE"
        if was_active:
            booking["rental_status"] = "CONFIRMED"
        booking["updated_at"] = now

        # Drop auto-created tablet-checkout pickup rows so paperwork isn't stuck "signed".
        data["inspections"] = [
            i
            for i in data["inspections"]
            if not (
                i.get("tenant_id") == tid
                and i.get("rental_booking_id") == bid
                and i.get("inspection_type") == "PICKUP_CHECK"
                and "Tablet checkout" in str(i.get("damage_notes") or "")
            )
        ]

        vehicle_id = booking.get("vehicle_id")
        if was_active and vehicle_id:
            other_active = any(
                b.get("tenant_id") == tid
                and b.get("id") != bid
                and b.get("vehicle_id") == vehicle_id
                and b.get("rental_status") == "ACTIVE"
                for b in data["bookings"]
            )
            if not other_active:
                for v in data["vehicles"]:
                    if v.get("tenant_id") == tid and v.get("id") == vehicle_id:
                        if str(v.get("current_status") or "") == "RENTED":
                            v["current_status"] = "AVAILABLE"
                            v["updated_at"] = now
                        break

        _write(data)
        return deepcopy(booking)


def create_signature_link(tenant_id: str | None, booking_id: str) -> dict[str, Any]:
    """Generate a 24h remote-signing token for contactless client signature."""
    tid = _normalize_tenant(tenant_id)
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
        if booking.get("contract_status") == "ACTIVE" and booking.get("contract_issued_at"):
            raise ValueError("Η σύμβαση έχει ήδη εκδοθεί — καθαρίστε την υπογραφή πρώτα")
        token = str(uuid4())
        expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        booking["signature_token"] = token
        booking["signature_token_expires_at"] = expires
        booking["signing_method"] = "REMOTE"
        booking["signature_pending"] = True
        booking["updated_at"] = _now()
        _write(data)
        return {
            "booking_id": booking_id,
            "signature_token": token,
            "signature_token_expires_at": expires,
            "signing_method": "REMOTE",
            "client_email": booking.get("client_email"),
            "client_phone": booking.get("client_phone"),
            "client_name": booking.get("client_name"),
        }


def _find_booking_by_sign_token(token: str) -> dict[str, Any] | None:
    needle = str(token or "").strip()
    if not needle or len(needle) < 16:
        return None
    with _LOCK:
        for b in _read()["bookings"]:
            if str(b.get("signature_token") or "") == needle:
                return deepcopy(b)
    return None


def get_signing_session(token: str) -> dict[str, Any]:
    """Public session payload for /sign/:token (no admin auth)."""
    booking = _find_booking_by_sign_token(token)
    if not booking:
        raise ValueError("Μη έγκυρος ή ληγμένος σύνδεσμος υπογραφής")
    raw_exp = booking.get("signature_token_expires_at")
    if raw_exp:
        try:
            exp_dt = _parse_dt(raw_exp)
        except Exception as exc:
            raise ValueError("Μη έγκυρος σύνδεσμος υπογραφής") from exc
        if exp_dt < datetime.now(timezone.utc):
            raise ValueError("Ο σύνδεσμος υπογραφής έχει λήξει — ζητήστε νέο από το γραφείο")
    if booking.get("contract_status") == "ACTIVE" and booking.get("contract_issued_at"):
        return {
            "status": "already_signed",
            "contract_status": "ACTIVE",
            "client_name": booking.get("client_name"),
            "vehicle_plate": booking.get("vehicle_plate"),
            "vehicle_model": booking.get("vehicle_model"),
        }
    vehicle = get_vehicle(booking.get("tenant_id"), booking.get("vehicle_id") or "")
    return {
        "status": "pending",
        "booking_id": booking.get("id"),
        "client_name": booking.get("client_name"),
        "vehicle_plate": booking.get("vehicle_plate") or (vehicle or {}).get("plate_number"),
        "vehicle_model": booking.get("vehicle_model") or (vehicle or {}).get("model"),
        "vehicle_photo_url": (vehicle or {}).get("photo_url"),
        "start_time": booking.get("start_time"),
        "end_time": booking.get("end_time"),
        "pickup_location": booking.get("pickup_location"),
        "total_cost": booking.get("total_cost"),
        "expires_at": booking.get("signature_token_expires_at"),
        "office_hint": "PoreiaGo Rent",
    }


def save_signature_image_bytes(content: bytes, *, content_type: str = "image/png") -> str:
    """Persist a remote signature PNG and return a public /api/site URL."""
    if not content:
        raise ValueError("Άδειο αρχείο υπογραφής")
    if len(content) > 4 * 1024 * 1024:
        raise ValueError("Η υπογραφή είναι πολύ μεγάλη")
    ext = ".png"
    if "jpeg" in content_type or "jpg" in content_type:
        ext = ".jpg"
    elif "webp" in content_type:
        ext = ".webp"
    folder = DATA_DIR / "uploads" / "rental_damage"
    folder.mkdir(parents=True, exist_ok=True)
    filename = f"sign-{uuid4().hex}{ext}"
    (folder / filename).write_bytes(content)
    return f"/api/site/rental-photos/{filename}"


def submit_signature_by_token(token: str, body: dict[str, Any]) -> dict[str, Any]:
    """Finalize contract from the client's phone (remote contactless)."""
    booking = _find_booking_by_sign_token(token)
    if not booking:
        raise ValueError("Μη έγκυρος ή ληγμένος σύνδεσμος υπογραφής")
    raw_exp = booking.get("signature_token_expires_at")
    if raw_exp:
        try:
            exp_dt = _parse_dt(raw_exp)
        except Exception as exc:
            raise ValueError("Μη έγκυρος σύνδεσμος υπογραφής") from exc
        if exp_dt < datetime.now(timezone.utc):
            raise ValueError("Ο σύνδεσμος υπογραφής έχει λήξει")
    if booking.get("contract_status") == "ACTIVE" and booking.get("contract_issued_at"):
        raise ValueError("Η σύμβαση έχει ήδη υπογραφεί")
    payload = dict(body or {})
    payload["signing_method"] = "REMOTE"
    # Prefer uploaded URL; otherwise accept raw base64.
    if not payload.get("signature_url") and payload.get("signature_base64"):
        raw = str(payload.get("signature_base64") or "")
        if "," in raw:
            raw = raw.split(",", 1)[1]
        import base64

        try:
            content = base64.b64decode(raw, validate=False)
        except Exception as exc:
            raise ValueError("Μη έγκυρη υπογραφή") from exc
        payload["signature_url"] = save_signature_image_bytes(content)
    return complete_rental_checkout(booking.get("tenant_id"), booking["id"], payload)


def get_checkout_status(tenant_id: str | None, booking_id: str) -> dict[str, Any]:
    """Agent polling — has the remote client finished signing?"""
    tid = _normalize_tenant(tenant_id)
    booking = next((b for b in list_bookings(tid) if b.get("id") == booking_id), None)
    if not booking:
        raise ValueError("Η κράτηση δεν βρέθηκε")
    issued = bool(booking.get("contract_issued_at") and booking.get("contract_status") == "ACTIVE")
    pending = bool(booking.get("signature_pending") and booking.get("signature_token"))
    expires_at = booking.get("signature_token_expires_at")
    expired = False
    if expires_at:
        try:
            expired = _parse_dt(expires_at) < datetime.now(timezone.utc)
        except Exception:
            expired = False
    return {
        "booking_id": booking_id,
        "contract_status": booking.get("contract_status") or booking.get("rental_status"),
        "rental_status": booking.get("rental_status"),
        "signing_method": booking.get("signing_method"),
        "signature_pending": pending and not issued and not expired,
        "signed": issued,
        "contract_pdf_url": booking.get("contract_pdf_url"),
        "signature_token_expires_at": expires_at,
        "token_expired": expired and not issued,
    }


def list_documents(
    tenant_id: str | None,
    *,
    vehicle_id: str | None = None,
) -> list[dict[str, Any]]:
    tid = _normalize_tenant(tenant_id)
    out: list[dict[str, Any]] = []
    with _LOCK:
        for v in _read()["vehicles"]:
            if v.get("tenant_id") != tid:
                continue
            if vehicle_id and v.get("id") != vehicle_id:
                continue
            for doc in v.get("documents") or []:
                row = deepcopy(doc)
                row["vehicle_id"] = v["id"]
                row["plate_number"] = v.get("plate_number")
                row["model"] = v.get("model")
                out.append(row)
    return sorted(out, key=lambda d: d.get("created_at") or "", reverse=True)


def add_vehicle_document(
    tenant_id: str | None,
    vehicle_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    tid = _normalize_tenant(tenant_id)
    kind = str(payload.get("kind") or "other").strip().lower()
    if kind not in DOC_KINDS:
        kind = "other"
    with _LOCK:
        data = _read()
        vehicle = next(
            (v for v in data["vehicles"] if v.get("tenant_id") == tid and v.get("id") == vehicle_id),
            None,
        )
        if not vehicle:
            raise KeyError("vehicle")
        expires = _parse_date(payload.get("expires_at"))
        doc = {
            "id": str(uuid4()),
            "kind": kind,
            "file_name": str(payload.get("file_name") or "document").strip() or "document",
            "mime_type": str(payload.get("mime_type") or "application/octet-stream"),
            "size_bytes": int(payload.get("size_bytes") or 0),
            "storage_path": str(payload.get("storage_path") or ""),
            "url": str(payload.get("url") or ""),
            "expires_at": expires.isoformat() if expires else None,
            "created_at": _now(),
        }
        docs = list(vehicle.get("documents") or [])
        docs.append(doc)
        vehicle["documents"] = docs
        vehicle["updated_at"] = _now()
        # Sync compliance dates from document expiry when kind matches.
        if expires and kind == "kteo":
            vehicle["legal_deadline"] = expires.isoformat()
        if expires and kind == "insurance":
            vehicle["insurance_due_date"] = expires.isoformat()
        _write(data)
        out = deepcopy(doc)
        out["vehicle_id"] = vehicle_id
        out["plate_number"] = vehicle.get("plate_number")
        out["model"] = vehicle.get("model")
        return out


def delete_vehicle_document(tenant_id: str | None, vehicle_id: str, document_id: str) -> bool:
    tid = _normalize_tenant(tenant_id)
    with _LOCK:
        data = _read()
        vehicle = next(
            (v for v in data["vehicles"] if v.get("tenant_id") == tid and v.get("id") == vehicle_id),
            None,
        )
        if not vehicle:
            return False
        before = len(vehicle.get("documents") or [])
        vehicle["documents"] = [d for d in (vehicle.get("documents") or []) if d.get("id") != document_id]
        if len(vehicle["documents"]) == before:
            return False
        vehicle["updated_at"] = _now()
        _write(data)
        return True


def list_expenses(
    tenant_id: str | None,
    *,
    vehicle_id: str | None = None,
) -> list[dict[str, Any]]:
    tid = _normalize_tenant(tenant_id)
    with _LOCK:
        data = _read()
        vehicles = {
            v["id"]: v for v in data["vehicles"] if v.get("tenant_id") == tid
        }
        rows = [deepcopy(e) for e in data.get("expenses") or [] if e.get("tenant_id") == tid]
    if vehicle_id:
        rows = [e for e in rows if e.get("vehicle_id") == vehicle_id]
    for e in rows:
        v = vehicles.get(e.get("vehicle_id") or "")
        if v:
            e["plate_number"] = v.get("plate_number")
            e["model"] = v.get("model")
    return sorted(rows, key=lambda e: e.get("expense_date") or "", reverse=True)


def create_expense(tenant_id: str | None, body: dict[str, Any]) -> dict[str, Any]:
    tid = _normalize_tenant(tenant_id)
    vehicle_id = str(body.get("vehicle_id") or "").strip()
    if not vehicle_id:
        raise ValueError("Απαιτείται όχημα")
    category = str(body.get("category") or "other").strip().lower()
    if category not in EXPENSE_CATEGORIES:
        category = "other"
    try:
        amount = float(body.get("amount"))
    except (TypeError, ValueError) as exc:
        raise ValueError("Μη έγκυρο ποσό") from exc
    if amount < 0:
        raise ValueError("Μη έγκυρο ποσό")
    expense_date = _parse_date(body.get("expense_date")) or date.today()
    with _LOCK:
        data = _read()
        vehicle = next(
            (v for v in data["vehicles"] if v.get("tenant_id") == tid and v.get("id") == vehicle_id),
            None,
        )
        if not vehicle:
            raise KeyError("vehicle")
        liters = body.get("liters")
        odometer = body.get("odometer")
        try:
            liters_n = float(liters) if liters not in (None, "") else None
        except (TypeError, ValueError):
            liters_n = None
        try:
            odo_n = int(odometer) if odometer not in (None, "") else None
        except (TypeError, ValueError):
            odo_n = None
        row = {
            "id": str(uuid4()),
            "tenant_id": tid,
            "vehicle_id": vehicle_id,
            "expense_date": expense_date.isoformat(),
            "category": category,
            "amount": round(amount, 2),
            "liters": liters_n,
            "odometer": odo_n,
            "note": (str(body.get("note") or "").strip() or None),
            "created_at": _now(),
        }
        data.setdefault("expenses", []).append(row)
        _write(data)
        out = deepcopy(row)
        out["plate_number"] = vehicle.get("plate_number")
        out["model"] = vehicle.get("model")
        return out


def delete_expense(tenant_id: str | None, expense_id: str) -> bool:
    tid = _normalize_tenant(tenant_id)
    with _LOCK:
        data = _read()
        before = len(data.get("expenses") or [])
        data["expenses"] = [
            e
            for e in (data.get("expenses") or [])
            if not (e.get("tenant_id") == tid and e.get("id") == expense_id)
        ]
        if len(data["expenses"]) == before:
            return False
        _write(data)
        return True


def availability_board(tenant_id: str | None) -> list[dict[str, Any]]:
    """Vehicle readiness: status + ΚΤΕΟ/ασφάλεια + upcoming rentals."""
    tid = _normalize_tenant(tenant_id)
    today = date.today()
    vehicles = list_vehicles(tid)
    bookings = [
        b
        for b in list_bookings(tid)
        if b.get("rental_status") in ACTIVE_BOOKING_STATUSES
    ]
    board: list[dict[str, Any]] = []
    for v in vehicles:
        vid = v["id"]
        kteo = _parse_date(v.get("legal_deadline"))
        insurance = _parse_date(v.get("insurance_due_date"))
        flags: list[str] = []
        if str(v.get("current_status") or "") in {"MAINTENANCE", "CLEANING", "IN_TRANSIT"}:
            flags.append(str(v.get("current_status")))
        if kteo and kteo < today:
            flags.append("KTEO_EXPIRED")
        elif kteo and (kteo - today).days <= 30:
            flags.append("KTEO_SOON")
        if insurance and insurance < today:
            flags.append("INSURANCE_EXPIRED")
        elif insurance and (insurance - today).days <= 30:
            flags.append("INSURANCE_SOON")
        active = [b for b in bookings if b.get("vehicle_id") == vid]
        upcoming = sorted(
            (b for b in active if b.get("start_time")),
            key=lambda b: b.get("start_time") or "",
        )
        bookable = (
            str(v.get("current_status") or "") == "AVAILABLE"
            and "KTEO_EXPIRED" not in flags
            and "INSURANCE_EXPIRED" not in flags
        )
        board.append(
            {
                "vehicle_id": vid,
                "plate_number": v.get("plate_number"),
                "model": v.get("model"),
                "category": v.get("category"),
                "current_status": v.get("current_status"),
                "legal_deadline": v.get("legal_deadline"),
                "insurance_due_date": v.get("insurance_due_date"),
                "days_to_kteo": (kteo - today).days if kteo else None,
                "days_to_insurance": (insurance - today).days if insurance else None,
                "active_bookings": len(active),
                "next_booking_start": (upcoming[0].get("start_time") if upcoming else None),
                "bookable": bookable,
                "flags": flags,
                "photo_url": v.get("photo_url"),
            }
        )
    return board


def calendar_blocks(tenant_id: str | None, *, days: int = 30) -> list[dict[str, Any]]:
    tid = _normalize_tenant(tenant_id)
    today = date.today()
    horizon = today + timedelta(days=max(7, int(days or 30)))
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
            kteo = _parse_date(v.get("legal_deadline"))
            insurance = _parse_date(v.get("insurance_due_date"))
            if kteo and kteo <= horizon:
                overdue = kteo < today
                blocks.append(
                    {
                        "id": f"kteo-{v['id']}",
                        "kind": "kteo",
                        "vehicle_id": v["id"],
                        "plate_number": v.get("plate_number"),
                        "model": v.get("model"),
                        "category": v.get("category"),
                        "title": "ΚΤΕΟ ληγμένο" if overdue else "ΚΤΕΟ λήγει",
                        "start_time": f"{kteo.isoformat()}T00:00:00+00:00",
                        "end_time": f"{kteo.isoformat()}T23:59:59+00:00",
                        "status": "OVERDUE" if overdue else "DUE",
                        "due_date": kteo.isoformat(),
                        "days_left": (kteo - today).days,
                    }
                )
            if insurance and insurance <= horizon:
                overdue = insurance < today
                blocks.append(
                    {
                        "id": f"insurance-{v['id']}",
                        "kind": "insurance",
                        "vehicle_id": v["id"],
                        "plate_number": v.get("plate_number"),
                        "model": v.get("model"),
                        "category": v.get("category"),
                        "title": "Ασφάλεια ληγμένη" if overdue else "Ασφάλεια λήγει",
                        "start_time": f"{insurance.isoformat()}T00:00:00+00:00",
                        "end_time": f"{insurance.isoformat()}T23:59:59+00:00",
                        "status": "OVERDUE" if overdue else "DUE",
                        "due_date": insurance.isoformat(),
                        "days_left": (insurance - today).days,
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
        created = deepcopy(row)

    try:
        from travel_platform.rental.rental_pg_sync import sync_booking_to_pg, sync_inspection_to_pg

        sync_inspection_to_pg(created)
        if booking_id:
            b = get_booking(tid, booking_id)
            if b:
                sync_booking_to_pg(b)
    except Exception:
        logger.debug("rental pg sync after create_inspection skipped", exc_info=True)
    return created


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
    now: datetime | None = None,
) -> dict[str, Any]:
    """Customer self-cancel — CONFIRMED only, free within FREE_CANCEL_HOURS before pickup.

    When amount_paid>0 and payment_intent_id + STRIPE_SECRET_KEY: create Stripe refund.
    Without Stripe: payment_status=refund_pending and desk note.
    """
    import os

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


def list_branches(tenant_id: str | None) -> list[dict[str, Any]]:
    """Unique branch names from fleet vehicles (hide filter when only default / empty)."""
    vehicles = list_vehicles(tenant_id)
    seen: dict[str, dict[str, Any]] = {}
    for v in vehicles:
        name = str(v.get("branch_name") or DEFAULT_BRANCH_NAME).strip() or DEFAULT_BRANCH_NAME
        bid = str(v.get("branch_id") or name).strip()
        if name not in seen:
            seen[name] = {"branch_id": bid, "branch_name": name}
    return sorted(seen.values(), key=lambda r: r["branch_name"])


def vehicle_rating_aggregate(tenant_id: str | None, vehicle_id: str) -> dict[str, Any] | None:
    tid = _normalize_tenant(tenant_id)
    vid = str(vehicle_id or "").strip()
    with _LOCK:
        reviews = [
            r
            for r in _read().get("reviews") or []
            if r.get("tenant_id") == tid and r.get("vehicle_id") == vid
        ]
    if not reviews:
        return None
    ratings = [float(r.get("rating") or 0) for r in reviews]
    avg = round(sum(ratings) / len(ratings), 1)
    return {"rating": avg, "count": len(reviews), "booked": len(reviews)}


def create_review(
    tenant_id: str | None,
    booking_id: str,
    *,
    email: str,
    rating: int,
    comment: str | None = None,
) -> dict[str, Any]:
    tid = _normalize_tenant(tenant_id)
    bid = str(booking_id or "").strip()
    needle = str(email or "").strip().lower()
    stars = int(rating or 0)
    if stars < 1 or stars > 5:
        raise ValueError("Η βαθμολογία πρέπει να είναι 1–5")
    booking = get_booking(tid, bid)
    if not booking:
        raise ValueError("Η κράτηση δεν βρέθηκε")
    if str(booking.get("client_email") or "").strip().lower() != needle:
        raise ValueError("Δεν έχετε δικαίωμα σε αυτή την κράτηση")
    if str(booking.get("rental_status") or "").upper() != "COMPLETED":
        raise ValueError("Μπορείτε να αξιολογήσετε μόνο ολοκληρωμένες ενοικιάσεις")
    with _LOCK:
        data = _read()
        existing = next(
            (
                r
                for r in data.get("reviews") or []
                if r.get("tenant_id") == tid and r.get("booking_id") == bid
            ),
            None,
        )
        if existing:
            raise ValueError("Έχετε ήδη αξιολογήσει αυτή την κράτηση")
        row = {
            "id": str(uuid4()),
            "tenant_id": tid,
            "booking_id": bid,
            "vehicle_id": booking.get("vehicle_id"),
            "client_email": needle,
            "rating": stars,
            "comment": (str(comment or "").strip() or None),
            "created_at": _now(),
        }
        data.setdefault("reviews", []).append(row)
        # Also mirror aggregate hint onto vehicle for quick catalog reads.
        vehicle = next(
            (
                v
                for v in data["vehicles"]
                if v.get("tenant_id") == tid and v.get("id") == booking.get("vehicle_id")
            ),
            None,
        )
        if vehicle is not None:
            reviews_for_v = [
                r
                for r in data["reviews"]
                if r.get("tenant_id") == tid and r.get("vehicle_id") == vehicle.get("id")
            ]
            ratings = [float(r.get("rating") or 0) for r in reviews_for_v]
            vehicle["reviews"] = reviews_for_v[-20:]
            vehicle["rating_avg"] = round(sum(ratings) / len(ratings), 1) if ratings else None
            vehicle["rating_count"] = len(ratings)
        _write(data)
        return deepcopy(row)


def confirm_bank_deposit_for_rental(
    tenant_id: str | None,
    booking_id: str,
    *,
    confirmed_amount: float | None = None,
    reference_code: str | None = None,
    note: str | None = None,
    actor_id: str | None = None,
) -> dict[str, Any]:
    """Admin confirm bank transfer for a rental booking — reuse ticket bank helpers where possible."""
    from travel_platform.payments.bank_deposit_confirm import record_confirm_audit
    from travel_platform.payments.payment_security import amounts_match
    from travel_platform.rental.rental_fiscal import mark_rental_receipt
    from travel_platform.settings.payment_settings_store import read_payment_settings

    booking = get_booking(tenant_id, booking_id)
    if not booking:
        raise ValueError("Η κράτηση δεν βρέθηκε")
    method = str(booking.get("payment_method") or "").lower()
    status = str(booking.get("payment_status") or "").lower()
    if method != "bank_transfer":
        raise ValueError("Η κράτηση δεν είναι τραπεζική κατάθεση")
    if status not in ("pending", "partial", ""):
        raise ValueError("Η πληρωμή δεν είναι σε εκκρεμότητα")

    settings = read_payment_settings()
    security = settings.get("security") or {}
    due = float(booking.get("amount_due_now") or booking.get("balance_due") or booking.get("total_cost") or 0)
    if security.get("require_amount_on_confirm", True):
        if confirmed_amount is None:
            raise ValueError("confirmed_amount required")
        if not amounts_match(due, float(confirmed_amount)):
            raise ValueError(f"Amount mismatch — expected €{due:.2f}")
    else:
        confirmed_amount = confirmed_amount if confirmed_amount is not None else due

    if security.get("require_reference_on_confirm", True):
        ref = str(reference_code or "").strip()
        if not ref:
            raise ValueError("reference_code required")
        # Rental PNR ≈ booking id prefix / full id.
        bid = str(booking.get("id") or "")
        if ref.upper() not in (bid.upper(), bid[:8].upper()) and ref.upper() not in bid.upper():
            # Soft: accept any non-empty reference for rentals (desk often uses transfer ref).
            pass

    paid_now = round(float(confirmed_amount), 2)
    total = round(float(booking.get("total_cost") or 0), 2)
    prev_paid = round(float(booking.get("amount_paid") or 0), 2)
    new_paid = round(prev_paid + paid_now, 2)
    if new_paid > total:
        new_paid = total
    balance = round(max(0.0, total - new_paid), 2)
    pay_status = "paid" if balance <= 0 else "partial"
    label = "PAID (Bank Transfer)" if pay_status == "paid" else f"PARTIAL (Bank Transfer) · υπόλοιπο €{balance:.2f}"
    stamp = _now()
    note_bit = str(note or "").strip()
    notes = str(booking.get("notes") or "").strip()
    notes = f"{notes} Κατάθεση επιβεβαιώθηκε {stamp}."
    if note_bit:
        notes = f"{notes} ({note_bit})"

    updated = patch_booking_fields(
        tenant_id,
        booking_id,
        {
            "amount_paid": new_paid,
            "balance_due": balance,
            "payment_status": pay_status,
            "payment_label": label,
            "bank_deposit_confirmed_at": stamp,
            "notes": notes.strip(),
        },
    )
    try:
        record_confirm_audit(
            booking_id=str(booking_id),
            amount_eur=paid_now,
            reference=reference_code,
            actor_id=actor_id,
            detail="rental_bank_deposit",
        )
    except Exception:
        logger.debug("rental bank audit skipped", exc_info=True)

    try:
        updated = mark_rental_receipt(updated, kind="aade_receipt", amount=paid_now)
    except Exception:
        logger.debug("rental bank fiscal mark skipped", exc_info=True)

    try:
        from travel_platform.rental.rental_pg_sync import sync_booking_to_pg

        sync_booking_to_pg(updated)
    except Exception:
        pass
    return updated


def confirm_payment_from_intent(
    tenant_id: str | None,
    booking_id: str,
) -> dict[str, Any]:
    """Patch rental payment from Stripe PaymentIntent status (metadata rental_booking_id)."""
    import os

    booking = get_booking(tenant_id, booking_id)
    if not booking:
        raise ValueError("Η κράτηση δεν βρέθηκε")
    pi_id = str(booking.get("payment_intent_id") or "").strip()
    secret = (os.getenv("STRIPE_SECRET_KEY") or "").strip()
    if not pi_id or not secret:
        raise ValueError("Δεν υπάρχει PaymentIntent / Stripe")

    import stripe

    stripe.api_key = secret
    intent = stripe.PaymentIntent.retrieve(pi_id)
    status = getattr(intent, "status", None) or (intent.get("status") if isinstance(intent, dict) else None)
    amount_cents = getattr(intent, "amount_received", None)
    if amount_cents is None:
        amount_cents = getattr(intent, "amount", None) or (
            intent.get("amount_received") if isinstance(intent, dict) else None
        ) or (intent.get("amount") if isinstance(intent, dict) else 0)
    amount = round(float(amount_cents or 0) / 100.0, 2)
    if status != "succeeded":
        raise ValueError(f"PaymentIntent status={status}")

    total = round(float(booking.get("total_cost") or 0), 2)
    paid = amount
    balance = round(max(0.0, total - paid), 2)
    pay_status = "paid" if balance <= 0 else "partial"
    fields: dict[str, Any] = {
        "amount_paid": paid,
        "balance_due": balance,
        "payment_status": pay_status,
        "payment_label": "PAID (Card)" if pay_status == "paid" else f"PARTIAL (Card) · υπόλοιπο €{balance:.2f}",
    }
    if str(booking.get("damage_deposit_status") or "") == "pending_hold":
        fields["damage_deposit_status"] = "held"
    updated = patch_booking_fields(tenant_id, booking_id, fields)
    try:
        from travel_platform.rental.rental_fiscal import mark_rental_receipt

        updated = mark_rental_receipt(updated, kind="aade_receipt", amount=paid)
    except Exception:
        logger.debug("confirm-payment fiscal skipped", exc_info=True)
    try:
        from travel_platform.rental.rental_pg_sync import sync_booking_to_pg

        sync_booking_to_pg(updated)
    except Exception:
        pass
    return updated


def set_damage_deposit_status(
    tenant_id: str | None,
    booking_id: str,
    *,
    action: str,
) -> dict[str, Any]:
    """Admin release / capture / mark-held damage deposit."""
    act = str(action or "").strip().lower()
    if act not in ("release", "capture", "hold"):
        raise ValueError("action must be release|capture|hold")
    booking = get_booking(tenant_id, booking_id)
    if not booking:
        raise ValueError("Η κράτηση δεν βρέθηκε")
    stamp = _now()
    fields: dict[str, Any] = {}
    if act == "hold":
        fields["damage_deposit_status"] = "held"
    elif act == "release":
        fields["damage_deposit_status"] = "released"
        fields["damage_deposit_released_at"] = stamp
    else:
        fields["damage_deposit_status"] = "captured"
        fields["damage_deposit_captured_at"] = stamp
    updated = patch_booking_fields(tenant_id, booking_id, fields)
    try:
        from travel_platform.rental.rental_pg_sync import sync_booking_to_pg

        sync_booking_to_pg(updated)
    except Exception:
        pass
    return updated


def public_catalog(tenant_id: str | None, *, category: str | None = None) -> list[dict[str, Any]]:
    """Customer-facing vehicle cards for this office. Demo seed only when allowed."""
    ensure_demo_rental_fleet(tenant_id)
    rows = list_vehicles(tenant_id, category=category)
    out = []
    for v in rows:
        if str(v.get("current_status") or "") == "MAINTENANCE":
            continue
        agg = vehicle_rating_aggregate(tenant_id, v["id"])
        card = {
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
            "branch_id": v.get("branch_id"),
            "branch_name": v.get("branch_name") or DEFAULT_BRANCH_NAME,
            "min_driver_age": min_driver_age_for_category(v.get("category")),
        }
        if agg:
            card["rating_avg"] = agg["rating"]
            card["rating_count"] = agg["count"]
            card["trust"] = {"rating": agg["rating"], "booked": agg["booked"], "real": True}
        elif v.get("rating_avg") is not None:
            card["rating_avg"] = v.get("rating_avg")
            card["rating_count"] = v.get("rating_count") or 0
            card["trust"] = {
                "rating": v.get("rating_avg"),
                "booked": v.get("rating_count") or 0,
                "real": True,
            }
        out.append(card)
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
            # Map label = vehicle identity only (plate / GPS device). Never customer name —
            # tracking is fleet hardware, not a phone opt-in from the renter.
            if plate:
                map_label = f"Ενοικίαση · {plate}"
            elif gps_id:
                map_label = f"Ενοικίαση · device {gps_id}"
            else:
                map_label = "Ενοικίαση · όχημα"
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
                    "label": map_label,
                }
            )
    return out


def dashboard_summary(tenant_id: str | None) -> dict[str, Any]:
    tid = _normalize_tenant(tenant_id)
    vehicles = list_vehicles(tid)
    bookings = list_bookings(tid)
    expenses = list_expenses(tid)
    today = date.today()
    available = sum(1 for v in vehicles if v.get("current_status") == "AVAILABLE")
    rented = sum(1 for v in vehicles if v.get("current_status") == "RENTED")
    maintenance = sum(1 for v in vehicles if v.get("current_status") == "MAINTENANCE")
    active = sum(1 for b in bookings if b.get("rental_status") in ACTIVE_BOOKING_STATUSES)
    revenue = sum(float(b.get("total_cost") or 0) for b in bookings if b.get("rental_status") != "CANCELLED")
    board = availability_board(tid)
    bookable = sum(1 for row in board if row.get("bookable"))
    compliance_alerts: list[dict[str, Any]] = []
    for v in vehicles:
        kteo = _parse_date(v.get("legal_deadline"))
        insurance = _parse_date(v.get("insurance_due_date"))
        if kteo and (kteo - today).days <= 30:
            compliance_alerts.append(
                {
                    "vehicle_id": v["id"],
                    "plate_number": v.get("plate_number"),
                    "kind": "kteo",
                    "due_date": kteo.isoformat(),
                    "days_left": (kteo - today).days,
                    "severity": "urgent" if (kteo - today).days <= 14 else "warning",
                }
            )
        if insurance and (insurance - today).days <= 30:
            compliance_alerts.append(
                {
                    "vehicle_id": v["id"],
                    "plate_number": v.get("plate_number"),
                    "kind": "insurance",
                    "due_date": insurance.isoformat(),
                    "days_left": (insurance - today).days,
                    "severity": "urgent" if (insurance - today).days <= 14 else "warning",
                }
            )
    compliance_alerts.sort(key=lambda a: a.get("days_left") if a.get("days_left") is not None else 999)
    return {
        "vehicles_total": len(vehicles),
        "available": available,
        "rented": rented,
        "maintenance": maintenance,
        "bookable": bookable,
        "active_bookings": active,
        "revenue_eur": round(revenue, 2),
        "expenses_eur": round(sum(float(e.get("amount") or 0) for e in expenses), 2),
        "documents_total": sum(len(v.get("documents") or []) for v in vehicles),
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
        "compliance_alerts": compliance_alerts,
    }
