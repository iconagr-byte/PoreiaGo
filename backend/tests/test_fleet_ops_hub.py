"""Fleet calendar, availability board, documents and expenses."""

from __future__ import annotations

from pathlib import Path

import pytest

from travel_platform.fleet import service_service as fleet_mod
from travel_platform.settings.drivers_store import DEMO_TENANT_ID


@pytest.fixture()
def isolated_fleet(tmp_path, monkeypatch):
    store = tmp_path / "fleet_store.json"
    monkeypatch.setattr(fleet_mod, "STORE_FILE", store)
    monkeypatch.setattr(fleet_mod, "UPLOAD_DIR", tmp_path / "uploads")
    fleet_mod.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return fleet_mod.ServiceService()


def test_calendar_and_availability(isolated_fleet):
    svc = isolated_fleet
    office = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff"
    created = svc.create_vehicle(
        {
            "make": "Ford",
            "model": "Transit",
            "plate_number": "VAN-7777",
            "year": 2024,
            "vin": "WF0TESTVIN777777",
            "category": "Van",
            "tenant_id": office,
            "legal_deadline": "2099-01-15",
            "insurance_due_date": "2099-02-01",
        }
    )
    cal = svc.list_calendar(tenant_id=office, within_days=36500)
    kinds = {c["kind"] for c in cal}
    assert "kteo" in kinds or "insurance" in kinds or "service" in kinds

    board = svc.list_availability(tenant_id=office)
    assert len(board) == 1
    assert board[0]["vehicle_id"] == created["id"]
    assert board[0]["available"] is True


def test_documents_and_expenses(isolated_fleet, tmp_path):
    svc = isolated_fleet
    office = "cccccccc-dddd-eeee-ffff-000000000001"
    created = svc.create_vehicle(
        {
            "make": "Mercedes",
            "model": "Sprinter",
            "plate_number": "DOC-1000",
            "year": 2023,
            "vin": "WDBDOCUMENTS0001",
            "category": "Van",
            "tenant_id": office,
        }
    )
    path = tmp_path / "uploads" / "test.pdf"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"%PDF-1.4")
    doc = svc.add_vehicle_document(
        created["id"],
        {
            "kind": "insurance",
            "file_name": "test.pdf",
            "mime_type": "application/pdf",
            "size_bytes": 8,
            "storage_path": str(path),
            "url": "/api/admin/platform/fleet/documents/file/test.pdf",
            "expires_at": "2099-06-01",
        },
        tenant_id=office,
    )
    assert doc["id"]
    docs = svc.list_documents(tenant_id=office)
    assert len(docs) == 1

    expense = svc.create_expense(
        {
            "vehicle_id": created["id"],
            "tenant_id": office,
            "category": "fuel",
            "amount": 120.5,
            "liters": 40,
            "odometer": 1000,
        }
    )
    assert expense["amount"] == 120.5
    listed = svc.list_expenses(tenant_id=office)
    assert len(listed) == 1
    v = svc.get_vehicle(created["id"], tenant_id=office)
    assert v["fuel_cost_total"] >= 120.5
    assert svc.delete_expense(expense["id"], tenant_id=office) is True
    assert svc.delete_vehicle_document(created["id"], doc["id"], tenant_id=office) is True
