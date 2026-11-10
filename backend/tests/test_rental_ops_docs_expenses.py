"""Rent desk ops — vehicle compliance dates, documents, expenses."""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

import pytest

from travel_platform.rental import rental_store as store


@pytest.fixture()
def isolated_rental(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "STORE_FILE", tmp_path / "rental_store.json")
    monkeypatch.setattr(store, "DATA_DIR", tmp_path)
    return tmp_path


def test_vehicle_compliance_docs_expenses_and_board(isolated_rental):
    tid = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff"
    soon = (date.today() + timedelta(days=10)).isoformat()
    vehicle = store.upsert_vehicle(
        tid,
        {
            "plate_number": "ΙΝΧ1234",
            "category": "COMPACT",
            "model": "Toyota Yaris",
            "seating_capacity": 5,
            "daily_rate_eur": 40,
            "legal_deadline": soon,
            "insurance_due_date": soon,
        },
    )
    vid = vehicle["id"]
    assert vehicle["legal_deadline"] == soon

    doc = store.add_vehicle_document(
        tid,
        vid,
        {
            "kind": "kteo",
            "file_name": "kteo.pdf",
            "mime_type": "application/pdf",
            "size_bytes": 12,
            "storage_path": str(Path(isolated_rental) / "kteo.pdf"),
            "url": "/api/admin/platform/fleet-rental/documents/file/kteo.pdf",
            "expires_at": soon,
        },
    )
    assert doc["kind"] == "kteo"
    docs = store.list_documents(tid)
    assert len(docs) == 1
    assert docs[0]["plate_number"] == "ΙΝΧ1234"

    expense = store.create_expense(
        tid,
        {
            "vehicle_id": vid,
            "expense_date": date.today().isoformat(),
            "category": "fuel",
            "amount": 55.5,
            "liters": 40,
            "note": "πλήρωση",
        },
    )
    assert expense["amount"] == 55.5
    assert len(store.list_expenses(tid)) == 1

    board = store.availability_board(tid)
    assert len(board) == 1
    assert board[0]["bookable"] is True
    assert "KTEO_SOON" in board[0]["flags"]

    summary = store.dashboard_summary(tid)
    assert summary["expenses_eur"] == 55.5
    assert summary["documents_total"] == 1
    assert any(a["kind"] == "kteo" for a in summary["compliance_alerts"])

    blocks = store.calendar_blocks(tid, days=30)
    kinds = {b["kind"] for b in blocks}
    assert "kteo" in kinds
    assert "insurance" in kinds

    assert store.delete_vehicle_document(tid, vid, doc["id"]) is True
    assert store.delete_expense(tid, expense["id"]) is True
