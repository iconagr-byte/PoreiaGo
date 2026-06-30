"""Vehicle lifecycle + maintenance domain service."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

from travel_platform.settings.platform_store import get_platform_config
from travel_platform.settings.drivers_store import list_drivers

ServiceStatus = Literal["OK", "Warning", "Urgent"]
AlertSeverity = Literal["warning", "urgent"]

DATA_DIR = Path(__file__).resolve().parent
STORE_FILE = DATA_DIR / "fleet_store.json"
NOTIFICATION_LOG = DATA_DIR / "fleet_notifications.log"
UPLOAD_DIR = DATA_DIR / "uploads"

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


def _default_amenities(category: str) -> list[str]:
    return list(DEFAULT_AMENITIES.get(category, DEFAULT_AMENITIES["Standard"]))


def _default_seats(category: str) -> int:
    return DEFAULT_SEATS.get(category, 49)


@dataclass
class Vehicle:
    id: str
    make: str
    model: str
    plate_number: str
    year: int
    vin: str
    current_odometer: float
    last_service_date: date
    last_service_mileage: float
    service_interval_km: int = 15000
    service_interval_days: int = 365
    next_service_threshold: float | None = None
    legal_deadline: date | None = None  # KTEO
    insurance_due_date: date | None = None
    purchase_price: float = 100000.0
    fuel_cost_total: float = 0.0
    insurance_cost_total: float = 0.0
    category: str = "Standard"
    seat_count: int = 49
    amenities: list[str] = field(default_factory=list)
    public_image_url: str = ""
    public_summary: str = ""
    show_on_website: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class MaintenanceEvent:
    id: str
    vehicle_id: str
    event_date: date
    mileage: float
    service_type: str
    description: str
    cost: float
    shop_or_mechanic: str
    driver_id: str | None = None
    driver_name: str | None = None
    parts_replaced: list[str] = field(default_factory=list)
    next_service_date: date | None = None
    next_service_threshold: float | None = None
    attachments: list[dict[str, Any]] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class FleetAlert:
    id: str
    vehicle_id: str
    plate_number: str
    kind: str
    severity: AlertSeverity
    title: str
    message: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    resolved: bool = False


def _iso(v: Any) -> Any:
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    if isinstance(v, list):
        return [_iso(i) for i in v]
    if isinstance(v, dict):
        return {k: _iso(i) for k, i in v.items()}
    return v


def _parse_date(v: str | None) -> date | None:
    if not v:
        return None
    return date.fromisoformat(v[:10])


def _parse_datetime(v: str | None) -> datetime:
    if not v:
        return datetime.now(timezone.utc)
    return datetime.fromisoformat(v.replace("Z", "+00:00"))


class ServiceService:
    """Core lifecycle service used by admin platform APIs."""

    def __init__(self) -> None:
        self._vehicles: dict[str, Vehicle] = {}
        self._events: dict[str, MaintenanceEvent] = {}
        self._alerts: dict[str, FleetAlert] = {}
        self._load()

    def _seed(self) -> None:
        today = date.today()
        seeds = [
            ("FL-001", "Mercedes", "Tourismo", "XAH-4021", 2022, "WDB000000000001", 145000, 150000, today + timedelta(days=15), 145000, 22000, 120000, "Luxury Coach", 50),
            ("FL-002", "Scania", "Irizar i6", "YZA-9901", 2021, "SCN0000000000002", 280500, 282000, today + timedelta(days=18), 280500, 45000, 158000, "Premium Express", 32),
            ("FL-003", "Volvo", "9700", "IMB-1055", 2019, "VOL0000000000003", 410200, 420000, today + timedelta(days=45), 410200, 95000, 180000, "Standard", 55),
            ("FL-004", "Mercedes", "Tourismo", "XAH-4022", 2023, "WDB0000000000004", 42000, 50000, today + timedelta(days=80), 42000, 8000, 125000, "Luxury Coach", 50),
        ]
        for vid, mk, model, plate, yr, vin, odo, next_km, kteo, last_mileage, maint_cost, price, category, seats in seeds:
            amenities = _default_amenities(category)
            summary = {
                "Luxury Coach": "Premium coach για μεγάλες αποστάσεις — άνεση VIP επιπέδου.",
                "Premium Express": "Express στόλος για γρήγορες διαδρομές Ελλάδας & Ευρώπης.",
                "Standard": "Αξιόπιστο coach για ομαδικές εκδρομές και σχολικές μεταφορές.",
            }.get(category, "")
            self._vehicles[vid] = Vehicle(
                id=vid,
                make=mk,
                model=model,
                plate_number=plate,
                year=yr,
                vin=vin,
                current_odometer=odo,
                last_service_date=today - timedelta(days=80),
                last_service_mileage=last_mileage,
                next_service_threshold=float(next_km),
                legal_deadline=kteo,
                insurance_due_date=today + timedelta(days=130),
                fuel_cost_total=round(odo * 0.22, 2),
                insurance_cost_total=round(yr * 21.3, 2),
                purchase_price=float(price),
                category=category,
                seat_count=seats,
                amenities=amenities,
                public_summary=summary,
                public_image_url="/images/hero-bus-achillio.png",
                show_on_website=True,
            )

    def _load(self) -> None:
        if not STORE_FILE.exists():
            self._seed()
            self._persist()
            return
        raw = json.loads(STORE_FILE.read_text(encoding="utf-8"))
        for r in raw.get("vehicles", []):
            self._vehicles[r["id"]] = Vehicle(
                id=r["id"],
                make=r["make"],
                model=r["model"],
                plate_number=r["plate_number"],
                year=int(r["year"]),
                vin=r["vin"],
                current_odometer=float(r["current_odometer"]),
                last_service_date=_parse_date(r.get("last_service_date")) or date.today(),
                last_service_mileage=float(r.get("last_service_mileage", 0)),
                service_interval_km=int(r.get("service_interval_km", 15000)),
                service_interval_days=int(r.get("service_interval_days", 365)),
                next_service_threshold=float(r["next_service_threshold"]) if r.get("next_service_threshold") is not None else None,
                legal_deadline=_parse_date(r.get("legal_deadline")),
                insurance_due_date=_parse_date(r.get("insurance_due_date")),
                purchase_price=float(r.get("purchase_price", 100000)),
                fuel_cost_total=float(r.get("fuel_cost_total", 0)),
                insurance_cost_total=float(r.get("insurance_cost_total", 0)),
                category=str(r.get("category") or "Standard"),
                seat_count=int(r.get("seat_count") or _default_seats(str(r.get("category") or "Standard"))),
                amenities=list(r.get("amenities") or _default_amenities(str(r.get("category") or "Standard"))),
                public_image_url=str(r.get("public_image_url") or ""),
                public_summary=str(r.get("public_summary") or ""),
                show_on_website=bool(r.get("show_on_website", True)),
                created_at=_parse_datetime(r.get("created_at")),
                updated_at=_parse_datetime(r.get("updated_at")),
            )
        for r in raw.get("events", []):
            self._events[r["id"]] = MaintenanceEvent(
                id=r["id"],
                vehicle_id=r["vehicle_id"],
                event_date=_parse_date(r.get("event_date")) or date.today(),
                mileage=float(r.get("mileage", 0)),
                service_type=r.get("service_type", "other"),
                description=r.get("description", ""),
                cost=float(r.get("cost", 0)),
                shop_or_mechanic=r.get("shop_or_mechanic", ""),
                driver_id=r.get("driver_id"),
                driver_name=r.get("driver_name"),
                parts_replaced=list(r.get("parts_replaced", [])),
                next_service_date=_parse_date(r.get("next_service_date")),
                next_service_threshold=float(r["next_service_threshold"]) if r.get("next_service_threshold") is not None else None,
                attachments=list(r.get("attachments", [])),
                created_at=_parse_datetime(r.get("created_at")),
            )
        for r in raw.get("alerts", []):
            self._alerts[r["id"]] = FleetAlert(
                id=r["id"],
                vehicle_id=r["vehicle_id"],
                plate_number=r["plate_number"],
                kind=r["kind"],
                severity=r["severity"],
                title=r["title"],
                message=r["message"],
                created_at=_parse_datetime(r.get("created_at")),
                resolved=bool(r.get("resolved")),
            )

    def _persist(self) -> None:
        payload = {
            "vehicles": [_iso(asdict(v)) for v in self._vehicles.values()],
            "events": [_iso(asdict(e)) for e in self._events.values()],
            "alerts": [_iso(asdict(a)) for a in self._alerts.values()],
        }
        STORE_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def _service_threshold(self, v: Vehicle) -> float:
        return float(v.next_service_threshold or (v.last_service_mileage + v.service_interval_km))

    def compute_service_status(self, vehicle: Vehicle) -> ServiceStatus:
        today = date.today()
        days_since = (today - vehicle.last_service_date).days
        km_left = self._service_threshold(vehicle) - vehicle.current_odometer
        days_left = vehicle.service_interval_days - days_since
        if km_left <= 0 or days_left <= 0:
            return "Urgent"
        if km_left <= vehicle.service_interval_km * 0.1 or days_left <= 30:
            return "Warning"
        return "OK"

    def _vehicle_response(self, v: Vehicle) -> dict[str, Any]:
        threshold = self._service_threshold(v)
        status = self.compute_service_status(v)
        km_left = round(threshold - v.current_odometer, 1)
        days_to_kteo = (v.legal_deadline - date.today()).days if v.legal_deadline else None
        return {
            **_iso(asdict(v)),
            "service_status": status,
            "next_service_threshold": threshold,
            "km_to_service": km_left,
            "days_to_legal_deadline": days_to_kteo,
        }

    def list_vehicles(self) -> list[dict[str, Any]]:
        return sorted((self._vehicle_response(v) for v in self._vehicles.values()), key=lambda x: x["plate_number"])

    def list_public_vehicles(self) -> list[dict[str, Any]]:
        """Vehicles for marketing homepage — no sensitive fleet data."""
        rows: list[dict[str, Any]] = []
        for v in self._vehicles.values():
            if not v.show_on_website:
                continue
            status = self.compute_service_status(v)
            if status == "Urgent":
                continue
            amenities = v.amenities or _default_amenities(v.category)
            status_label = "Διαθέσιμο" if status == "OK" else "Περιορισμένη διαθεσιμότητα"
            rows.append(
                {
                    "id": v.id,
                    "name": f"{v.make} {v.model}",
                    "make": v.make,
                    "model": v.model,
                    "category": v.category,
                    "year": v.year,
                    "seat_count": v.seat_count,
                    "amenities": amenities,
                    "summary": v.public_summary
                    or f"{v.category} · {v.seat_count} θέσεις · Euro VI",
                    "image_url": v.public_image_url or "/images/hero-bus-achillio.png",
                    "status_label": status_label,
                }
            )
        return sorted(rows, key=lambda x: x["name"])

    def get_vehicle(self, vehicle_id: str) -> dict[str, Any] | None:
        v = self._vehicles.get(vehicle_id)
        if not v:
            return None
        return self._vehicle_response(v)

    def create_vehicle(self, payload: dict[str, Any]) -> dict[str, Any]:
        vid = payload.get("id") or f"FL-{str(uuid4())[:8].upper()}"
        v = Vehicle(
            id=vid,
            make=payload["make"].strip(),
            model=payload["model"].strip(),
            plate_number=payload["plate_number"].strip().upper(),
            year=int(payload["year"]),
            vin=payload["vin"].strip().upper(),
            current_odometer=float(payload.get("current_odometer", 0)),
            last_service_date=_parse_date(payload.get("last_service_date")) or date.today(),
            last_service_mileage=float(payload.get("last_service_mileage", payload.get("current_odometer", 0))),
            service_interval_km=int(payload.get("service_interval_km", 15000)),
            service_interval_days=int(payload.get("service_interval_days", 365)),
            next_service_threshold=float(payload["next_service_threshold"]) if payload.get("next_service_threshold") is not None else None,
            legal_deadline=_parse_date(payload.get("legal_deadline")),
            insurance_due_date=_parse_date(payload.get("insurance_due_date")),
            purchase_price=float(payload.get("purchase_price", 100000)),
            fuel_cost_total=float(payload.get("fuel_cost_total", 0)),
            insurance_cost_total=float(payload.get("insurance_cost_total", 0)),
            category=str(payload.get("category") or "Standard"),
            seat_count=int(payload.get("seat_count") or _default_seats(str(payload.get("category") or "Standard"))),
            amenities=list(payload.get("amenities") or _default_amenities(str(payload.get("category") or "Standard"))),
            public_image_url=str(payload.get("public_image_url") or ""),
            public_summary=str(payload.get("public_summary") or ""),
            show_on_website=bool(payload.get("show_on_website", True)),
        )
        self._vehicles[v.id] = v
        self._persist()
        return self._vehicle_response(v)

    def update_vehicle(self, vehicle_id: str, patch: dict[str, Any]) -> dict[str, Any]:
        v = self._vehicles.get(vehicle_id)
        if not v:
            raise KeyError("Vehicle not found")
        for key, value in patch.items():
            if value is None:
                continue
            if key in {"last_service_date", "legal_deadline", "insurance_due_date"}:
                setattr(v, key, _parse_date(str(value)))
            elif key in {"year", "service_interval_km", "service_interval_days", "seat_count"}:
                setattr(v, key, int(value))
            elif key == "amenities" and isinstance(value, list):
                setattr(v, key, [str(a).strip() for a in value if str(a).strip()])
            elif key == "show_on_website":
                setattr(v, key, bool(value))
            elif key in {"category", "public_image_url", "public_summary"}:
                setattr(v, key, str(value).strip())
            elif key in {"current_odometer", "last_service_mileage", "next_service_threshold", "purchase_price", "fuel_cost_total", "insurance_cost_total"}:
                setattr(v, key, float(value))
            elif hasattr(v, key):
                setattr(v, key, str(value).strip())
        v.updated_at = datetime.now(timezone.utc)
        self._persist()
        return self._vehicle_response(v)

    def delete_vehicle(self, vehicle_id: str) -> bool:
        if vehicle_id not in self._vehicles:
            return False
        del self._vehicles[vehicle_id]
        self._events = {eid: e for eid, e in self._events.items() if e.vehicle_id != vehicle_id}
        self._alerts = {aid: a for aid, a in self._alerts.items() if a.vehicle_id != vehicle_id}
        self._persist()
        return True

    def sync_odometer_from_telemetry(self, vehicle_id: str, odometer_km: float) -> dict[str, Any]:
        return self.update_vehicle(vehicle_id, {"current_odometer": odometer_km})

    def list_maintenance_events(self, vehicle_id: str | None = None) -> list[dict[str, Any]]:
        events = list(self._events.values())
        if vehicle_id:
            events = [e for e in events if e.vehicle_id == vehicle_id]
        events.sort(key=lambda e: e.event_date, reverse=True)
        return [_iso(asdict(e)) for e in events]

    def create_maintenance_event(self, payload: dict[str, Any]) -> dict[str, Any]:
        if payload["vehicle_id"] not in self._vehicles:
            raise KeyError("Vehicle not found")
        e = MaintenanceEvent(
            id=f"ME-{str(uuid4())[:10].upper()}",
            vehicle_id=payload["vehicle_id"],
            event_date=_parse_date(payload.get("event_date")) or date.today(),
            mileage=float(payload.get("mileage", 0)),
            service_type=payload.get("service_type", "other"),
            description=payload.get("description", ""),
            cost=float(payload.get("cost", 0)),
            shop_or_mechanic=payload.get("shop_or_mechanic", ""),
            driver_id=payload.get("driver_id"),
            driver_name=payload.get("driver_name"),
            parts_replaced=list(payload.get("parts_replaced", [])),
            next_service_date=_parse_date(payload.get("next_service_date")),
            next_service_threshold=float(payload["next_service_threshold"]) if payload.get("next_service_threshold") is not None else None,
        )
        if not e.driver_name and e.driver_id:
            d = next((dr for dr in list_drivers() if dr.id == e.driver_id), None)
            if d:
                e.driver_name = d.name
        self._events[e.id] = e
        v = self._vehicles[e.vehicle_id]
        v.last_service_date = e.event_date
        v.last_service_mileage = e.mileage
        v.current_odometer = max(v.current_odometer, e.mileage)
        if e.next_service_threshold is not None:
            v.next_service_threshold = e.next_service_threshold
        self._persist()
        return _iso(asdict(e))

    def attach_to_event(self, event_id: str, file_name: str, mime_type: str, size_bytes: int, storage_path: str) -> dict[str, Any]:
        event = self._events.get(event_id)
        if not event:
            raise KeyError("Maintenance event not found")
        row = {
            "id": f"AT-{str(uuid4())[:8].upper()}",
            "file_name": file_name,
            "mime_type": mime_type,
            "size_bytes": size_bytes,
            "storage_path": storage_path,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }
        event.attachments.append(row)
        self._persist()
        return row

    def scan_predictive_alerts(self) -> list[dict[str, Any]]:
        now = date.today()
        existing = {
            (a.vehicle_id, a.kind): a
            for a in self._alerts.values()
            if not a.resolved
        }
        new_alerts: list[FleetAlert] = []
        for v in self._vehicles.values():
            threshold = self._service_threshold(v)
            km_left = threshold - v.current_odometer
            if km_left <= 0:
                key = (v.id, "service_due_km")
                if key not in existing:
                    new_alerts.append(FleetAlert(
                        id=f"AL-{str(uuid4())[:10].upper()}",
                        vehicle_id=v.id,
                        plate_number=v.plate_number,
                        kind="service_due_km",
                        severity="urgent",
                        title="Υπέρβαση ορίου service",
                        message=f"{v.plate_number}: έχει ξεπεράσει το όριο service ({threshold:.0f} km).",
                    ))
            elif km_left <= v.service_interval_km * 0.1:
                key = (v.id, "service_due_km_warning")
                if key not in existing:
                    new_alerts.append(FleetAlert(
                        id=f"AL-{str(uuid4())[:10].upper()}",
                        vehicle_id=v.id,
                        plate_number=v.plate_number,
                        kind="service_due_km_warning",
                        severity="warning",
                        title="Service σύντομα",
                        message=f"{v.plate_number}: απομένουν {km_left:.0f} km για service.",
                    ))
            if v.legal_deadline:
                days = (v.legal_deadline - now).days
                if days <= 30:
                    kind = "kteo_due"
                    if (v.id, kind) not in existing:
                        sev: AlertSeverity = "urgent" if days <= 7 else "warning"
                        new_alerts.append(FleetAlert(
                            id=f"AL-{str(uuid4())[:10].upper()}",
                            vehicle_id=v.id,
                            plate_number=v.plate_number,
                            kind=kind,
                            severity=sev,
                        title="Λήξη ΚΤΕΟ",
                            message=f"{v.plate_number}: λήξη ΚΤΕΟ σε {days} ημέρες.",
                        ))
        for alert in new_alerts:
            self._alerts[alert.id] = alert
        self._notify_fleet_manager(new_alerts)
        self._persist()
        return self.list_alerts()

    def _notify_fleet_manager(self, new_alerts: list[FleetAlert]) -> None:
        urgent = [a for a in new_alerts if a.severity == "urgent"]
        if not urgent:
            return
        cfg = get_platform_config()
        email = getattr(cfg, "support_email", None) or "fleet.manager@aerostride.app"
        ts = datetime.now(timezone.utc).isoformat()
        lines = [f"[{ts}] to={email} subject=Επείγουσες ειδοποιήσεις στόλου count={len(urgent)}"]
        for a in urgent:
            lines.append(f" - {a.plate_number}: {a.title} | {a.message}")
        NOTIFICATION_LOG.write_text(
            (NOTIFICATION_LOG.read_text(encoding="utf-8") if NOTIFICATION_LOG.exists() else "")
            + "\n".join(lines)
            + "\n",
            encoding="utf-8",
        )

    def list_alerts(self, unresolved_only: bool = True) -> list[dict[str, Any]]:
        alerts = list(self._alerts.values())
        if unresolved_only:
            alerts = [a for a in alerts if not a.resolved]
        alerts.sort(key=lambda a: (a.severity != "urgent", a.created_at), reverse=False)
        return [_iso(asdict(a)) for a in alerts]

    def resolve_alert(self, alert_id: str) -> dict[str, Any]:
        alert = self._alerts.get(alert_id)
        if not alert:
            raise KeyError("Alert not found")
        alert.resolved = True
        self._persist()
        return _iso(asdict(alert))

    def record_dispatch_blocked(
        self,
        plate_number: str,
        reason: str,
        *,
        trip_title: str | None = None,
    ) -> dict[str, Any]:
        """Log blocked booking attempt; notify fleet manager (email log file)."""
        plate = (plate_number or "").strip().upper().replace(" ", "")
        vehicle_id = "unknown"
        for v in self._vehicles.values():
            if v.plate_number.replace(" ", "").upper() == plate:
                vehicle_id = v.id
                break

        now = datetime.now(timezone.utc)
        for existing in self._alerts.values():
            if (
                not existing.resolved
                and existing.kind == "dispatch_blocked"
                and existing.plate_number.replace(" ", "").upper() == plate
                and (now - existing.created_at).total_seconds() < 3600
            ):
                return _iso(asdict(existing))

        msg = reason
        if trip_title:
            msg = f"{reason} — Εκδρομή: {trip_title}"

        alert = FleetAlert(
            id=f"AL-{str(uuid4())[:8].upper()}",
            vehicle_id=vehicle_id,
            plate_number=plate,
            kind="dispatch_blocked",
            severity="warning",
            title="Αποτυχία online κράτησης (όχημα μη διαθέσιμο)",
            message=msg,
        )
        self._alerts[alert.id] = alert
        self._persist()
        self._notify_dispatch_blocked(alert)
        return _iso(asdict(alert))

    def _notify_dispatch_blocked(self, alert: FleetAlert) -> None:
        cfg = get_platform_config()
        email = getattr(cfg, "support_email", None) or "fleet.manager@aerostride.app"
        ts = datetime.now(timezone.utc).isoformat()
        line = (
            f"[{ts}] to={email} subject=Αποκλεισμένη κράτηση "
            f"plate={alert.plate_number} | {alert.message}"
        )
        NOTIFICATION_LOG.write_text(
            (NOTIFICATION_LOG.read_text(encoding="utf-8") if NOTIFICATION_LOG.exists() else "")
            + line
            + "\n",
            encoding="utf-8",
        )

    def get_vehicle_cost_report(self, vehicle_id: str, date_from: date, date_to: date) -> dict[str, Any]:
        v = self._vehicles.get(vehicle_id)
        if not v:
            raise KeyError("Vehicle not found")
        events = [
            e for e in self._events.values()
            if e.vehicle_id == vehicle_id and date_from <= e.event_date <= date_to
        ]
        maintenance_total = round(sum(e.cost for e in events), 2)
        fuel_total = round(v.fuel_cost_total, 2)
        insurance_total = round(v.insurance_cost_total, 2)
        total = round(maintenance_total + fuel_total + insurance_total, 2)
        return {
            "vehicle_id": vehicle_id,
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "maintenance_total": maintenance_total,
            "fuel_total": fuel_total,
            "insurance_total": insurance_total,
            "total": total,
            "event_count": len(events),
        }

    def estimate_book_value(self, vehicle_id: str, as_of: date | None = None) -> dict[str, Any]:
        v = self._vehicles.get(vehicle_id)
        if not v:
            raise KeyError("Vehicle not found")
        ref = as_of or date.today()
        age_years = max(0, ref.year - int(v.year))
        useful_life_years = 8
        base_value = v.purchase_price * max(0.0, 1 - (age_years / useful_life_years))
        expected_km = max(1, age_years * 20000)
        over_km = max(0.0, v.current_odometer - expected_km)
        mileage_factor = max(0.60, 1 - (over_km / expected_km) * 0.15)
        book_value = round(base_value * mileage_factor, 2)
        return {
            "vehicle_id": vehicle_id,
            "as_of": ref.isoformat(),
            "purchase_price": round(v.purchase_price, 2),
            "age_years": age_years,
            "current_odometer": round(v.current_odometer, 1),
            "estimated_book_value": book_value,
            "mileage_factor": round(mileage_factor, 4),
        }

    def dashboard_cards(self) -> dict[str, Any]:
        vehicles = self.list_vehicles()
        unresolved = self.list_alerts(unresolved_only=True)
        urgent = [v for v in vehicles if v["service_status"] == "Urgent"]
        warning = [v for v in vehicles if v["service_status"] == "Warning"]
        monthly_cost = sum(v.get("insurance_cost_total", 0) for v in vehicles) / 12 + sum(v.get("fuel_cost_total", 0) for v in vehicles) / 12
        return {
            "urgent_count": len(urgent),
            "warning_count": len(warning),
            "alerts_count": len(unresolved),
            "monthly_cost_estimate": round(monthly_cost, 2),
            "needs_attention": urgent[:5],
            "alerts": unresolved[:8],
        }

    def check_dispatch_availability(self, plate_number: str) -> dict[str, Any]:
        """Whether a vehicle plate may accept new passenger bookings."""
        plate = (plate_number or "").strip().upper().replace(" ", "")
        if not plate:
            return {"available": True, "plate": plate, "service_status": None}

        vehicle: Vehicle | None = None
        for v in self._vehicles.values():
            if v.plate_number.replace(" ", "").upper() == plate:
                vehicle = v
                break

        if not vehicle:
            return {"available": True, "plate": plate, "unknown_plate": True, "service_status": None}

        status = self.compute_service_status(vehicle)
        base = {
            "plate": plate,
            "vehicle_id": vehicle.id,
            "service_status": status,
            "km_to_service": round(self._service_threshold(vehicle) - vehicle.current_odometer, 1),
        }

        if status == "Urgent":
            return {
                **base,
                "available": False,
                "reason": "Το όχημα έχει επείγουσα ανάγκη συντήρησης και δεν δέχεται νέες κρατήσεις.",
            }

        if vehicle.legal_deadline and vehicle.legal_deadline < date.today():
            return {
                **base,
                "available": False,
                "reason": "Το ΚΤΕΟ του οχήματος έχει λήξει — μη διαθέσιμο για κράτηση.",
            }

        if vehicle.insurance_due_date and vehicle.insurance_due_date < date.today():
            return {
                **base,
                "available": False,
                "reason": "Η ασφάλεια του οχήματος έχει λήξει.",
            }

        blocking_types = ("αναστηλ", "engine", "κινητ", "kteo", "έκτακ")
        for event in self._events.values():
            if event.vehicle_id != vehicle.id:
                continue
            if (date.today() - event.event_date).days > 21:
                continue
            st = (event.service_type or "").lower()
            desc = (event.description or "").lower()
            if any(b in st or b in desc for b in blocking_types):
                return {
                    **base,
                    "available": False,
                    "reason": f"Το όχημα είναι σε ενεργό service ({event.service_type}).",
                }

        warning = None
        if status == "Warning":
            warning = "Προσοχή: το όχημα πλησιάζει όριο service — η κράτηση επιτρέπεται."

        return {**base, "available": True, "reason": warning, "warning": warning}


service_service = ServiceService()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
