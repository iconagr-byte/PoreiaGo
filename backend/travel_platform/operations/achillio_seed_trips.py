"""Seed PoreiaGo demo-style excursions into the Achillio Travel office catalog.

Idempotent upsert by stable ids (91001+) — never wipes other Achillio trips.
Marked officeSeed so frontend stripDemoTrips keeps them.

Departure times roll forward from UTC «tomorrow» so wallet passes stay boardable
(My Wallet expires tickets 12h after departure — fixed June-2026 dates looked
«out of sync» with the office once the calendar moved on).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

# Stable ids — reserved for Achillio Travel starter catalog.
ACHILLIO_SEED_TRIP_IDS = frozenset({91001, 91002, 91003})

# (day_offset from tomorrow, dep HH:MM UTC, duration hours)
_SEED_SCHEDULE = (
    (0, "08:00", 4.5),   # Μετέωρα — tomorrow 08:00
    (1, "10:00", 6.0),   # Αθήνα
    (2, "09:00", 2.75),  # Ιωάννινα
)


def _utc_at(day_offset: int, hhmm: str) -> datetime:
    hour, minute = (int(x) for x in hhmm.split(":", 1))
    base = datetime.now(timezone.utc).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    )
    # Always start from tomorrow so «today 08:00» never goes stale mid-morning.
    return base + timedelta(days=1 + int(day_offset))


def _iso_z(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def achillio_seed_trip_catalog(
    *,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    """Domestic showcase trips matching PoreiaGo marketing cards (Μετέωρα / Αθήνα / Ιωάννινα)."""
    # `now` kept for tests; schedule always anchors on UTC clock (+ tomorrow).
    _ = now
    met_dep = _utc_at(*_SEED_SCHEDULE[0][:2])
    met_arr = met_dep + timedelta(hours=_SEED_SCHEDULE[0][2])
    ath_dep = _utc_at(*_SEED_SCHEDULE[1][:2])
    ath_arr = ath_dep + timedelta(hours=_SEED_SCHEDULE[1][2])
    ioa_dep = _utc_at(*_SEED_SCHEDULE[2][:2])
    ioa_arr = ioa_dep + timedelta(hours=_SEED_SCHEDULE[2][2])

    return [
        {
            "id": 91001,
            "officeSeed": True,
            "catalogSource": "office_seed",
            "market": "domestic",
            "status": "published",
            "title": "Ημερήσια στα Μετέωρα",
            "destination": "Μετέωρα · Καλαμπάκα",
            "departureTime": _iso_z(met_dep),
            "arrivalTime": _iso_z(met_arr),
            "price": 45.0,
            "availableSeats": 12,
            "totalSeats": 30,
            "vehicleType": "Luxury Coach",
            "image": "/images/meteora.png",
            "images": [
                "/images/meteora.png",
                "/images/demo/meteora-2.jpg",
                "/images/demo/meteora-3.jpg",
            ],
            "hook": "Ανακαλύψτε τη μαγεία των βράχων",
            "durationLabel": "Ημερήσια",
            "badge": "Δημοφιλές",
            "featured": True,
            "description": (
                "Μια μαγευτική διαδρομή προς τα επιβλητικά Μετέωρα. "
                "Απολαύστε το ταξίδι με την άνεση του Luxury Coach, με δωρεάν Wi-Fi "
                "και αναπαυτικά καθίσματα."
            ),
            "meetingPoint": "Πλατεία Συντάγματος (Αφετηρία)",
            "stops": [
                {
                    "id": 101,
                    "name": "Πλατεία Συντάγματος (Αφετηρία)",
                    "lat": 37.9753,
                    "lng": 23.7361,
                    "time": met_dep.strftime("%H:%M"),
                    "image": "/images/athens.png",
                    "description": "Σημείο συνάντησης στο κέντρο της Αθήνας.",
                },
                {
                    "id": 102,
                    "name": "Θερμοπύλες (Μνημείο Λεωνίδα)",
                    "lat": 38.7967,
                    "lng": 22.5355,
                    "time": (met_dep + timedelta(hours=2, minutes=15)).strftime("%H:%M"),
                    "description": "Σύντομη στάση για καφέ και φωτογραφίες.",
                },
                {
                    "id": 104,
                    "name": "Καλαμπάκα (Μετέωρα)",
                    "lat": 39.7044,
                    "lng": 21.6267,
                    "time": met_arr.strftime("%H:%M"),
                    "image": "/images/meteora.png",
                    "description": "Άφιξη και περιήγηση στα μοναστήρια.",
                },
            ],
            "currency": "EUR",
        },
        {
            "id": 91002,
            "officeSeed": True,
            "catalogSource": "office_seed",
            "market": "domestic",
            "status": "published",
            "title": "Απόδραση στην Πρωτεύουσα",
            "destination": "Αθήνα",
            "departureTime": _iso_z(ath_dep),
            "arrivalTime": _iso_z(ath_arr),
            "price": 35.0,
            "availableSeats": 5,
            "totalSeats": 30,
            "vehicleType": "Premium Express",
            "image": "/images/athens.png",
            "images": [
                "/images/athens.png",
                "/images/demo/athens-2.jpg",
                "/images/demo/athens-3.jpg",
            ],
            "hook": "Ταξίδι Express στην πρωτεύουσα",
            "durationLabel": "Ημερήσια",
            "badge": "Express",
            "featured": True,
            "description": (
                "Express δρομολόγιο προς την Αθήνα. Γρήγορο, ασφαλές και ξεκούραστο "
                "ταξίδι με τον Premium Express στόλο."
            ),
            "meetingPoint": "Πλατεία Αριστοτέλους (Αφετηρία)",
            "stops": [
                {
                    "id": 201,
                    "name": "Πλατεία Αριστοτέλους (Αφετηρία)",
                    "lat": 40.6322,
                    "lng": 22.9405,
                    "time": ath_dep.strftime("%H:%M"),
                },
                {
                    "id": 202,
                    "name": "Λιτόχωρο (Στάση για καφέ)",
                    "lat": 40.1011,
                    "lng": 22.5020,
                    "time": (ath_dep + timedelta(hours=1, minutes=15)).strftime("%H:%M"),
                },
                {
                    "id": 204,
                    "name": "Πλατεία Συντάγματος (Τερματικός)",
                    "lat": 37.9753,
                    "lng": 23.7361,
                    "time": ath_arr.strftime("%H:%M"),
                    "image": "/images/athens.png",
                },
            ],
            "currency": "EUR",
        },
        {
            "id": 91003,
            "officeSeed": True,
            "catalogSource": "office_seed",
            "market": "domestic",
            "status": "published",
            "title": "Μαγευτικά Ιωάννινα",
            "destination": "Ιωάννινα",
            "departureTime": _iso_z(ioa_dep),
            "arrivalTime": _iso_z(ioa_arr),
            "price": 28.0,
            "availableSeats": 22,
            "totalSeats": 30,
            "vehicleType": "Luxury Coach",
            "image": "/images/ioannina.png",
            "images": [
                "/images/ioannina.png",
                "/images/demo/ioannina-2.jpg",
                "/images/demo/ioannina-3.jpg",
            ],
            "hook": "Απόδραση στη μαγευτική λίμνη",
            "durationLabel": "Ημερήσια",
            "badge": "",
            "featured": False,
            "description": (
                "Ταξιδέψτε προς την Ήπειρο και απολαύστε τη λίμνη των Ιωαννίνων "
                "με άνετο Luxury Coach."
            ),
            "meetingPoint": "Μαρίνα Πάτρας (Αφετηρία)",
            "stops": [
                {
                    "id": 301,
                    "name": "Μαρίνα Πάτρας (Αφετηρία)",
                    "lat": 38.2466,
                    "lng": 21.7346,
                    "time": ioa_dep.strftime("%H:%M"),
                },
                {
                    "id": 302,
                    "name": "Γέφυρα Ρίου-Αντιρρίου",
                    "lat": 38.3180,
                    "lng": 21.7735,
                    "time": (ioa_dep + timedelta(minutes=30)).strftime("%H:%M"),
                },
                {
                    "id": 303,
                    "name": "Λίμνη Ιωαννίνων",
                    "lat": 39.6645,
                    "lng": 20.8521,
                    "time": ioa_arr.strftime("%H:%M"),
                    "image": "/images/ioannina.png",
                },
            ],
            "currency": "EUR",
        },
    ]


def _seed_departure_stale(departure_iso: str | None, *, grace_hours: float = 12) -> bool:
    """True when a stored seed departure is already past wallet boarding grace."""
    raw = str(departure_iso or "").strip()
    if not raw:
        return True
    try:
        dep = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return True
    if dep.tzinfo is None:
        dep = dep.replace(tzinfo=timezone.utc)
    limit = dep + timedelta(hours=max(0.0, float(grace_hours)))
    return datetime.now(timezone.utc) > limit


def seed_catalog_needs_refresh(trips: list[dict[str, Any]] | None) -> bool:
    """Any Achillio officeSeed trip past boarding grace → re-roll departures."""
    rows = trips or []
    seed_rows = [
        t
        for t in rows
        if t.get("id") in ACHILLIO_SEED_TRIP_IDS or t.get("officeSeed")
    ]
    if not seed_rows:
        return False
    return any(_seed_departure_stale(t.get("departureTime")) for t in seed_rows)


def seed_achillio_office_excursions(tenant_id: str | None) -> dict[str, Any]:
    """
    Upsert starter excursions into Achillio Travel's durable trip catalog.
    Safe to call repeatedly — merges by id, does not delete other trips.
    """
    tid = str(tenant_id or "").strip()
    if not tid:
        return {"saved": 0, "skipped": True, "reason": "missing_tenant_id"}

    from travel_platform.operations.tenant_trip_catalog_store import upsert_tenant_trips

    trips = achillio_seed_trip_catalog()
    saved = upsert_tenant_trips(tid, trips)
    logger.info(
        "Achillio office seed trips upserted tenant=%s saved=%s ids=%s deps=%s",
        tid,
        saved,
        sorted(ACHILLIO_SEED_TRIP_IDS),
        [t.get("departureTime") for t in trips],
    )
    return {
        "saved": saved,
        "skipped": False,
        "trip_ids": sorted(ACHILLIO_SEED_TRIP_IDS),
        "trips": [
            {
                "id": t["id"],
                "title": t["title"],
                "departureTime": t["departureTime"],
                "arrivalTime": t["arrivalTime"],
            }
            for t in trips
        ],
    }


def refresh_achillio_seed_if_stale(tenant_id: str | None) -> dict[str, Any]:
    """
    Re-upsert rolling seed departures when catalog rows are past wallet grace.
    Cheap no-op when dates are still boardable — safe on every /api/site/trips hit.
    """
    tid = str(tenant_id or "").strip()
    if not tid:
        return {"refreshed": False, "reason": "missing_tenant_id"}

    from travel_platform.operations.tenant_trip_catalog_store import list_tenant_trips

    existing = list_tenant_trips(tid, published_only=False)
    seed_existing = [t for t in existing if t.get("id") in ACHILLIO_SEED_TRIP_IDS]
    if seed_existing and not seed_catalog_needs_refresh(seed_existing):
        return {"refreshed": False, "saved": 0}
    result = seed_achillio_office_excursions(tid)
    return {
        "refreshed": True,
        "saved": int(result.get("saved") or 0),
        "trips": result.get("trips") or [],
    }


async def refresh_achillio_seed_and_heal_bookings(tenant_id: str | None) -> dict[str, Any]:
    """Catalog refresh + Postgres booking departure heal (wallet remirror)."""
    tid = str(tenant_id or "").strip()
    if not tid:
        return {"refreshed": False, "healed": 0}
    refresh = refresh_achillio_seed_if_stale(tid)
    if not refresh.get("refreshed"):
        return {**refresh, "healed": 0}
    try:
        from app.core.database import AsyncSessionLocal

        async with AsyncSessionLocal() as session:
            heal = await heal_achillio_seed_booking_departures(
                session,
                tenant_id=tid,
                trips=achillio_seed_trip_catalog(),
            )
        return {**refresh, "healed": int(heal.get("updated") or 0)}
    except Exception:
        logger.exception("Achillio seed booking heal after catalog refresh failed")
        return {**refresh, "healed": 0, "heal_error": True}


def _booking_skip_departure_heal(meta: dict[str, Any], booking: Any) -> bool:
    """Skip cancelled / boarded seed bookings — never invent a future live pass."""
    status = str(getattr(booking, "status", "") or meta.get("status") or "").strip().lower()
    if status in {"cancelled", "canceled", "ακυρωμένη", "ακυρωμενη"}:
        return True
    if meta.get("checked_in") is True:
        return True
    check = str(meta.get("check_in_status") or "").upper()
    return check in {"CHECKED_IN", "BOARDED"}


async def heal_achillio_seed_booking_departures(
    session,
    *,
    tenant_id: str,
    trips: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Push rolling seed departure times onto existing Postgres bookings for
    trips 91001–91003 so My Wallet stops showing «Ληγμένη» for June demos.

    Skips cancelled / already boarded rows so we never resurrect a finished
    check-in with a live QR on a future date.
    """
    from sqlalchemy import select, text

    from api.admin_booking_mapper import booking_to_admin_dict
    from app.core.tenant_rls import apply_tenant_rls
    from app.models.booking import Booking
    from ticketing.wallet_booking_reconcile import mirror_admin_booking_to_wallet

    tid = str(tenant_id or "").strip()
    catalog = trips or achillio_seed_trip_catalog()
    by_id = {int(t["id"]): t for t in catalog if t.get("id") in ACHILLIO_SEED_TRIP_IDS}
    if not tid or not by_id:
        return {"updated": 0, "mirrored": 0, "skipped_boarded": 0}

    try:
        from uuid import UUID

        tenant_uuid = UUID(tid)
    except ValueError:
        return {"updated": 0, "mirrored": 0, "skipped_boarded": 0, "reason": "bad_tenant"}

    # Forced RLS on bookings needs tenant GUC (commit earlier cleared SET LOCAL).
    try:
        await apply_tenant_rls(session, tenant_uuid)
    except Exception:
        logger.debug("apply_tenant_rls for seed heal failed", exc_info=True)
    try:
        await session.execute(text("SET LOCAL row_security = off"))
    except Exception:
        logger.debug("row_security off for seed heal failed", exc_info=True)

    result = await session.execute(
        select(Booking).where(Booking.tenant_id == tenant_uuid)
    )
    rows = list(result.scalars().all())
    updated = 0
    mirrored = 0
    skipped_boarded = 0
    for booking in rows:
        meta = dict(booking.metadata_json or {})
        raw_tid = meta.get("external_trip_id") or meta.get("trip_id") or booking.trip_id
        try:
            trip_id = int(raw_tid)
        except (TypeError, ValueError):
            continue
        trip = by_id.get(trip_id)
        if not trip:
            continue
        if _booking_skip_departure_heal(meta, booking):
            skipped_boarded += 1
            continue
        dep = str(trip.get("departureTime") or "")
        if not dep:
            continue
        if str(meta.get("departure_at") or "") == dep:
            continue
        meta["departure_at"] = dep
        meta["trip_title"] = trip.get("title") or meta.get("trip_title")
        booking.metadata_json = meta
        updated += 1
        try:
            await mirror_admin_booking_to_wallet(booking_to_admin_dict(booking))
            mirrored += 1
        except Exception:
            logger.debug(
                "heal seed booking wallet mirror skipped id=%s",
                booking.id,
                exc_info=True,
            )

    if updated:
        await session.commit()
    logger.info(
        "Achillio seed booking departures healed tenant=%s updated=%s mirrored=%s skipped_boarded=%s",
        tid,
        updated,
        mirrored,
        skipped_boarded,
    )
    return {
        "updated": updated,
        "mirrored": mirrored,
        "skipped_boarded": skipped_boarded,
    }
