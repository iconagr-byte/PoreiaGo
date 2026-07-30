"""Miles+Bonus loyalty store basics."""

from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from travel_platform.loyalty import loyalty_store as store


def test_loyalty_earn_and_tier_upgrade():
    with TemporaryDirectory() as tmp:
        path = Path(tmp) / "loyalty_store.json"
        with mock.patch.object(store, "STORE_FILE", path), mock.patch.object(store, "DATA_DIR", Path(tmp)):
            tid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
            account = store.upsert_account(
                tid,
                {"client_email": "vip@example.com", "display_name": "VIP Guest"},
            )
            assert account["tier"] == "STANDARD"
            result = store.post_transaction(
                tid,
                {
                    "loyalty_account_id": account["id"],
                    "tx_type": "EARN",
                    "miles": 6000,
                    "source_kind": "TRIP",
                    "distance_km": 420,
                },
            )
            assert result["account"]["tier"] == "SILVER"
            assert result["account"]["redeemable_miles"] == 6000
            assert result["transaction"]["miles"] == 6000
            txs = store.list_transactions(tid, account_id=account["id"])
            assert len(txs) == 1


def test_loyalty_redeem_insufficient_fails():
    with TemporaryDirectory() as tmp:
        path = Path(tmp) / "loyalty_store.json"
        with mock.patch.object(store, "STORE_FILE", path), mock.patch.object(store, "DATA_DIR", Path(tmp)):
            tid = "11111111-2222-3333-4444-555555555555"
            account = store.upsert_account(tid, {"client_email": "a@b.c"})
            try:
                store.post_transaction(
                    tid,
                    {"loyalty_account_id": account["id"], "tx_type": "REDEEM", "miles": 10},
                )
                assert False, "expected ValueError"
            except ValueError as exc:
                assert "Ανεπαρκ" in str(exc)
