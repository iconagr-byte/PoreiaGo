"""Tenant-scoped fleet rental store (JSON) — availability + bookings + inspections."""

from __future__ import annotations

import json
import logging
import math
import re
import threading
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from travel_platform.settings.drivers_store import DEMO_TENANT_ID

logger = logging.getLogger(__name__)

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
    "extra_insurance": 12.0,  # CDW
    "scdw": 8.0,  # Super CDW — reduces franchise
    "child_seat": 7.0,
    "gps_pack": 5.0,
    "young_driver": 15.0,
}

# Flat (one-time) extras — not multiplied by days.
EXTRA_FLAT_RATES = {
    "airport_pickup": 25.0,
}

EXTRA_LABELS = {
    "extra_insurance": "CDW / επιπλέον ασφάλεια",
    "scdw": "SCDW (μηδενική απαλλαγή)",
    "child_seat": "Child seat",
    "gps_pack": "GPS pack",
    "young_driver": "Young driver (<25)",
    "airport_pickup": "Airport pickup",
}

PICKUP_CHECKLIST_REQUIRED = (
    "tires_ok",
    "lights_ok",
    "fluids_ok",
    "documents_ok",
    "spare_wheel_ok",
)

_AIRPORT_TOKENS = ("αεροδρ", "airport", "ath", "skb")

ID_VERIFICATION_STATUSES = ("pending", "verified", "rejected", "not_required")
ID_DOC_URL_PREFIX = "/api/site/rental-id/"

FREE_CANCEL_HOURS = 24
CONTRACT_VERSION = "rent-contract-v1"
CONTRACT_SIGNATURE_URL_PREFIX = "/api/site/rental-photos/"
_AFM_RE = re.compile(r"^\d{9}$")


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
    return {"vehicles": [], "bookings": [], "inspections": [], "reviews": []}


def _read() -> dict[str, Any]:
    if not STORE_FILE.is_file():
        return _empty()
    try:
        data = json.loads(STORE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return _empty()
    if not isinstance(data, dict):
        return _empty()
    for key in ("vehicles", "bookings", "inspections", "reviews"):
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
                "branch_id": (str(body.get("branch_id") or "").strip() or None),
                "branch_name": (
                    str(body.get("branch_name") or "").strip()
                    or (existing.get("branch_name") if existing else None)
                    or DEFAULT_BRANCH_NAME
                ),
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
    vehicle_category: str | None = None,
) -> dict[str, Any]:
    """Validate ID/license for wallet self-drive (and optional desk docs)."""
    mode = str(driver_mode or "SELF_DRIVE").upper()
    ch = str(channel or "DESK").upper()
    require_docs = ch == "WALLET" and mode == "SELF_DRIVE"
    min_age = min_driver_age_for_category(vehicle_category)

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
        if age < min_age and mode == "SELF_DRIVE":
            raise ValueError(f"Ελάχιστη ηλικία οδηγού: {min_age} ετών ({str(vehicle_category or 'CAR').upper()})")

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
        "min_driver_age": min_age,
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


def hours_until_start(start_time: str | datetime, *, now: datetime | None = None) -> float:
    start = _parse_dt(start_time)
    ref = now or datetime.now(timezone.utc)
    return (start - ref).total_seconds() / 3600.0


def free_cancel_eligible(booking: dict[str, Any], *, now: datetime | None = None) -> bool:
    """True when customer may cancel for free (≥ FREE_CANCEL_HOURS before pickup)."""
    status = str(booking.get("rental_status") or "").upper()
    if status != "CONFIRMED":
        return False
    return hours_until_start(booking.get("start_time") or "", now=now) >= FREE_CANCEL_HOURS


def _safe_contract_signature_url(value: Any) -> str | None:
    url = str(value or "").strip()
    if not url:
        return None
    if url.startswith(CONTRACT_SIGNATURE_URL_PREFIX) and ".." not in url and " " not in url:
        return url
    raise ValueError("Μη έγκυρη υπογραφή σύμβασης")


def validate_contract_acceptance(
    body: dict[str, Any],
    *,
    channel: str,
    client_name: str,
) -> dict[str, Any]:
    """Wallet bookings must accept terms + provide signature URL."""
    ch = str(channel or "DESK").upper()
    accepted = bool(body.get("contract_accepted"))
    signature_url = _safe_contract_signature_url(body.get("contract_signature_url"))
    signer = str(body.get("contract_signer_name") or client_name or "").strip() or None
    version = str(body.get("contract_version") or CONTRACT_VERSION).strip() or CONTRACT_VERSION

    if ch == "WALLET":
        if not accepted:
            raise ValueError("Απαιτείται αποδοχή όρων μίσθωσης")
        if not signature_url:
            raise ValueError("Απαιτείται υπογραφή σύμβασης")
        return {
            "contract_version": version,
            "contract_accepted": True,
            "contract_accepted_at": _now(),
            "contract_signature_url": signature_url,
            "contract_signer_name": signer,
        }

    if accepted or signature_url:
        return {
            "contract_version": version,
            "contract_accepted": bool(accepted or signature_url),
            "contract_accepted_at": _now() if (accepted or signature_url) else None,
            "contract_signature_url": signature_url,
            "contract_signer_name": signer,
        }

    return {
        "contract_version": None,
        "contract_accepted": False,
        "contract_accepted_at": None,
        "contract_signature_url": None,
        "contract_signer_name": None,
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
        # Persist applied extras (may include auto airport flag).
        extras = quote.get("extras_applied") or extras
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
            vehicle_category=vehicle.get("category"),
        )

        contract = validate_contract_acceptance(
            body,
            channel=channel,
            client_name=client_name,
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

        damage_deposit = body.get("damage_deposit_eur")
        if damage_deposit is None:
            damage_deposit = default_damage_deposit_eur()
        else:
            damage_deposit = max(0.0, round(float(damage_deposit), 2))
        damage_status = "none"
        method = str(pay.get("payment_method") or "")
        if method in ("card", "paypal", "apple") and damage_deposit > 0:
            # Pending hold until card PI / desk confirms — v1 stores intent in JSON.
            damage_status = "pending_hold"

        now = _now()
        row = {
            "id": str(uuid4()),
            "tenant_id": tid,
            "vehicle_id": vehicle_id,
            "client_id": (str(body.get("client_id") or "").strip() or None),
            "client_name": client_name,
            "client_email": (str(body.get("client_email") or "").strip().lower() or None),
            "client_phone": (str(body.get("client_phone") or "").strip() or None),
            "client_afm": client_afm,
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
                "is_airport_pickup": quote.get("is_airport_pickup"),
            },
            "extras": extras,
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
            "contract_version": contract["contract_version"],
            "contract_accepted": contract["contract_accepted"],
            "contract_accepted_at": contract["contract_accepted_at"],
            "contract_signature_url": contract["contract_signature_url"],
            "contract_signer_name": contract["contract_signer_name"],
            "damage_deposit_eur": damage_deposit,
            "damage_deposit_status": damage_status,
            "damage_deposit_intent_id": None,
            "branch_id": vehicle.get("branch_id"),
            "branch_name": vehicle.get("branch_name") or DEFAULT_BRANCH_NAME,
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
        "last_sos",
        "last_share_location",
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


def normalize_pickup_checklist(raw: dict[str, Any] | None) -> dict[str, bool]:
    src = raw if isinstance(raw, dict) else {}
    return {
        "tires_ok": bool(src.get("tires_ok")),
        "lights_ok": bool(src.get("lights_ok")),
        "fluids_ok": bool(src.get("fluids_ok")),
        "documents_ok": bool(src.get("documents_ok")),
        "spare_wheel_ok": bool(src.get("spare_wheel_ok")),
        "damages_noted": bool(src.get("damages_noted")),
    }


def require_pickup_checklist(checklist: dict[str, Any] | None) -> dict[str, bool]:
    """Validate pre-departure checklist for customer PICKUP_CHECK."""
    normalized = normalize_pickup_checklist(checklist)
    missing = [k for k in PICKUP_CHECKLIST_REQUIRED if not normalized.get(k)]
    if missing:
        raise ValueError(
            "Ολοκληρώστε τον προ-αναχώρησης έλεγχο: "
            + ", ".join(missing)
        )
    return normalized


def record_booking_sos(
    tenant_id: str | None,
    booking_id: str,
    *,
    email: str,
    lat: float,
    lng: float,
    accuracy: float | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    """Store last_sos on a customer-owned CONFIRMED/ACTIVE booking."""
    tid = _normalize_tenant(tenant_id)
    bid = str(booking_id or "").strip()
    owner = str(email or "").strip().lower()
    with _LOCK:
        data = _read()
        booking = next(
            (b for b in data["bookings"] if b.get("tenant_id") == tid and b.get("id") == bid),
            None,
        )
        if not booking:
            raise ValueError("Η κράτηση δεν βρέθηκε")
        if str(booking.get("client_email") or "").strip().lower() != owner:
            raise ValueError("Δεν έχετε δικαίωμα σε αυτή την κράτηση")
        status = str(booking.get("rental_status") or "").upper()
        if status not in ("CONFIRMED", "ACTIVE"):
            raise ValueError("SOS διαθέσιμο μόνο για επιβεβαιωμένες ή ενεργές ενοικιάσεις")
        sos = {
            "at": _now(),
            "lat": float(lat),
            "lng": float(lng),
            "note": (str(note or "").strip() or None),
        }
        if accuracy is not None:
            try:
                sos["accuracy"] = float(accuracy)
            except (TypeError, ValueError):
                pass
        booking["last_sos"] = sos
        booking["updated_at"] = _now()
        _write(data)
        return deepcopy(booking)


def update_booking_live_location(
    tenant_id: str | None,
    booking_id: str,
    *,
    email: str | None = None,
    lat: float,
    lng: float,
    accuracy: float | None = None,
    require_owner: bool = True,
) -> dict[str, Any]:
    """Update last_share_location pin while rental is ACTIVE (or CONFIRMED)."""
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
        if require_owner:
            owner = str(email or "").strip().lower()
            if str(booking.get("client_email") or "").strip().lower() != owner:
                raise ValueError("Δεν έχετε δικαίωμα σε αυτή την κράτηση")
        status = str(booking.get("rental_status") or "").upper()
        if status not in ("CONFIRMED", "ACTIVE"):
            raise ValueError("Η θέση ενημερώνεται μόνο σε ενεργή ενοικίαση")
        pin = {
            "at": _now(),
            "lat": float(lat),
            "lng": float(lng),
        }
        if accuracy is not None:
            try:
                pin["accuracy"] = float(accuracy)
            except (TypeError, ValueError):
                pass
        booking["last_share_location"] = pin
        booking["updated_at"] = _now()
        _write(data)
        return deepcopy(booking)


def create_inspection(tenant_id: str | None, body: dict[str, Any]) -> dict[str, Any]:
    tid = _normalize_tenant(tenant_id)
    booking_id = str(body.get("rental_booking_id") or "").strip()
    itype = str(body.get("inspection_type") or "").strip().upper()
    if itype not in INSPECTION_TYPES:
        raise ValueError("Μη έγκυρος τύπος επιθεώρησης")
    checklist_raw = body.get("checklist")
    checklist: dict[str, bool] | None = None
    if checklist_raw is not None or body.get("require_pickup_checklist"):
        if itype == "PICKUP_CHECK" and body.get("require_pickup_checklist"):
            checklist = require_pickup_checklist(checklist_raw)
        elif checklist_raw is not None:
            checklist = normalize_pickup_checklist(checklist_raw)
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
            "checklist": checklist,
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
        if status != "CONFIRMED":
            raise ValueError("Μπορείτε να ακυρώσετε μόνο επιβεβαιωμένες κρατήσεις (όχι ενεργές)")
        if not free_cancel_eligible(booking, now=now):
            raise ValueError(
                f"Η δωρεάν ακύρωση ισχύει έως {FREE_CANCEL_HOURS} ώρες πριν την παραλαβή. "
                "Επικοινωνήστε με το γραφείο."
            )
        stamp = (now or datetime.now(timezone.utc)).replace(microsecond=0).isoformat()
        booking["cancelled_at"] = stamp
        booking["cancel_reason"] = "customer_free_cancel"
        booking["updated_at"] = _now()

        paid = float(booking.get("amount_paid") or 0)
        pi_id = str(booking.get("payment_intent_id") or "").strip()
        secret = (os.getenv("STRIPE_SECRET_KEY") or "").strip()
        if paid > 0 and pi_id and secret:
            try:
                import stripe

                stripe.api_key = secret
                refund = stripe.Refund.create(payment_intent=pi_id)
                refund_id = getattr(refund, "id", None) or (
                    refund.get("id") if isinstance(refund, dict) else None
                )
                booking["payment_status"] = "refunded"
                booking["refunded_at"] = stamp
                booking["refund_id"] = refund_id
                booking["amount_paid"] = 0.0
                booking["balance_due"] = round(float(booking.get("total_cost") or 0), 2)
                booking["payment_label"] = "REFUNDED"
            except Exception as exc:
                logger.warning("stripe refund failed booking=%s: %s", bid, exc)
                booking["payment_status"] = "refund_pending"
                booking["refund_note"] = f"Stripe refund failed — desk: {exc}"
                note = str(booking.get("notes") or "").strip()
                booking["notes"] = f"{note} [refund_pending desk]".strip()
        elif paid > 0:
            booking["payment_status"] = "refund_pending"
            booking["refund_note"] = "No Stripe — desk refund required"
            note = str(booking.get("notes") or "").strip()
            booking["notes"] = f"{note} [refund_pending desk]".strip()

        _write(data)
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
    """Customer-facing vehicle cards (no internal notes)."""
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
