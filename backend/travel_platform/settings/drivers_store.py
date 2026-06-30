"""Fleet drivers — in-memory registry for admin control panel."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Literal
from uuid import uuid4

DriverStatus = Literal["active", "inactive", "on_leave", "suspended"]


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
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


def _seed() -> dict[str, FleetDriver]:
    today = date.today()
    seeds = [
        ("Νίκος Παπαδόπουλος", "XAH-4021", "XAH-4021", "AB123456", "+30 694 111 0001", "nikos.driver@aerostride.com", 145000, 312, 94),
        ("Γιώργος Γεωργίου", "YZA-9901", "YZA-9901", "AB234567", "+30 694 222 0002", "giorgos.driver@aerostride.com", 280500, 428, 88),
        ("Κώστας Κωνσταντίνου", "IMB-1055", "IMB-1055", "AB345678", "+30 694 333 0003", "kostas.driver@aerostride.com", 410200, 501, 91),
        ("Ανδρέας Ανδρέου", "XAH-4022", "XAH-4022", "AB456789", "+30 694 444 0004", "andreas.driver@aerostride.com", 42000, 89, 97),
    ]
    drivers: dict[str, FleetDriver] = {}
    for name, vcode, plate, lic, phone, email, km, trips, safety in seeds:
        did = str(uuid4())
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
        )
    return drivers


_drivers: dict[str, FleetDriver] | None = None


def _ensure() -> dict[str, FleetDriver]:
    global _drivers
    if _drivers is None:
        _drivers = _seed()
    return _drivers


def list_drivers(status: str | None = None) -> list[FleetDriver]:
    items = list(_ensure().values())
    if status:
        items = [d for d in items if d.status == status]
    return sorted(items, key=lambda d: d.name)


def get_driver(driver_id: str) -> FleetDriver | None:
    return _ensure().get(driver_id)


def create_driver(data: dict) -> FleetDriver:
    did = str(uuid4())
    driver = FleetDriver(
        id=did,
        name=data["name"].strip(),
        license_no=data["license_no"].strip(),
        phone=data.get("phone", "").strip(),
        email=data["email"].strip().lower(),
        hiring_date=data.get("hiring_date") or date.today(),
        status=data.get("status", "active"),
        vehicle_code=data.get("vehicle_code"),
        license_plate=data.get("license_plate"),
        salary_per_km=float(data.get("salary_per_km", 0.45)),
        salary_per_trip=float(data.get("salary_per_trip", 25)),
        current_balance=0.0,
        safety_score=100,
        license_expires_at=data.get("license_expires_at"),
    )
    _ensure()[did] = driver
    return driver


def update_driver(driver_id: str, patch: dict) -> FleetDriver:
    d = _ensure().get(driver_id)
    if not d:
        raise KeyError("Driver not found")
    for key in (
        "name", "license_no", "phone", "email", "status",
        "vehicle_code", "license_plate", "hiring_date", "license_expires_at",
    ):
        if key in patch and patch[key] is not None:
            setattr(d, key, patch[key])
    if patch.get("email"):
        d.email = str(patch["email"]).lower()
    if patch.get("salary_per_km") is not None:
        d.salary_per_km = float(patch["salary_per_km"])
    if patch.get("salary_per_trip") is not None:
        d.salary_per_trip = float(patch["salary_per_trip"])
    return d


def delete_driver(driver_id: str) -> None:
    if driver_id not in _ensure():
        raise KeyError("Driver not found")
    del _ensure()[driver_id]


def drivers_for_export() -> list[dict]:
    out = []
    for d in list_drivers():
        out.append({
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
            "created_at": d.created_at.isoformat(),
        })
    return out


def replace_drivers_from_backup(rows: list[dict]) -> int:
    global _drivers
    _drivers = {}
    for row in rows:
        did = row.get("id") or str(uuid4())
        _drivers[did] = FleetDriver(
            id=did,
            name=row["name"],
            license_no=row["license_no"],
            phone=row.get("phone", ""),
            email=row["email"].lower(),
            hiring_date=date.fromisoformat(row["hiring_date"])
            if isinstance(row.get("hiring_date"), str)
            else date.today(),
            status=row.get("status", "active"),
            vehicle_code=row.get("vehicle_code"),
            license_plate=row.get("license_plate"),
            salary_per_km=float(row.get("salary_per_km", 0.45)),
            salary_per_trip=float(row.get("salary_per_trip", 25)),
            current_balance=float(row.get("current_balance", 0)),
            safety_score=int(row.get("safety_score", 100)),
            trips_completed=int(row.get("trips_completed", 0)),
            total_km=float(row.get("total_km", 0)),
            license_expires_at=date.fromisoformat(row["license_expires_at"])
            if row.get("license_expires_at")
            else None,
            avg_rating=row.get("avg_rating"),
            created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
            if row.get("created_at")
            else datetime.now(timezone.utc),
        )
    return len(_drivers)
