"""Tablet rental checkout — terms + signature → ACTIVE contract."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from travel_platform.rental import rental_store as store


@pytest.fixture()
def isolated_rental(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "STORE_FILE", tmp_path / "rental_store.json")
    monkeypatch.setattr(store, "DATA_DIR", tmp_path)
    return tmp_path


def test_complete_rental_checkout_stamps_docs_and_activates(isolated_rental):
    tid = "cccccccc-dddd-eeee-ffff-000000000001"
    vehicle = store.upsert_vehicle(
        tid,
        {
            "plate_number": "KXZ1234",
            "category": "COMPACT",
            "model": "Toyota Yaris",
            "seating_capacity": 5,
            "daily_rate_eur": 45,
        },
    )
    start = datetime.now(timezone.utc)
    end = start + timedelta(days=2)
    booking = store.create_booking(
        tid,
        {
            "vehicle_id": vehicle["id"],
            "client_name": "Νίκος Πελάτης",
            "client_email": "nikos@example.com",
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "pickup_location": "Γραφείο",
            "total_cost": 90,
        },
    )
    # Confirm so ACTIVE transition is clean.
    store.update_booking_status(tid, booking["id"], "CONFIRMED")

    with pytest.raises(ValueError, match="υποχρεωτικούς"):
        store.complete_rental_checkout(
            tid,
            booking["id"],
            {
                "signature_url": "/api/site/rental-photos/sig.png",
                "accepted_terms": ["general_terms"],
            },
        )

    result = store.complete_rental_checkout(
        tid,
        booking["id"],
        {
            "signature_url": "/api/site/rental-photos/sig.png",
            "signer_name": "Νίκος Πελάτης",
            "accepted_terms": [
                "general_terms",
                "vehicle_condition",
                "fines",
                "offroad_ferry",
                "gdpr_gps",
            ],
            "fuel_level": 75,
            "insurance_label": "CDW",
            "deposit_eur": 500,
            "summary": {
                "vehicle": "Toyota Yaris (KXZ1234)",
                "office_name": "Demo Rent",
            },
        },
    )
    assert result["contract_status"] == "ACTIVE"
    assert result["contract_pdf_url"].startswith("/api/admin/platform/fleet-rental/contracts/file/")
    updated = result["booking"]
    assert updated["rental_status"] == "ACTIVE"
    assert updated["contract_status"] == "ACTIVE"
    assert len(updated["legal_doc_signatures"]) == 6
    assert updated["checkout_deposit_eur"] == 500.0
    assert result["pickup_inspection_id"]
    # HTML file written under DATA_DIR
    filename = result["contract_pdf_url"].rsplit("/", 1)[-1]
    assert (isolated_rental / "uploads" / "rental_contracts" / filename).is_file()
