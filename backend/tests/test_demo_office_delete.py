"""Wallet hard-delete must remove the office demo sample and block re-seed."""

from __future__ import annotations

import pytest

from travel_platform.rental import rental_store as store


@pytest.fixture()
def rental_store_file(tmp_path, monkeypatch):
    data_file = tmp_path / "rental_store.json"
    monkeypatch.setattr(store, "STORE_FILE", data_file)
    return data_file


def test_demo_office_delete_removes_sample_and_blocks_ensure(rental_store_file):
    tid = "tenant-demo-delete"
    sample = store.create_demo_sign_sample(tid)
    assert sample["rental_status"] == "CONFIRMED"

    removed = store.demo_office_delete(tid)
    assert removed is not None
    assert removed["id"] == sample["id"]
    assert store.find_demo_office_booking_any(tid) is None
    assert store.is_demo_sample_purged(tid) is True

    # ensure must not immediately recreate after wallet delete
    assert store.ensure_demo_rental_sample_booking(tid) is None

    # Admin recreate clears purge
    again = store.create_demo_sign_sample(tid)
    assert again["rental_status"] == "CONFIRMED"
    assert store.is_demo_sample_purged(tid) is False


def test_delete_booking_for_customer_requires_owner(rental_store_file):
    tid = "tenant-demo-delete-owner"
    sample = store.create_demo_sign_sample(tid)
    with pytest.raises(ValueError, match="δικαίωμα"):
        store.delete_booking_for_customer(tid, sample["id"], email="other@example.com")
    gone = store.delete_booking_for_customer(
        tid, sample["id"], email="demo.renter@poreiago.local"
    )
    assert gone["id"] == sample["id"]
    assert store.get_booking(tid, sample["id"]) is None
