"""Demo rental fleet seed (3 cars + 3 vans)."""

from __future__ import annotations

import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from travel_platform.rental import rental_store as store


def test_ensure_demo_rental_fleet_seeds_six_vehicles():
    with TemporaryDirectory() as tmp:
        path = Path(tmp) / "rental_store.json"
        with mock.patch.object(store, "STORE_FILE", path), mock.patch.object(store, "DATA_DIR", Path(tmp)):
            tid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
            added = store.ensure_demo_rental_fleet(tid)
            assert added == 6
            rows = store.list_vehicles(tid)
            cats = sorted(v["category"] for v in rows)
            assert cats.count("CAR") == 3
            assert cats.count("VAN") == 3
            assert all(v.get("photo_url") for v in rows)
            # Idempotent
            assert store.ensure_demo_rental_fleet(tid) == 0
            assert len(store.list_vehicles(tid)) == 6


def test_public_catalog_does_not_auto_seed():
    with TemporaryDirectory() as tmp:
        path = Path(tmp) / "rental_store.json"
        with mock.patch.object(store, "STORE_FILE", path), mock.patch.object(store, "DATA_DIR", Path(tmp)):
            tid = "11111111-2222-3333-4444-555555555555"
            catalog = store.public_catalog(tid)
            assert catalog == []
            assert not path.is_file() or json.loads(path.read_text(encoding="utf-8")).get("vehicles") in (None, [])
