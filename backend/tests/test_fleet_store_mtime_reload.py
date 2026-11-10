"""Fleet singleton reloads when another worker writes fleet_store.json."""

from __future__ import annotations

import json
import time

import pytest

from travel_platform.fleet import service_service as fleet_mod
from travel_platform.settings.drivers_store import DEMO_TENANT_ID


@pytest.fixture()
def isolated_fleet(tmp_path, monkeypatch):
    store = tmp_path / "fleet_store.json"
    monkeypatch.setattr(fleet_mod, "STORE_FILE", store)
    monkeypatch.setattr(fleet_mod, "_LEGACY_STORE", tmp_path / "no-legacy.json")
    monkeypatch.setattr(fleet_mod, "UPLOAD_DIR", tmp_path / "uploads")
    svc = fleet_mod.ServiceService()
    return svc, store


def test_list_reloads_peer_worker_write(isolated_fleet):
    svc, store = isolated_fleet
    office = "97798681-2f60-4398-b1f6-9eb38dc341b0"
    assert svc.list_vehicles(tenant_id=office) == []

    # Simulate another uvicorn worker persisting Achillio coaches to disk.
    peer = {
        "vehicles": [
            {
                "id": "FL-CB9A3078",
                "make": "Mercedes",
                "model": "Sprinter 316 Extra Long Euro 5",
                "plate_number": "PEER-1",
                "year": 2015,
                "vin": "WDBPEER000000001",
                "current_odometer": 1000,
                "last_service_date": "2026-01-01",
                "last_service_mileage": 1000,
                "category": "Van",
                "seat_count": 21,
                "show_on_website": True,
                "tenant_id": office,
            }
        ],
        "events": [],
        "alerts": [],
        "expenses": [],
    }
    # Ensure mtime is strictly newer than the empty store this worker wrote.
    time.sleep(0.02)
    store.write_text(json.dumps(peer), encoding="utf-8")

    listed = svc.list_vehicles(tenant_id=office)
    assert len(listed) == 1
    assert listed[0]["id"] == "FL-CB9A3078"
    assert svc.list_vehicles(tenant_id=DEMO_TENANT_ID) == []


def test_create_does_not_clobber_peer_vehicles(isolated_fleet):
    svc, store = isolated_fleet
    office = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    peer_office = "97798681-2f60-4398-b1f6-9eb38dc341b0"

    time.sleep(0.02)
    store.write_text(
        json.dumps(
            {
                "vehicles": [
                    {
                        "id": "FL-PEER",
                        "make": "Volvo",
                        "model": "9700",
                        "plate_number": "PEER-2",
                        "year": 2010,
                        "vin": "VOLPEER000000002",
                        "current_odometer": 2000,
                        "last_service_date": "2026-01-01",
                        "last_service_mileage": 2000,
                        "tenant_id": peer_office,
                        "show_on_website": True,
                    }
                ],
                "events": [],
                "alerts": [],
                "expenses": [],
            }
        ),
        encoding="utf-8",
    )

    created = svc.create_vehicle(
        {
            "make": "Ford",
            "model": "Transit",
            "plate_number": "LOCAL-1",
            "year": 2024,
            "vin": "FORDLOCAL0000001",
            "tenant_id": office,
            "category": "Van",
        }
    )
    raw = json.loads(store.read_text(encoding="utf-8"))
    ids = {v["id"] for v in raw["vehicles"]}
    assert "FL-PEER" in ids
    assert created["id"] in ids
