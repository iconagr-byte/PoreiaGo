"""Tenant-scoped fleet rental store (JSON) — availability + bookings + inspections."""

from __future__ import annotations

import json
import math
import threading
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from travel_platform.settings.drivers_store import DEMO_TENANT_ID

DATA_DIR = Path(__file__).resolve().parent
STORE_FILE = DATA_DIR / "rental_store.json"
_LOCK = threading.RLock()

VEHICLE_CATEGORIES = ("CAR", "VAN", "MINIBUS")
VEHICLE_STATUSES = ("AVAILABLE", "RENTED", "MAINTENANCE", "IN_TRANSIT")
BOOKING_STATUSES = ("CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED")
ACTIVE_BOOKING_STATUSES = frozenset({"CONFIRMED", "ACTIVE"})
INSPECTION_TYPES = ("PICKUP_CHECK", "RETURN_CHECK")
SERVICE_MILEAGE_EVERY = 15_000

PAYMENT_PLANS = ("full", "deposit")
PAYMENT_METHODS = ("card", "paypal", "apple", "bank_transfer", "cash_office")
PAYMENT_STATUSES = ("pending", "partial", "paid")
DEFAULT_DEPOSIT_PERCENT = 30

# Daily extras (EUR) — must match customer PWA labels.
EXTRA_DAILY_RATES = {
    "extra_insurance": 12.0,
    "child_seat": 7.0,
    "gps_pack": 5.0,
}

ID_VERIFICATION_STATUSES = ("pending", "verified", "rejected", "not_required")
MIN_DRIVER_AGE_YEARS = 21
ID_DOC_URL_PREFIX = "/api/site/rental-id/"


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
        rows = [v for v in _read()["vehicles"] if v.get("tenant_id") == tid]
    if category:
        cat = category.strip().upper()
        rows = [v for v in rows if str(v.get("category") or "").upper() == cat]
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
    category = str(body.get("category") or "CAR").strip().upper()
    model = str(body.get("model") or "").strip()
    if not plate or not model:
        raise ValueError("Απαιτούνται πινακίδα και μοντέλο")
    if category not in VEHICLE_CATEGORIES:
        raise ValueError("Μη έγκυρη κατηγορία")
    seats = int(body.get("seating_capacity") or 5)
    if seats < 2 or seats > 80:
        raise ValueError("Μη έγκυρη χωρητικότητα")
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


def _normalize_deposit_percent(value: Any) -> int:
    try:
        pct = int(value)
    except (TypeError, ValueError):
        pct = DEFAULT_DEPOSIT_PERCENT
    return max(5, min(90, pct))


def compute_extras_total(days: int, extras: dict[str, Any] | None = None) -> tuple[float, list[str]]:
    """Return (extras_total, label list) for selected daily add-ons."""
    days = max(1, int(days or 1))
    selected = extras if isinstance(extras, dict) else {}
    lines: list[str] = []
    total = 0.0
    labels = {
        "extra_insurance": "Extra insurance",
        "child_seat": "Child seat",
        "gps_pack": "GPS pack",
    }
    for key, daily in EXTRA_DAILY_RATES.items():
        if selected.get(key):
            total += daily * days
            lines.append(labels.get(key, key))
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

def _parse_date_only(value: str | None) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        if "T" in raw:
            return _parse_dt(raw)
        return datetime.fromisoformat(raw).replace(tzinfo=timezone.utc)
    except ValueError as exc:
        raise ValueError("Μη έγκυρη ημερομηνία") from exc


def _age_years(dob: datetime, *, on: datetime | None = None) -> int:
    ref = on or datetime.now(timezone.utc)
    years = ref.year - dob.year
    if (ref.month, ref.day) < (dob.month, dob.day):
        years -= 1
    return years


def _safe_doc_url(value: Any) -> str | None:
    url = str(value or "").strip()
    if not url:
        return None
    if url.startswith(ID_DOC_URL_PREFIX) and ".." not in url and " " not in url:
        return url
    raise ValueError("Μη έγκυρο αρχείο ταυτότητας/διπλώματος")


def validate_renter_identity(
    body: dict[str, Any],
    *,
    driver_mode: str,
    channel: str,
    rental_end: datetime,
) -> dict[str, Any]:
    """Validate ID/license for wallet self-drive (and optional desk docs)."""
    mode = str(driver_mode or "SELF_DRIVE").upper()
    ch = str(channel or "DESK").upper()
    require_docs = ch == "WALLET" and mode == "SELF_DRIVE"

    id_url = None
    license_url = None
    raw_id = body.get("id_document_url")
    raw_lic = body.get("driving_license_url")
    if raw_id:
        id_url = _safe_doc_url(raw_id)
    if raw_lic:
        license_url = _safe_doc_url(raw_lic)

    dob_raw = str(body.get("date_of_birth") or "").strip() or None
    license_number = str(body.get("license_number") or "").strip() or None
    license_expires_raw = str(body.get("license_expires_at") or "").strip() or None

    if require_docs:
        if not id_url:
            raise ValueError("Απαιτείται φωτογραφία ταυτότητας ή διαβατηρίου")
        if not license_url:
            raise ValueError("Απαιτείται φωτογραφία διπλώματος οδήγησης")
        if not dob_raw:
            raise ValueError("Απαιτείται ημερομηνία γέννησης")
        if not license_number:
            raise ValueError("Απαιτείται αριθμός διπλώματος")
        if not license_expires_raw:
            raise ValueError("Απαιτείται ημερομηνία λήξης διπλώματος")

    dob = _parse_date_only(dob_raw) if dob_raw else None
    license_expires = _parse_date_only(license_expires_raw) if license_expires_raw else None

    if dob is not None:
        age = _age_years(dob)
        if age < MIN_DRIVER_AGE_YEARS and mode == "SELF_DRIVE":
            raise ValueError(f"Ελάχιστη ηλικία οδηγού: {MIN_DRIVER_AGE_YEARS} ετών")

    if license_expires is not None and license_expires.date() < rental_end.date():
        raise ValueError("Το δίπλωμα λήγει πριν το τέλος της ενοικίασης")

    if id_url or license_url:
        status = "pending"
    elif require_docs:
        status = "pending"
    elif mode == "WITH_DRIVER":
        status = "not_required"
    else:
        status = "not_required"

    return {
        "id_document_url": id_url,
        "driving_license_url": license_url,
        "date_of_birth": dob.date().isoformat() if dob else None,
        "license_number": license_number,
        "license_expires_at": license_expires.date().isoformat() if license_expires else None,
        "id_verification_status": status,
    }


def update_id_verification(
    tenant_id: str | None,
    booking_id: str,
    status: str,
) -> dict[str, Any]:
    tid = _normalize_tenant(tenant_id)
    st = str(status or "").strip().lower()
    if st not in ("pending", "verified", "rejected"):
        raise ValueError("Μη έγκυρη κατάσταση επαλήθευσης")
    bid = str(booking_id or "").strip()
    with _LOCK:
        data = _read()
        booking = next(
            (b for b in data["bookings"] if b.get("tenant_id") == tid and b.get("id") == bid),
            None,
        )
        if not booking:
            raise ValueError("Η κράτηση δεν βρέθηκε")
        booking["id_verification_status"] = st
        booking["updated_at"] = _now()
        _write(data)
        return deepcopy(booking)


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
    extras_total, extras_lines = compute_extras_total(days, extras)
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
        extras = body.get("extras") if isinstance(body.get("extras"), dict) else {}
        quote = quote_vehicle(
            vehicle,
            start=start,
            end=end,
            pickup_location=pickup,
            dropoff_location=dropoff,
            driver_mode=driver_mode,
            extras=extras,
        )
        total = body.get("total_cost")
        if total is None:
            total = quote["suggested_total"]
        else:
            total = round(float(total), 2)

        channel = str(body.get("channel") or "DESK").strip().upper() or "DESK"
        if channel not in ("DESK", "WALLET"):
            channel = "DESK"

        identity = validate_renter_identity(
            body,
            driver_mode=driver_mode,
            channel=channel,
            rental_end=end,
        )

        has_payment_input = (
            body.get("payment_plan") is not None
            or body.get("payment_method") is not None
            or body.get("deposit_percent") is not None
            or channel == "WALLET"
        )

        deposit_percent = body.get("deposit_percent")
        if deposit_percent is None and has_payment_input:
            try:
                from travel_platform.settings.payment_settings_store import read_payment_settings

                deposit_percent = (read_payment_settings().get("deposit") or {}).get("percent")
            except Exception:
                deposit_percent = DEFAULT_DEPOSIT_PERCENT

        if has_payment_input:
            pay = compute_payment_split(
                total,
                payment_plan=str(body.get("payment_plan") or "full"),
                payment_method=str(body.get("payment_method") or "card"),
                deposit_percent=deposit_percent,
            )
        else:
            # Legacy desk bookings without payment UI — treat as settled at counter.
            pay = {
                "payment_plan": "full",
                "payment_method": "cash_office",
                "deposit_percent": DEFAULT_DEPOSIT_PERCENT,
                "amount_due_now": total,
                "amount_paid": total,
                "balance_due": 0.0,
                "payment_status": "paid",
                "payment_label": "PAID (Cash at office)",
            }

        notes = str(body.get("notes") or "").strip() or None
        if quote["extras_lines"] and not notes:
            notes = f"Extras: {', '.join(quote['extras_lines'])}"

        now = _now()
        row = {
            "id": str(uuid4()),
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
                "extras_total": quote["extras_total"],
                "extras_lines": quote["extras_lines"],
                "is_one_way": quote["is_one_way"],
            },
            "payment_plan": pay["payment_plan"],
            "payment_method": pay["payment_method"],
            "deposit_percent": pay["deposit_percent"],
            "amount_due_now": pay["amount_due_now"],
            "amount_paid": pay["amount_paid"],
            "balance_due": pay["balance_due"],
            "payment_status": pay["payment_status"],
            "payment_label": pay["payment_label"],
            "rental_status": "CONFIRMED",
            "driver_mode": driver_mode,
            "assigned_driver_id": (str(body.get("assigned_driver_id") or "").strip() or None),
            "notes": notes,
            "id_document_url": identity["id_document_url"],
            "driving_license_url": identity["driving_license_url"],
            "date_of_birth": identity["date_of_birth"],
            "license_number": identity["license_number"],
            "license_expires_at": identity["license_expires_at"],
            "id_verification_status": identity["id_verification_status"],
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
    if itype not in INSPECTION_TYPES:
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
        if itype == "PICKUP_CHECK" and booking.get("rental_status") == "CONFIRMED":
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
        if status != "CONFIRMED":
            raise ValueError("Μπορείτε να ακυρώσετε μόνο επιβεβαιωμένες κρατήσεις (όχι ενεργές)")
    return update_booking_status(tid, bid, "CANCELLED")


def public_catalog(tenant_id: str | None, *, category: str | None = None) -> list[dict[str, Any]]:
    """Customer-facing vehicle cards (no internal notes)."""
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
