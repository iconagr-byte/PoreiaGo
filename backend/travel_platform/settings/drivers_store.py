"""Fleet drivers — file-backed registry for admin + driver PWA login."""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from ticketing.password_utils import hash_password, verify_password

logger = logging.getLogger(__name__)

DriverStatus = Literal["active", "inactive", "on_leave", "suspended"]

DEFAULT_DRIVER_PASSWORD = "driver123"

# Prefer persistent volume in production (docker mount /app/data).
_DATA_DIR = Path(os.getenv("POREIAGO_DATA_DIR") or Path(__file__).resolve().parents[2] / "data")
STORE_PATH = Path(os.getenv("FLEET_DRIVERS_STORE") or (_DATA_DIR / "fleet_drivers.json"))


@dataclass
class FleetDriver:
    id: str
    name: str
    license_no: str
    phone: str
    email: str
    hiring_date: date
    status: DriverStatus
    vehicle_code: str | None = None
    license_plate: str | None = None
    salary_per_km: float = 0.45
    salary_per_trip: float = 25.0
    current_balance: float = 0.0
    safety_score: int = 100
    trips_completed: int = 0
    total_km: float = 0.0
    license_expires_at: date | None = None
    avg_rating: float | None = None
    password_hash: str | None = None
    photo_url: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


def _parse_date(value) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        return date.fromisoformat(value[:10])
    return None


def _parse_datetime(value) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return datetime.now(timezone.utc)


def _driver_from_row(row: dict) -> FleetDriver:
    pwd_hash = row.get("password_hash")
    if not pwd_hash and row.get("password"):
        pwd_hash = hash_password(str(row["password"]))
    return FleetDriver(
        id=row.get("id") or str(uuid4()),
        name=row["name"],
        license_no=row["license_no"],
        phone=row.get("phone", "") or "",
        email=str(row["email"]).lower(),
        hiring_date=_parse_date(row.get("hiring_date")) or date.today(),
        status=row.get("status", "active"),
        vehicle_code=row.get("vehicle_code"),
        license_plate=row.get("license_plate"),
        salary_per_km=float(row.get("salary_per_km", 0.45)),
        salary_per_trip=float(row.get("salary_per_trip", 25)),
        current_balance=float(row.get("current_balance", 0)),
        safety_score=int(row.get("safety_score", 100)),
        trips_completed=int(row.get("trips_completed", 0)),
        total_km=float(row.get("total_km", 0)),
        license_expires_at=_parse_date(row.get("license_expires_at")),
        avg_rating=row.get("avg_rating"),
        password_hash=pwd_hash or hash_password(DEFAULT_DRIVER_PASSWORD),
        photo_url=(str(row["photo_url"]).strip() or None) if row.get("photo_url") else None,
        created_at=_parse_datetime(row.get("created_at")),
    )


def _driver_to_row(d: FleetDriver) -> dict:
    return {
        "id": d.id,
        "name": d.name,
        "license_no": d.license_no,
        "phone": d.phone,
        "email": d.email,
        "hiring_date": d.hiring_date.isoformat(),
        "status": d.status,
        "vehicle_code": d.vehicle_code,
        "license_plate": d.license_plate,
        "salary_per_km": d.salary_per_km,
        "salary_per_trip": d.salary_per_trip,
        "current_balance": d.current_balance,
        "safety_score": d.safety_score,
        "trips_completed": d.trips_completed,
        "total_km": d.total_km,
        "license_expires_at": d.license_expires_at.isoformat() if d.license_expires_at else None,
        "avg_rating": d.avg_rating,
        "password_hash": d.password_hash,
        "photo_url": d.photo_url,
        "created_at": d.created_at.isoformat(),
    }


def _seed() -> dict[str, FleetDriver]:
    today = date.today()
    # Stable IDs so restarts without a store file stay predictable in demos.
    seeds = [
        ("a1000000-0000-4000-8000-000000000001", "Νίκος Παπαδόπουλος", "XAH-4021", "XAH-4021", "AB123456", "+30 694 111 0001", "nikos.driver@aerostride.com", 145000, 312, 94),
        ("a1000000-0000-4000-8000-000000000002", "Γιώργος Γεωργίου", "YZA-9901", "YZA-9901", "AB234567", "+30 694 222 0002", "giorgos.driver@aerostride.com", 280500, 428, 88),
        ("a1000000-0000-4000-8000-000000000003", "Κώστας Κωνσταντίνου", "IMB-1055", "IMB-1055", "AB345678", "+30 694 333 0003", "kostas.driver@aerostride.com", 410200, 501, 91),
        ("a1000000-0000-4000-8000-000000000004", "Ανδρέας Ανδρέου", "XAH-4022", "XAH-4022", "AB456789", "+30 694 444 0004", "andreas.driver@aerostride.com", 42000, 89, 97),
    ]
    drivers: dict[str, FleetDriver] = {}
    pwd_hash = hash_password(DEFAULT_DRIVER_PASSWORD)
    for did, name, vcode, plate, lic, phone, email, km, trips, safety in seeds:
        drivers[did] = FleetDriver(
            id=did,
            name=name,
            license_no=lic,
            phone=phone,
            email=email,
            hiring_date=date(2022, 3, 15),
            status="active" if vcode != "IMB-1055" else "on_leave",
            vehicle_code=vcode,
            license_plate=plate,
            salary_per_km=0.45,
            salary_per_trip=25.0,
            current_balance=round(trips * 25.0 * 0.3, 2),
            safety_score=safety,
            trips_completed=trips,
            total_km=float(km),
            license_expires_at=date(today.year + 1, 6, 30),
            avg_rating=4.2 + (safety % 5) * 0.1,
            password_hash=pwd_hash,
            photo_url=None,
        )
    return drivers


def _normalize_username(value: str | None) -> str:
    return (value or "").strip().lower()


def _load_from_disk() -> tuple[dict[str, FleetDriver], float] | None:
    """
    Load store from disk.
    Returns (drivers, mtime). Empty list is a valid store (do NOT re-seed).
    Missing / corrupt file → None (caller may seed).
    """
    if not STORE_PATH.exists():
        return None
    try:
        mtime = STORE_PATH.stat().st_mtime
        raw = json.loads(STORE_PATH.read_text(encoding="utf-8"))
        rows = raw.get("drivers") if isinstance(raw, dict) else raw
        if not isinstance(rows, list):
            return None
        drivers = {row["id"]: _driver_from_row(row) for row in rows if isinstance(row, dict) and row.get("id")}
        logger.info("Loaded %s fleet drivers from %s", len(drivers), STORE_PATH)
        return drivers, mtime
    except Exception as exc:
        logger.warning("Failed to load fleet drivers from %s: %s", STORE_PATH, exc)
        return None


def _persist() -> None:
    if _drivers is None:
        return
    try:
        STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        payload = {"drivers": [_driver_to_row(d) for d in _drivers.values()]}
        tmp = STORE_PATH.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(STORE_PATH)
        global _store_mtime
        _store_mtime = STORE_PATH.stat().st_mtime
    except Exception as exc:
        logger.error("Failed to persist fleet drivers to %s: %s", STORE_PATH, exc)
        raise RuntimeError(f"Αποτυχία αποθήκευσης οδηγών: {exc}") from exc


_drivers: dict[str, FleetDriver] | None = None
_store_mtime: float | None = None


def reset_drivers_cache() -> None:
    """Test helper — drop in-memory cache so next access reloads from disk."""
    global _drivers, _store_mtime
    _drivers = None
    _store_mtime = None


def _ensure() -> dict[str, FleetDriver]:
    global _drivers, _store_mtime
    # Reload when another process (or blue/green peer) wrote a newer store file.
    if _drivers is not None and STORE_PATH.exists():
        try:
            disk_mtime = STORE_PATH.stat().st_mtime
            if _store_mtime is not None and disk_mtime > _store_mtime:
                loaded = _load_from_disk()
                if loaded is not None:
                    _drivers, _store_mtime = loaded
                    return _drivers
        except OSError:
            pass

    if _drivers is None:
        loaded = _load_from_disk()
        if loaded is not None:
            _drivers, _store_mtime = loaded
        else:
            _drivers = _seed()
            _persist()
    return _drivers


def _assert_unique(
    *,
    email: str,
    license_no: str,
    vehicle_code: str | None,
    license_plate: str | None,
    exclude_id: str | None = None,
) -> None:
    email_n = _normalize_username(email)
    license_n = _normalize_username(license_no)
    code_n = _normalize_username(vehicle_code)
    plate_n = _normalize_username(license_plate)
    for d in _ensure().values():
        if exclude_id and d.id == exclude_id:
            continue
        if email_n and d.email.lower() == email_n:
            raise ValueError("Το email χρησιμοποιείται ήδη από άλλον οδηγό")
        if license_n and d.license_no.lower() == license_n:
            raise ValueError("Ο αριθμός άδειας χρησιμοποιείται ήδη")
        if code_n and d.vehicle_code and d.vehicle_code.lower() == code_n:
            raise ValueError("Ο κωδικός οχήματος χρησιμοποιείται ήδη")
        if plate_n and d.license_plate and d.license_plate.lower() == plate_n:
            raise ValueError("Η πινακίδα χρησιμοποιείται ήδη")


def list_drivers(status: str | None = None) -> list[FleetDriver]:
    items = list(_ensure().values())
    if status:
        items = [d for d in items if d.status == status]
    return sorted(items, key=lambda d: d.name)


def get_driver(driver_id: str) -> FleetDriver | None:
    return _ensure().get(driver_id)


def find_driver_by_username(username: str) -> FleetDriver | None:
    """Match email, license number, or vehicle/driver code (case-insensitive)."""
    needle = _normalize_username(username)
    if not needle:
        return None
    for d in _ensure().values():
        if d.email.lower() == needle:
            return d
        if d.license_no.lower() == needle:
            return d
        if d.vehicle_code and d.vehicle_code.lower() == needle:
            return d
        if d.license_plate and d.license_plate.lower() == needle:
            return d
    return None


def authenticate_driver(username: str, password: str) -> FleetDriver | None:
    driver = find_driver_by_username(username)
    if not driver or driver.status not in ("active", "on_leave"):
        return None
    stored = driver.password_hash
    if not stored:
        if password != DEFAULT_DRIVER_PASSWORD:
            return None
        driver.password_hash = hash_password(password)
        _persist()
        return driver
    if not verify_password(password, stored):
        return None
    return driver


def create_driver(data: dict) -> FleetDriver:
    pwd = data.get("password")
    if not pwd or not str(pwd).strip():
        raise ValueError("Απαιτείται κωδικός για την εφαρμογή λεωφορείου")
    if len(str(pwd)) < 4:
        raise ValueError("Ο κωδικός πρέπει να έχει τουλάχιστον 4 χαρακτήρες")

    email = data["email"].strip().lower()
    license_no = data["license_no"].strip()
    vehicle_code = (data.get("vehicle_code") or None)
    if isinstance(vehicle_code, str):
        vehicle_code = vehicle_code.strip() or None
    license_plate = (data.get("license_plate") or None)
    if isinstance(license_plate, str):
        license_plate = license_plate.strip() or None

    _assert_unique(
        email=email,
        license_no=license_no,
        vehicle_code=vehicle_code,
        license_plate=license_plate,
    )

    did = str(uuid4())
    hiring = _parse_date(data.get("hiring_date")) or date.today()
    driver = FleetDriver(
        id=did,
        name=data["name"].strip(),
        license_no=license_no,
        phone=(data.get("phone") or "").strip(),
        email=email,
        hiring_date=hiring,
        status=data.get("status", "active"),
        vehicle_code=vehicle_code,
        license_plate=license_plate,
        salary_per_km=float(data.get("salary_per_km", 0.45)),
        salary_per_trip=float(data.get("salary_per_trip", 25)),
        current_balance=0.0,
        safety_score=100,
        license_expires_at=_parse_date(data.get("license_expires_at")),
        password_hash=hash_password(str(pwd)),
        photo_url=(str(data["photo_url"]).strip() or None) if data.get("photo_url") else None,
    )
    _ensure()[did] = driver
    _persist()
    return driver


def update_driver(driver_id: str, patch: dict) -> FleetDriver:
    d = _ensure().get(driver_id)
    if not d:
        raise KeyError("Driver not found")

    next_email = str(patch["email"]).strip().lower() if patch.get("email") else d.email
    next_license = str(patch["license_no"]).strip() if patch.get("license_no") is not None else d.license_no
    next_code = d.vehicle_code
    if "vehicle_code" in patch:
        raw = patch["vehicle_code"]
        next_code = (str(raw).strip() or None) if raw is not None else None
    next_plate = d.license_plate
    if "license_plate" in patch:
        raw = patch["license_plate"]
        next_plate = (str(raw).strip() or None) if raw is not None else None

    _assert_unique(
        email=next_email,
        license_no=next_license,
        vehicle_code=next_code,
        license_plate=next_plate,
        exclude_id=driver_id,
    )

    for key in (
        "name", "license_no", "phone", "email", "status",
        "vehicle_code", "license_plate",
    ):
        if key in patch and patch[key] is not None:
            setattr(d, key, patch[key])
    if "hiring_date" in patch and patch["hiring_date"] is not None:
        d.hiring_date = _parse_date(patch["hiring_date"]) or d.hiring_date
    if "license_expires_at" in patch:
        d.license_expires_at = _parse_date(patch["license_expires_at"])
    if "photo_url" in patch:
        raw = patch["photo_url"]
        d.photo_url = (str(raw).strip() or None) if raw is not None else None
    if patch.get("email"):
        d.email = str(patch["email"]).lower()
    if "vehicle_code" in patch:
        d.vehicle_code = next_code
    if "license_plate" in patch:
        d.license_plate = next_plate
    if patch.get("salary_per_km") is not None:
        d.salary_per_km = float(patch["salary_per_km"])
    if patch.get("salary_per_trip") is not None:
        d.salary_per_trip = float(patch["salary_per_trip"])
    if patch.get("total_km") is not None:
        d.total_km = float(patch["total_km"])
    if patch.get("trips_completed") is not None:
        d.trips_completed = int(patch["trips_completed"])
    if patch.get("password"):
        pwd = str(patch["password"])
        if len(pwd) < 4:
            raise ValueError("Ο κωδικός πρέπει να έχει τουλάχιστον 4 χαρακτήρες")
        d.password_hash = hash_password(pwd)
    _persist()
    return d


def delete_driver(driver_id: str) -> None:
    if driver_id not in _ensure():
        raise KeyError("Driver not found")
    del _ensure()[driver_id]
    _persist()


def drivers_for_export() -> list[dict]:
    return [_driver_to_row(d) for d in list_drivers()]


def replace_drivers_from_backup(rows: list[dict]) -> int:
    global _drivers
    _drivers = {}
    for row in rows:
        driver = _driver_from_row(row)
        _drivers[driver.id] = driver
    _persist()
    return len(_drivers)
