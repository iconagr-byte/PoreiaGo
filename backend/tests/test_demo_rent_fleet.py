"""Purge legacy demo rental fleet (no longer seeded)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from travel_platform.rental import rental_store as store


@pytest.fixture()
def rental_store_file(tmp_path, monkeypatch):
    data_file = tmp_path / "rental_store.json"
    monkeypatch.setattr(store, "STORE_FILE", data_file)
    return data_file


def test_purge_demo_rental_fleet_removes_seeded_rows(rental_store_file):
    tid = "tenant-purge-demo"
    payload = {
        "vehicles": [
            {
                "id": f"demo-rent-{tid[:8]}-car-i10",
                "tenant_id": tid,
                "plate_number": "DEMO-C01",
                "category": "CAR",
                "model": "Toyota Aygo X",
                "notes": "demo_rent_fleet_v1",
            },
            {
                "id": "real-car-1",
                "tenant_id": tid,
                "plate_number": "ABC-1234",
                "category": "CAR",
                "model": "Office Car",
                "notes": None,
            },
        ],
        "bookings": [
            {
                "id": "b-demo",
                "tenant_id": tid,
                "vehicle_id": f"demo-rent-{tid[:8]}-car-i10",
                "client_name": "Demo",
            },
            {
                "id": "b-real",
                "tenant_id": tid,
                "vehicle_id": "real-car-1",
                "client_name": "Real",
            },
        ],
        "inspections": [],
        "clients": [],
    }
    rental_store_file.write_text(json.dumps(payload), encoding="utf-8")

    removed = store.purge_demo_rental_fleet(tid)
    assert removed["vehicles"] == 1
    assert removed["bookings"] == 1

    vehicles = store.list_vehicles(tid)
    assert len(vehicles) == 1
    assert vehicles[0]["id"] == "real-car-1"
    assert store.ensure_demo_rental_fleet(tid) == 0
    assert len(store.list_vehicles(tid)) == 1


def test_public_catalog_does_not_seed_demo(rental_store_file):
    rental_store_file.write_text(
        json.dumps({"vehicles": [], "bookings": [], "inspections": [], "clients": []}),
        encoding="utf-8",
    )
    tid = "tenant-empty-catalog"
    rows = store.public_catalog(tid)
    assert rows == []
    assert store.list_vehicles(tid) == []
