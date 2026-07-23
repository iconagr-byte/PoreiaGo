"""Fleet vehicles are scoped per office tenant — demo seed stays on demo tenant only."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from travel_platform.fleet import service_service as fleet_mod
from travel_platform.settings.drivers_store import DEMO_TENANT_ID


@pytest.fixture()
def isolated_fleet(tmp_path, monkeypatch):
    store = tmp_path / "fleet_store.json"
    monkeypatch.setattr(fleet_mod, "STORE_FILE", store)
    svc = fleet_mod.ServiceService()
    return svc, store


def test_seed_belongs_to_demo_tenant(isolated_fleet):
    svc, _ = isolated_fleet
    demo = svc.list_vehicles(tenant_id=DEMO_TENANT_ID)
    other = svc.list_vehicles(tenant_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    assert len(demo) >= 1
    assert other == []


def test_create_vehicle_van_for_office(isolated_fleet):
    svc, store = isolated_fleet
    office = "11111111-2222-3333-4444-555555555555"
    created = svc.create_vehicle(
        {
            "make": "Ford",
            "model": "Transit",
            "plate_number": "VAN-1001",
            "year": 2024,
            "vin": "WF0XXXGCDX123456",
            "current_odometer": 12000,
            "category": "Van",
            "seat_count": 9,
            "tenant_id": office,
            "show_on_website": True,
            "public_summary": "Transfer van",
        }
    )
    assert created["category"] == "Van"
    assert created["seat_count"] == 9
    assert created["plate_number"] == "VAN-1001"

    office_list = svc.list_vehicles(tenant_id=office)
    assert len(office_list) == 1
    assert office_list[0]["id"] == created["id"]

    # Demo office must not see the new van
    demo_ids = {v["id"] for v in svc.list_vehicles(tenant_id=DEMO_TENANT_ID)}
    assert created["id"] not in demo_ids

    raw = json.loads(Path(store).read_text(encoding="utf-8"))
    row = next(v for v in raw["vehicles"] if v["id"] == created["id"])
    assert row["tenant_id"] == office


def test_delete_and_get_respect_tenant(isolated_fleet):
    svc, _ = isolated_fleet
    office = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    other = "99999999-8888-7777-6666-555555555555"
    created = svc.create_vehicle(
        {
            "make": "Mercedes",
            "model": "Tourismo",
            "plate_number": "BUS-2002",
            "year": 2022,
            "vin": "WDBXXXXXXXXXXXXXX",
            "category": "Luxury Coach",
            "tenant_id": office,
        }
    )
    assert svc.get_vehicle(created["id"], tenant_id=other) is None
    assert svc.delete_vehicle(created["id"], tenant_id=other) is False
    assert svc.get_vehicle(created["id"], tenant_id=office) is not None
    assert svc.delete_vehicle(created["id"], tenant_id=office) is True
    assert svc.get_vehicle(created["id"], tenant_id=office) is None
