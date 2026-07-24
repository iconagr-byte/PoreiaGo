"""
Hybrid trip operations: flights, unified timeline segments, luggage,
flight-delay monitor hooks, and cost/yield calculation.
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_service import TenantScopedService


SEGMENT_TYPES = frozenset(
    {
        "ground_transfer",
        "bus",
        "van",
        "flight",
        "hotel_transfer",
        "local_transfer",
        "layover",
        "other",
    }
)


def _dec(value: Any, default: str = "0") -> Decimal:
    try:
        return Decimal(str(value if value is not None else default))
    except Exception:
        return Decimal(default)


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _parse_dt(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text_v = str(value).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text_v)
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@dataclass
class FlightRecord:
    id: UUID
    trip_id: int
    flight_number: str
    airline: str
    departure_airport: str
    arrival_airport: str
    departure_time: datetime
    arrival_time: datetime
    pnr_code: str | None
    seats_allocated: int
    cost_per_seat: Decimal
    total_cost: Decimal
    currency: str
    status: str
    delay_minutes: int
    notes: str | None

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["id"] = str(self.id)
        d["departure_time"] = _iso(self.departure_time)
        d["arrival_time"] = _iso(self.arrival_time)
        d["cost_per_seat"] = float(self.cost_per_seat)
        d["total_cost"] = float(self.total_cost)
        return d


@dataclass
class SegmentRecord:
    id: UUID
    trip_id: int
    sequence: int
    segment_type: str
    title: str
    starts_at: datetime | None
    ends_at: datetime | None
    flight_id: UUID | None
    vehicle_ref: str | None
    origin_label: str | None
    destination_label: str | None
    ground_cost: Decimal
    currency: str
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "trip_id": self.trip_id,
            "sequence": self.sequence,
            "segment_type": self.segment_type,
            "title": self.title,
            "starts_at": _iso(self.starts_at),
            "ends_at": _iso(self.ends_at),
            "flight_id": str(self.flight_id) if self.flight_id else None,
            "vehicle_ref": self.vehicle_ref,
            "origin_label": self.origin_label,
            "destination_label": self.destination_label,
            "ground_cost": float(self.ground_cost),
            "currency": self.currency,
            "metadata": self.metadata or {},
        }


class HybridTripService(TenantScopedService):
    """CRUD + smart helpers for multi-modal trips."""

    async def ensure_trip_row(self, trip_id: int, *, title: str = "", base_price: float = 0) -> None:
        """Guarantee a trips row exists so FKs succeed (frontend-first sync)."""
        await self._bind_tenant_rls()
        await self.session.execute(
            text(
                """
                INSERT INTO trips (id, tenant_id, total_seats, base_price, title)
                VALUES (:id, :tenant, 50, :price, :title)
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {
                "id": trip_id,
                "tenant": str(self.tenant_id),
                "price": max(float(base_price or 0), 0),
                "title": (title or f"Trip #{trip_id}")[:500],
            },
        )

    # ------------------------------------------------------------------ flights
    async def list_flights(self, trip_id: int) -> list[FlightRecord]:
        await self._bind_tenant_rls()
        result = await self.session.execute(
            text(
                """
                SELECT id, trip_id, flight_number, airline, departure_airport, arrival_airport,
                       departure_time, arrival_time, pnr_code, seats_allocated,
                       cost_per_seat, total_cost, currency, status, delay_minutes, notes
                FROM flights
                WHERE tenant_id = :tenant AND trip_id = :trip
                ORDER BY departure_time ASC
                """
            ),
            {"tenant": str(self.tenant_id), "trip": trip_id},
        )
        return [self._row_to_flight(r) for r in result.mappings().all()]

    async def upsert_flight(self, trip_id: int, payload: dict[str, Any]) -> FlightRecord:
        await self.ensure_trip_row(trip_id, title=str(payload.get("trip_title") or ""))
        await self._bind_tenant_rls()

        seats = int(payload.get("seats_allocated") or 0)
        cost_per = _dec(payload.get("cost_per_seat"))
        total = _dec(payload.get("total_cost"))
        if total <= 0 and seats > 0:
            total = cost_per * seats

        flight_id = payload.get("id")
        fid = UUID(str(flight_id)) if flight_id else uuid4()
        dep = _parse_dt(payload.get("departure_time"))
        arr = _parse_dt(payload.get("arrival_time"))
        if not dep or not arr:
            raise ValueError("departure_time and arrival_time are required")

        await self.session.execute(
            text(
                """
                INSERT INTO flights (
                    id, tenant_id, trip_id, flight_number, airline,
                    departure_airport, arrival_airport, departure_time, arrival_time,
                    pnr_code, seats_allocated, cost_per_seat, total_cost, currency,
                    status, delay_minutes, notes, created_at, updated_at
                ) VALUES (
                    :id, :tenant, :trip, :flight_number, :airline,
                    :dep_airport, :arr_airport, :dep_time, :arr_time,
                    :pnr, :seats, :cps, :total, :currency,
                    :status, :delay, :notes, NOW(), NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    flight_number = EXCLUDED.flight_number,
                    airline = EXCLUDED.airline,
                    departure_airport = EXCLUDED.departure_airport,
                    arrival_airport = EXCLUDED.arrival_airport,
                    departure_time = EXCLUDED.departure_time,
                    arrival_time = EXCLUDED.arrival_time,
                    pnr_code = EXCLUDED.pnr_code,
                    seats_allocated = EXCLUDED.seats_allocated,
                    cost_per_seat = EXCLUDED.cost_per_seat,
                    total_cost = EXCLUDED.total_cost,
                    currency = EXCLUDED.currency,
                    status = EXCLUDED.status,
                    delay_minutes = EXCLUDED.delay_minutes,
                    notes = EXCLUDED.notes,
                    updated_at = NOW()
                """
            ),
            {
                "id": str(fid),
                "tenant": str(self.tenant_id),
                "trip": trip_id,
                "flight_number": str(payload.get("flight_number") or "").strip().upper()[:32],
                "airline": str(payload.get("airline") or "").strip()[:120],
                "dep_airport": str(payload.get("departure_airport") or "").strip().upper()[:8],
                "arr_airport": str(payload.get("arrival_airport") or "").strip().upper()[:8],
                "dep_time": dep,
                "arr_time": arr,
                "pnr": (str(payload.get("pnr_code") or "").strip().upper() or None),
                "seats": max(seats, 0),
                "cps": cost_per,
                "total": total,
                "currency": str(payload.get("currency") or "EUR").strip().upper()[:3],
                "status": str(payload.get("status") or "scheduled").strip().lower()[:32],
                "delay": int(payload.get("delay_minutes") or 0),
                "notes": payload.get("notes"),
            },
        )
        await self._audit("hybrid.flight_upserted", "flight", str(fid), metadata={"trip_id": trip_id})
        flights = await self.list_flights(trip_id)
        return next(f for f in flights if f.id == fid)

    async def delete_flight(self, trip_id: int, flight_id: UUID) -> None:
        await self._bind_tenant_rls()
        await self.session.execute(
            text(
                """
                DELETE FROM flights
                WHERE tenant_id = :tenant AND trip_id = :trip AND id = :id
                """
            ),
            {"tenant": str(self.tenant_id), "trip": trip_id, "id": str(flight_id)},
        )
        await self._audit("hybrid.flight_deleted", "flight", str(flight_id), metadata={"trip_id": trip_id})

    # ----------------------------------------------------------------- segments
    async def list_segments(self, trip_id: int) -> list[SegmentRecord]:
        await self._bind_tenant_rls()
        result = await self.session.execute(
            text(
                """
                SELECT id, trip_id, sequence, segment_type, title, starts_at, ends_at,
                       flight_id, vehicle_ref, origin_label, destination_label,
                       ground_cost, currency, metadata
                FROM trip_segments
                WHERE tenant_id = :tenant AND trip_id = :trip
                ORDER BY sequence ASC, starts_at ASC NULLS LAST
                """
            ),
            {"tenant": str(self.tenant_id), "trip": trip_id},
        )
        return [self._row_to_segment(r) for r in result.mappings().all()]

    async def replace_segments(self, trip_id: int, segments: list[dict[str, Any]]) -> list[SegmentRecord]:
        await self.ensure_trip_row(trip_id)
        await self._bind_tenant_rls()
        await self.session.execute(
            text("DELETE FROM trip_segments WHERE tenant_id = :tenant AND trip_id = :trip"),
            {"tenant": str(self.tenant_id), "trip": trip_id},
        )
        ordered = sorted(segments or [], key=lambda s: int(s.get("sequence") or 0))
        for idx, raw in enumerate(ordered):
            seg_type = str(raw.get("segment_type") or "other").strip().lower()
            if seg_type not in SEGMENT_TYPES:
                seg_type = "other"
            sid = UUID(str(raw["id"])) if raw.get("id") else uuid4()
            flight_id = raw.get("flight_id")
            meta = raw.get("metadata") if isinstance(raw.get("metadata"), dict) else {}
            await self.session.execute(
                text(
                    """
                    INSERT INTO trip_segments (
                        id, tenant_id, trip_id, sequence, segment_type, title,
                        starts_at, ends_at, flight_id, vehicle_ref, origin_label,
                        destination_label, ground_cost, currency, metadata,
                        created_at, updated_at
                    ) VALUES (
                        :id, :tenant, :trip, :seq, :stype, :title,
                        :starts, :ends, :flight_id, :vehicle, :origin,
                        :dest, :gcost, :currency, CAST(:meta AS jsonb),
                        NOW(), NOW()
                    )
                    """
                ),
                {
                    "id": str(sid),
                    "tenant": str(self.tenant_id),
                    "trip": trip_id,
                    "seq": int(raw.get("sequence") if raw.get("sequence") is not None else idx),
                    "stype": seg_type,
                    "title": str(raw.get("title") or seg_type.replace("_", " ").title())[:255],
                    "starts": _parse_dt(raw.get("starts_at")),
                    "ends": _parse_dt(raw.get("ends_at")),
                    "flight_id": str(flight_id) if flight_id else None,
                    "vehicle": (str(raw.get("vehicle_ref") or "").strip() or None),
                    "origin": (str(raw.get("origin_label") or "").strip() or None),
                    "dest": (str(raw.get("destination_label") or "").strip() or None),
                    "gcost": _dec(raw.get("ground_cost")),
                    "currency": str(raw.get("currency") or "EUR").strip().upper()[:3],
                    "meta": json.dumps(meta),
                },
            )
        await self._audit("hybrid.segments_replaced", "trip", str(trip_id), metadata={"count": len(ordered)})
        return await self.list_segments(trip_id)

    async def get_hybrid_trip(self, trip_id: int) -> dict[str, Any]:
        flights = await self.list_flights(trip_id)
        segments = await self.list_segments(trip_id)
        seats = await self.list_passenger_seats(trip_id)
        luggage = await self.list_luggage(trip_id)
        return {
            "trip_id": trip_id,
            "flights": [f.to_dict() for f in flights],
            "segments": [s.to_dict() for s in segments],
            "passenger_seats": seats,
            "luggage": luggage,
            "cost_summary": self.calculate_yield(
                flights=[f.to_dict() for f in flights],
                segments=[s.to_dict() for s in segments],
                passenger_count=max((f.seats_allocated for f in flights), default=0)
                or max(len(seats), 1),
            ),
        }

    # --------------------------------------------------------- passenger seats
    async def list_passenger_seats(self, trip_id: int) -> list[dict[str, Any]]:
        await self._bind_tenant_rls()
        result = await self.session.execute(
            text(
                """
                SELECT id, trip_id, flight_id, booking_id, passenger_name,
                       ground_seat, flight_seat, ticket_code, pnr_code
                FROM passenger_flight_seats
                WHERE tenant_id = :tenant AND trip_id = :trip
                ORDER BY passenger_name ASC
                """
            ),
            {"tenant": str(self.tenant_id), "trip": trip_id},
        )
        rows = []
        for r in result.mappings().all():
            rows.append(
                {
                    "id": str(r["id"]),
                    "trip_id": r["trip_id"],
                    "flight_id": str(r["flight_id"]),
                    "booking_id": r["booking_id"],
                    "passenger_name": r["passenger_name"],
                    "ground_seat": r["ground_seat"],
                    "flight_seat": r["flight_seat"],
                    "ticket_code": r["ticket_code"],
                    "pnr_code": r["pnr_code"],
                }
            )
        return rows

    async def upsert_passenger_seat(self, trip_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        await self.ensure_trip_row(trip_id)
        await self._bind_tenant_rls()
        sid = UUID(str(payload["id"])) if payload.get("id") else uuid4()
        await self.session.execute(
            text(
                """
                INSERT INTO passenger_flight_seats (
                    id, tenant_id, trip_id, flight_id, booking_id, passenger_name,
                    ground_seat, flight_seat, ticket_code, pnr_code, created_at, updated_at
                ) VALUES (
                    :id, :tenant, :trip, :flight_id, :booking_id, :name,
                    :ground, :air, :ticket, :pnr, NOW(), NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    flight_id = EXCLUDED.flight_id,
                    booking_id = EXCLUDED.booking_id,
                    passenger_name = EXCLUDED.passenger_name,
                    ground_seat = EXCLUDED.ground_seat,
                    flight_seat = EXCLUDED.flight_seat,
                    ticket_code = EXCLUDED.ticket_code,
                    pnr_code = EXCLUDED.pnr_code,
                    updated_at = NOW()
                """
            ),
            {
                "id": str(sid),
                "tenant": str(self.tenant_id),
                "trip": trip_id,
                "flight_id": str(payload["flight_id"]),
                "booking_id": payload.get("booking_id"),
                "name": str(payload.get("passenger_name") or "").strip()[:255],
                "ground": payload.get("ground_seat"),
                "air": payload.get("flight_seat"),
                "ticket": payload.get("ticket_code"),
                "pnr": payload.get("pnr_code"),
            },
        )
        seats = await self.list_passenger_seats(trip_id)
        return next(s for s in seats if s["id"] == str(sid))

    # ----------------------------------------------------------------- luggage
    async def list_luggage(self, trip_id: int) -> list[dict[str, Any]]:
        await self._bind_tenant_rls()
        result = await self.session.execute(
            text(
                """
                SELECT id, trip_id, booking_id, passenger_name, checkin_status,
                       luggage_count, luggage_notes, checked_by, checked_at
                FROM luggage_checkins
                WHERE tenant_id = :tenant AND trip_id = :trip
                ORDER BY passenger_name ASC
                """
            ),
            {"tenant": str(self.tenant_id), "trip": trip_id},
        )
        out = []
        for r in result.mappings().all():
            out.append(
                {
                    "id": str(r["id"]),
                    "trip_id": r["trip_id"],
                    "booking_id": r["booking_id"],
                    "passenger_name": r["passenger_name"],
                    "checkin_status": r["checkin_status"],
                    "luggage_count": int(r["luggage_count"] or 0),
                    "luggage_notes": r["luggage_notes"],
                    "checked_by": r["checked_by"],
                    "checked_at": _iso(r["checked_at"]),
                }
            )
        return out

    async def upsert_luggage(self, trip_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        await self.ensure_trip_row(trip_id)
        await self._bind_tenant_rls()
        lid = UUID(str(payload["id"])) if payload.get("id") else uuid4()
        status = str(payload.get("checkin_status") or "pending").strip().lower()
        checked_at = _parse_dt(payload.get("checked_at"))
        if status in {"checked_in", "boarded"} and not checked_at:
            checked_at = datetime.now(timezone.utc)
        await self.session.execute(
            text(
                """
                INSERT INTO luggage_checkins (
                    id, tenant_id, trip_id, booking_id, passenger_name,
                    checkin_status, luggage_count, luggage_notes, checked_by,
                    checked_at, created_at, updated_at
                ) VALUES (
                    :id, :tenant, :trip, :booking_id, :name,
                    :status, :count, :notes, :by, :at, NOW(), NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    booking_id = EXCLUDED.booking_id,
                    passenger_name = EXCLUDED.passenger_name,
                    checkin_status = EXCLUDED.checkin_status,
                    luggage_count = EXCLUDED.luggage_count,
                    luggage_notes = EXCLUDED.luggage_notes,
                    checked_by = EXCLUDED.checked_by,
                    checked_at = EXCLUDED.checked_at,
                    updated_at = NOW()
                """
            ),
            {
                "id": str(lid),
                "tenant": str(self.tenant_id),
                "trip": trip_id,
                "booking_id": payload.get("booking_id"),
                "name": str(payload.get("passenger_name") or "").strip()[:255],
                "status": status[:32],
                "count": max(int(payload.get("luggage_count") or 0), 0),
                "notes": payload.get("luggage_notes"),
                "by": payload.get("checked_by"),
                "at": checked_at,
            },
        )
        items = await self.list_luggage(trip_id)
        return next(i for i in items if i["id"] == str(lid))

    # ----------------------------------------------------------- delay monitor
    async def _fetch_aviationstack_status(self, row: Any) -> tuple[str, int, dict[str, Any]]:
        """Live Aviationstack lookup. Returns (status, delay_minutes, raw)."""
        import httpx

        api_key = os.getenv("AVIATIONSTACK_API_KEY") or ""
        flight_iata = str(row["flight_number"] or "").replace(" ", "").upper()
        params: dict[str, Any] = {"access_key": api_key, "flight_iata": flight_iata, "limit": 1}
        dep = str(row["departure_airport"] or "").upper()
        if dep:
            params["dep_iata"] = dep
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get("https://api.aviationstack.com/v1/flights", params=params)
            resp.raise_for_status()
            data = resp.json()
        items = data.get("data") or []
        if not items:
            return "scheduled", 0, {"provider": "aviationstack", "empty": True, "flight_iata": flight_iata}
        item = items[0]
        live = item.get("live") or {}
        dep_info = item.get("departure") or {}
        delay = int(dep_info.get("delay") or live.get("delay") or 0)
        raw_status = str(item.get("flight_status") or "scheduled").lower()
        status_map = {
            "scheduled": "scheduled",
            "active": "active",
            "landed": "landed",
            "cancelled": "cancelled",
            "incident": "incident",
            "diverted": "diverted",
        }
        status = status_map.get(raw_status, raw_status)
        if delay > 0 and status in {"scheduled", "active"}:
            status = "delayed"
        return status, max(delay, 0), {"provider": "aviationstack", "flight": item}

    async def poll_flight_status(self, flight_id: UUID) -> dict[str, Any]:
        """
        Flight status poll. Uses Aviationstack when AVIATIONSTACK_API_KEY is set;
        otherwise a deterministic stub for connection-monitor UX.
        """
        await self._bind_tenant_rls()
        result = await self.session.execute(
            text(
                """
                SELECT id, trip_id, flight_number, departure_airport, arrival_airport,
                       departure_time, status, delay_minutes
                FROM flights
                WHERE tenant_id = :tenant AND id = :id
                """
            ),
            {"tenant": str(self.tenant_id), "id": str(flight_id)},
        )
        row = result.mappings().first()
        if not row:
            raise ValueError("Flight not found")

        api_key = os.getenv("AVIATIONSTACK_API_KEY")
        provider = "aviationstack" if api_key else "stub"
        delay = int(row["delay_minutes"] or 0)
        status = row["status"] or "scheduled"
        payload: dict[str, Any] = {
            "flight_number": row["flight_number"],
            "departure_airport": row["departure_airport"],
            "arrival_airport": row["arrival_airport"],
            "provider": provider,
        }

        if provider == "aviationstack":
            try:
                status, delay, raw = await self._fetch_aviationstack_status(row)
                payload.update(raw)
            except Exception as exc:  # noqa: BLE001 — fall back to stub on provider errors
                provider = "stub_fallback"
                payload["aviationstack_error"] = str(exc)[:300]
                if delay == 0:
                    delay = (sum(ord(c) for c in str(row["flight_number"])) % 4) * 15
                    if delay:
                        status = "delayed"
        elif delay == 0:
            # Deterministic demo delay for connection monitoring UX (0–45 by flight hash).
            delay = (sum(ord(c) for c in str(row["flight_number"])) % 4) * 15
            if delay:
                status = "delayed"
            payload["note"] = "Set AVIATIONSTACK_API_KEY for live flight status."

        suggested = delay  # 1:1 pickup shift for delayed inbound flights
        event_id = uuid4()
        await self.session.execute(
            text(
                """
                INSERT INTO flight_status_events (
                    id, tenant_id, flight_id, provider, status, delay_minutes,
                    suggested_pickup_adjustment_minutes, raw_payload, created_at
                ) VALUES (
                    :id, :tenant, :flight_id, :provider, :status, :delay,
                    :suggested, CAST(:raw AS jsonb), NOW()
                )
                """
            ),
            {
                "id": str(event_id),
                "tenant": str(self.tenant_id),
                "flight_id": str(flight_id),
                "provider": provider,
                "status": status,
                "delay": delay,
                "suggested": suggested,
                "raw": json.dumps(payload, default=str),
            },
        )
        await self.session.execute(
            text(
                """
                UPDATE flights
                SET status = :status, delay_minutes = :delay, updated_at = NOW()
                WHERE tenant_id = :tenant AND id = :id
                """
            ),
            {
                "status": status,
                "delay": delay,
                "tenant": str(self.tenant_id),
                "id": str(flight_id),
            },
        )
        return {
            "event_id": str(event_id),
            "flight_id": str(flight_id),
            "trip_id": row["trip_id"],
            "provider": provider,
            "status": status,
            "delay_minutes": delay,
            "suggested_pickup_adjustment_minutes": suggested,
            "message": (
                f"Flight {row['flight_number']} is {status}"
                + (f" (+{delay} min). Adjust ground pickup by {suggested} min." if delay else ".")
            ),
        }

    async def queue_delay_notifications(
        self,
        flight_id: UUID,
        *,
        trip_id: int | None = None,
        delay_minutes: int = 0,
        channels: list[str] | None = None,
        recipients: list[dict[str, Any]] | None = None,
        trip_title: str | None = None,
    ) -> dict[str, Any]:
        """
        Queue SMS/WhatsApp/email passenger delay alerts.
        Uses Twilio when TWILIO_* env vars are set; otherwise logs stubs.
        """
        from travel_platform.notifications.dispatcher import dispatch_delay_alerts

        await self._bind_tenant_rls()
        result = await self.session.execute(
            text(
                """
                SELECT id, trip_id, flight_number, delay_minutes, status
                FROM flights
                WHERE tenant_id = :tenant AND id = :id
                """
            ),
            {"tenant": str(self.tenant_id), "id": str(flight_id)},
        )
        row = result.mappings().first()
        if not row:
            raise ValueError("Flight not found")

        delay = int(delay_minutes or row["delay_minutes"] or 0)
        chans = [c for c in (channels or ["sms", "whatsapp"]) if c in {"sms", "whatsapp", "email", "push"}]
        if not chans:
            chans = ["sms"]
        event_id = uuid4()
        dispatch_result = await dispatch_delay_alerts(
            recipients=recipients or [],
            flight_number=row["flight_number"],
            delay_minutes=delay,
            channels=chans,
            trip_title=trip_title,
        )
        payload = {
            "type": "delay_notify",
            "channels": chans,
            "flight_number": row["flight_number"],
            "delay_minutes": delay,
            "trip_id": trip_id or row["trip_id"],
            "dispatch": dispatch_result,
            "provider": "twilio" if os.getenv("TWILIO_ACCOUNT_SID") else "notify_stub",
        }
        await self.session.execute(
            text(
                """
                INSERT INTO flight_status_events (
                    id, tenant_id, flight_id, provider, status, delay_minutes,
                    suggested_pickup_adjustment_minutes, raw_payload, created_at
                ) VALUES (
                    :id, :tenant, :flight_id, :provider, :status, :delay,
                    :suggested, CAST(:raw AS jsonb), NOW()
                )
                """
            ),
            {
                "id": str(event_id),
                "tenant": str(self.tenant_id),
                "flight_id": str(flight_id),
                "provider": payload["provider"],
                "status": row["status"] or "delayed",
                "delay": delay,
                "suggested": delay,
                "raw": json.dumps(payload, default=str),
            },
        )
        return {
            "queued": True,
            "event_id": str(event_id),
            "flight_id": str(flight_id),
            "trip_id": trip_id or row["trip_id"],
            "channels": chans,
            "delay_minutes": delay,
            "dispatch": dispatch_result,
            "message": (
                f"Queued {', '.join(chans)} delay notice for {row['flight_number']}"
                + (f" (+{delay} min)." if delay else ".")
                + (f" Recipients: {dispatch_result.get('sent', 0)}." if recipients else " (no recipients — audit only).")
            ),
        }

    # ----------------------------------------------------------- cost / yield
    @staticmethod
    def calculate_yield(
        *,
        flights: list[dict[str, Any]],
        segments: list[dict[str, Any]],
        passenger_count: int,
        target_margin_pct: float = 25.0,
        fx_rates_to_eur: dict[str, float] | None = None,
        display_currency: str = "EUR",
    ) -> dict[str, Any]:
        rates = {"EUR": 1.0, "USD": 0.92, "GBP": 1.17, "CHF": 1.05, "TRY": 0.028}
        if fx_rates_to_eur:
            rates.update({k.upper(): float(v) for k, v in fx_rates_to_eur.items()})

        def to_eur(amount: Any, currency: str) -> float:
            cur = (currency or "EUR").upper()
            rate = rates.get(cur, 1.0)
            return float(_dec(amount)) * rate

        flight_cost_eur = sum(to_eur(f.get("total_cost"), f.get("currency", "EUR")) for f in flights or [])
        ground_cost_eur = sum(to_eur(s.get("ground_cost"), s.get("currency", "EUR")) for s in segments or [])
        total_cost_eur = flight_cost_eur + ground_cost_eur
        pax = max(int(passenger_count or 0), 1)
        margin = max(float(target_margin_pct or 0), 0)
        target_revenue_eur = total_cost_eur * (1 + margin / 100.0)
        per_person_eur = target_revenue_eur / pax

        display = (display_currency or "EUR").upper()
        # Invert EUR rate to display currency (approx).
        from_eur = 1.0 / rates.get(display, 1.0) if rates.get(display, 1.0) else 1.0

        def convert(amount_eur: float) -> float:
            return round(amount_eur * from_eur, 2)

        return {
            "passenger_count": pax,
            "target_margin_pct": margin,
            "base_currency": "EUR",
            "display_currency": display,
            "flight_cost": convert(flight_cost_eur),
            "ground_cost": convert(ground_cost_eur),
            "total_cost": convert(total_cost_eur),
            "target_revenue": convert(target_revenue_eur),
            "recommended_price_per_person": convert(per_person_eur),
            "fx_rates_to_eur": rates,
        }

    def _row_to_flight(self, r: Any) -> FlightRecord:
        return FlightRecord(
            id=r["id"] if isinstance(r["id"], UUID) else UUID(str(r["id"])),
            trip_id=int(r["trip_id"]),
            flight_number=r["flight_number"],
            airline=r["airline"] or "",
            departure_airport=r["departure_airport"],
            arrival_airport=r["arrival_airport"],
            departure_time=r["departure_time"],
            arrival_time=r["arrival_time"],
            pnr_code=r["pnr_code"],
            seats_allocated=int(r["seats_allocated"] or 0),
            cost_per_seat=_dec(r["cost_per_seat"]),
            total_cost=_dec(r["total_cost"]),
            currency=r["currency"] or "EUR",
            status=r["status"] or "scheduled",
            delay_minutes=int(r["delay_minutes"] or 0),
            notes=r["notes"],
        )

    def _row_to_segment(self, r: Any) -> SegmentRecord:
        meta = r["metadata"] or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except json.JSONDecodeError:
                meta = {}
        fid = r["flight_id"]
        return SegmentRecord(
            id=r["id"] if isinstance(r["id"], UUID) else UUID(str(r["id"])),
            trip_id=int(r["trip_id"]),
            sequence=int(r["sequence"] or 0),
            segment_type=r["segment_type"],
            title=r["title"] or "",
            starts_at=r["starts_at"],
            ends_at=r["ends_at"],
            flight_id=(fid if isinstance(fid, UUID) else UUID(str(fid))) if fid else None,
            vehicle_ref=r["vehicle_ref"],
            origin_label=r["origin_label"],
            destination_label=r["destination_label"],
            ground_cost=_dec(r["ground_cost"]),
            currency=r["currency"] or "EUR",
            metadata=meta if isinstance(meta, dict) else {},
        )
