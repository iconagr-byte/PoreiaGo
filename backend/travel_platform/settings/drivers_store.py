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


def _load_from_disk() -> dict[str, FleetDriver] | None:
    if not STORE_PATH.exists():
        return None
    try:
        raw = json.loads(STORE_PATH.read_text(encoding="utf-8"))
        rows = raw.get("drivers") if isinstance(raw, dict) else raw
        if not isinstance(rows, list) or not rows:
            return None
        drivers = {row["id"]: _driver_from_row(row) for row in rows if row.get("id")}
        logger.info("Loaded %s fleet drivers from %s", len(drivers), STORE_PATH)
        return drivers
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
    except Exception as exc:
        logger.error("Failed to persist fleet drivers to %s: %s", STORE_PATH, exc)


_drivers: dict[str, FleetDriver] | None = None


def _ensure() -> dict[str, FleetDriver]:
    global _drivers
    if _drivers is None:
        loaded = _load_from_disk()
        if loaded is not None:
            _drivers = loaded
        else:
            _drivers = _seed()
            _persist()
    return _drivers


def list_drivers(status: str | None = None) -> list[FleetDriver]:
    items = list(_ensure().values())
    if status:
        items = [d for d in items if d.status == status]
    return sorted(items, key=lambda d: d.name)


def get_driver(driver_id: str) -> FleetDriver | None:
    return _ensure().get(driver_id)


def find_driver_by_username(username: str) -> FleetDriver | None:
    """Match email, license number, or vehicle/driver code (case-insensitive)."""
    needle = (username or "").strip().lower()
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
    did = str(uuid4())
    pwd = data.get("password") or DEFAULT_DRIVER_PASSWORD
    hiring = _parse_date(data.get("hiring_date")) or date.today()
    driver = FleetDriver(
        id=did,
        name=data["name"].strip(),
        license_no=data["license_no"].strip(),
        phone=(data.get("phone") or "").strip(),
        email=data["email"].strip().lower(),
        hiring_date=hiring,
        status=data.get("status", "active"),
        vehicle_code=data.get("vehicle_code"),
        license_plate=data.get("license_plate"),
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
    if patch.get("salary_per_km") is not None:
        d.salary_per_km = float(patch["salary_per_km"])
    if patch.get("salary_per_trip") is not None:
        d.salary_per_trip = float(patch["salary_per_trip"])
    if patch.get("password"):
        d.password_hash = hash_password(str(patch["password"]))
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
