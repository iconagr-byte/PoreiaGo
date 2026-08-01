"""Dual-mode rental signature — remote token link + agent poll status."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from travel_platform.rental import rental_store as store

_TERMS = [
    "general_terms",
    "vehicle_condition",
    "fines",
    "offroad_ferry",
    "gdpr_gps",
]


@pytest.fixture()
def isolated_rental(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "STORE_FILE", tmp_path / "rental_store.json")
    monkeypatch.setattr(store, "DATA_DIR", tmp_path)
    return tmp_path


def _seed_booking(tid: str) -> dict:
    vehicle = store.upsert_vehicle(
        tid,
        {
            "plate_number": "KXZ9999",
            "category": "COMPACT",
            "model": "Toyota Yaris",
            "seating_capacity": 5,
            "daily_rate_eur": 40,
        },
    )
    start = datetime.now(timezone.utc)
    end = start + timedelta(days=1)
    booking = store.create_booking(
        tid,
        {
            "vehicle_id": vehicle["id"],
            "client_name": "Μαρία Πελάτης",
            "client_email": "maria@example.com",
            "client_phone": "+306912345678",
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "pickup_location": "Γραφείο",
            "total_cost": 40,
        },
    )
    store.update_booking_status(tid, booking["id"], "CONFIRMED")
    return booking


def test_create_signature_link_and_poll_pending(isolated_rental):
    tid = "cccccccc-dddd-eeee-ffff-000000000002"
    booking = _seed_booking(tid)

    link = store.create_signature_link(tid, booking["id"])
    assert link["signing_method"] == "REMOTE"
    assert link["signature_token"]
    assert link["signature_token_expires_at"]

    status = store.get_checkout_status(tid, booking["id"])
    assert status["signature_pending"] is True
    assert status["signed"] is False
    assert status["signing_method"] == "REMOTE"

    session = store.get_signing_session(link["signature_token"])
    assert session["status"] == "pending"
    assert session["client_name"] == "Μαρία Πελάτης"
    assert "Yaris" in (session.get("vehicle_model") or "")


def test_remote_submit_activates_and_clears_token(isolated_rental):
    tid = "cccccccc-dddd-eeee-ffff-000000000003"
    booking = _seed_booking(tid)
    link = store.create_signature_link(tid, booking["id"])
    token = link["signature_token"]

    # Minimal PNG (1x1)
    tiny_png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
        b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    import base64

    b64 = "data:image/png;base64," + base64.b64encode(tiny_png).decode("ascii")

    result = store.submit_signature_by_token(
        token,
        {
            "signature_base64": b64,
            "signer_name": "Μαρία Πελάτης",
            "accepted_terms": _TERMS,
            "fuel_level": 80,
            "summary": {"vehicle": "Toyota Yaris (KXZ9999)", "office_name": "Demo"},
        },
    )
    assert result["contract_status"] == "ACTIVE"
    assert result["signing_method"] == "REMOTE"
    assert result["booking"]["signature_token"] is None
    assert result["booking"]["signature_pending"] is False

    status = store.get_checkout_status(tid, booking["id"])
    assert status["signed"] is True
    assert status["signature_pending"] is False

    # Token cleared after finalize — public session lookup fails
    with pytest.raises(ValueError, match="έγκυρος|ληγμένος"):
        store.get_signing_session(token)


def test_expired_token_rejected(isolated_rental, monkeypatch):
    tid = "cccccccc-dddd-eeee-ffff-000000000004"
    booking = _seed_booking(tid)
    link = store.create_signature_link(tid, booking["id"])
    token = link["signature_token"]

    # Force expiry in the past
    with store._LOCK:
        data = store._read()
        for b in data["bookings"]:
            if b.get("id") == booking["id"]:
                b["signature_token_expires_at"] = (
                    datetime.now(timezone.utc) - timedelta(hours=1)
                ).isoformat()
        store._write(data)

    with pytest.raises(ValueError, match="λήξει"):
        store.get_signing_session(token)

    status = store.get_checkout_status(tid, booking["id"])
    assert status["token_expired"] is True
    assert status["signed"] is False


def test_in_person_checkout_sets_signing_method(isolated_rental):
    tid = "cccccccc-dddd-eeee-ffff-000000000005"
    booking = _seed_booking(tid)
    result = store.complete_rental_checkout(
        tid,
        booking["id"],
        {
            "signature_url": "/api/site/rental-photos/sig.png",
            "signer_name": "Μαρία",
            "accepted_terms": _TERMS,
            "signing_method": "IN_PERSON",
        },
    )
    assert result["signing_method"] == "IN_PERSON"
    assert result["booking"]["signing_method"] == "IN_PERSON"
    assert result["contract_status"] == "ACTIVE"
