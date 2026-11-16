"""Wallet soft cancel must mark the office demo sample CANCELLED."""

from __future__ import annotations

import pytest

from travel_platform.rental import rental_store as store


@pytest.fixture()
def rental_store_file(tmp_path, monkeypatch):
    data_file = tmp_path / "rental_store.json"
    monkeypatch.setattr(store, "STORE_FILE", data_file)
    return data_file


def test_demo_office_cancel_marks_sample_cancelled(rental_store_file):
    tid = "tenant-demo-cancel"
    sample = store.create_demo_sign_sample(tid)
    assert sample["rental_status"] == "CONFIRMED"
    assert sample.get("reference_code") == "RN-DEMO01"

    cancelled = store.demo_office_cancel(tid)
    assert cancelled is not None
    assert cancelled["id"] == sample["id"]
    assert cancelled["rental_status"] == "CANCELLED"

    # No active demo left for further wallet sync.
    assert store.find_demo_office_booking(tid) is None
    # Idempotent when already gone.
    assert store.demo_office_cancel(tid) is None
