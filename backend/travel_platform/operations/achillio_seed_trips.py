"""Seed PoreiaGo demo-style excursions into the Achillio Travel office catalog.

Idempotent upsert by stable ids (91001+) — never wipes other Achillio trips.
Marked officeSeed so frontend stripDemoTrips keeps them.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Stable ids — reserved for Achillio Travel starter catalog.
ACHILLIO_SEED_TRIP_IDS = frozenset({91001, 91002, 91003})


def achillio_seed_trip_catalog() -> list[dict[str, Any]]:
    """Domestic showcase trips matching PoreiaGo marketing cards (Μετέωρα / Αθήνα / Ιωάννινα)."""
    return [
        {
            "id": 91001,
            "officeSeed": True,
            "catalogSource": "office_seed",
            "market": "domestic",
            "status": "published",
            "title": "Ημερήσια στα Μετέωρα",
            "destination": "Μετέωρα · Καλαμπάκα",
            "departureTime": "2026-06-15T08:00:00Z",
            "arrivalTime": "2026-06-15T12:30:00Z",
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
                    "time": "08:00",
                    "image": "/images/athens.png",
                    "description": "Σημείο συνάντησης στο κέντρο της Αθήνας.",
                },
                {
                    "id": 102,
                    "name": "Θερμοπύλες (Μνημείο Λεωνίδα)",
                    "lat": 38.7967,
                    "lng": 22.5355,
                    "time": "10:15",
                    "description": "Σύντομη στάση για καφέ και φωτογραφίες.",
                },
                {
                    "id": 104,
                    "name": "Καλαμπάκα (Μετέωρα)",
                    "lat": 39.7044,
                    "lng": 21.6267,
                    "time": "12:30",
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
            "departureTime": "2026-06-16T10:00:00Z",
            "arrivalTime": "2026-06-16T16:00:00Z",
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
                    "time": "10:00",
                },
                {
                    "id": 202,
                    "name": "Λιτόχωρο (Στάση για καφέ)",
                    "lat": 40.1011,
                    "lng": 22.5020,
                    "time": "11:15",
                },
                {
                    "id": 204,
                    "name": "Πλατεία Συντάγματος (Τερματικός)",
                    "lat": 37.9753,
                    "lng": 23.7361,
                    "time": "16:00",
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
            "departureTime": "2026-06-17T09:00:00Z",
            "arrivalTime": "2026-06-17T11:45:00Z",
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
                    "time": "09:00",
                },
                {
                    "id": 302,
                    "name": "Γέφυρα Ρίου-Αντιρρίου",
                    "lat": 38.3180,
                    "lng": 21.7735,
                    "time": "09:30",
                },
                {
                    "id": 303,
                    "name": "Λίμνη Ιωαννίνων",
                    "lat": 39.6645,
                    "lng": 20.8521,
                    "time": "11:45",
                    "image": "/images/ioannina.png",
                },
            ],
            "currency": "EUR",
        },
    ]


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
        "Achillio office seed trips upserted tenant=%s saved=%s ids=%s",
        tid,
        saved,
        sorted(ACHILLIO_SEED_TRIP_IDS),
    )
    return {"saved": saved, "skipped": False, "trip_ids": sorted(ACHILLIO_SEED_TRIP_IDS)}
