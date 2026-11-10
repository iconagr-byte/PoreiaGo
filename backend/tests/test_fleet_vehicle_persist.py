"""Fleet vehicle create persists under POREIAGO_DATA_DIR (production volume)."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from travel_platform.fleet import service_service as fleet_mod


@pytest.fixture()
def data_dir_fleet(tmp_path, monkeypatch):
    data = tmp_path / "data"
    data.mkdir()
    legacy = tmp_path / "legacy_pkg" / "fleet_store.json"
    legacy.parent.mkdir(parents=True)
    monkeypatch.setenv("POREIAGO_DATA_DIR", str(data))
    monkeypatch.setattr(fleet_mod, "_DATA_DIR", data)
    monkeypatch.setattr(fleet_mod, "_LEGACY_STORE", legacy)
    monkeypatch.setattr(fleet_mod, "STORE_FILE", data / "fleet_store.json")
    monkeypatch.setattr(fleet_mod, "UPLOAD_DIR", data / "fleet_uploads")
    monkeypatch.setattr(fleet_mod, "DATA_DIR", data)
    svc = fleet_mod.ServiceService()
    return svc, data, legacy


def test_create_vehicle_writes_durable_store(data_dir_fleet):
    svc, data, _legacy = data_dir_fleet
    office = "11111111-2222-3333-4444-555555555555"
    created = svc.create_vehicle(
        {
            "make": "Mercedes",
            "model": "Tourismo",
            "plate_number": "EEZ 2346",
            "year": 2022,
            "vin": "12345678",
            "current_odometer": 3456,
            "category": "Standard",
            "seat_count": 50,
            "show_on_website": True,
            "public_summary": "",
            "tenant_id": office,
        }
    )
    store = data / "fleet_store.json"
    assert store.is_file()
    raw = json.loads(store.read_text(encoding="utf-8"))
    row = next(v for v in raw["vehicles"] if v["id"] == created["id"])
    assert row["plate_number"] == "EEZ 2346"
    assert row["tenant_id"] == office
    assert row["vin"] == "12345678"


def test_migrates_legacy_package_store(data_dir_fleet):
    _svc, data, legacy = data_dir_fleet
    legacy.write_text(
        json.dumps(
            {
                "vehicles": [
                    {
                        "id": "FL-LEGACY",
                        "make": "Volvo",
                        "model": "9700",
                        "plate_number": "OLD-1",
                        "year": 2019,
                        "vin": "VOLLEGACY0000001",
                        "current_odometer": 1000,
                        "last_service_date": "2026-01-01",
                        "last_service_mileage": 1000,
                        "next_service_threshold": 16000,
                        "tenant_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                    }
                ],
                "events": [],
                "alerts": [],
                "expenses": [],
            }
        ),
        encoding="utf-8",
    )
    # Fresh service should copy legacy → durable path.
    store = data / "fleet_store.json"
    if store.exists():
        store.unlink()
    svc2 = fleet_mod.ServiceService()
    assert store.is_file()
    listed = svc2.list_vehicles(tenant_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    assert any(v["id"] == "FL-LEGACY" for v in listed)


def test_fleet_prefix_is_file_store_admin():
    from middleware.tenant import _is_file_store_admin

    assert _is_file_store_admin("/api/admin/platform/fleet/vehicles")
    assert _is_file_store_admin("/api/admin/platform/fleet/expenses")
