"""Postgres is source of truth for My Wallet ↔ desktop booking sync."""

from __future__ import annotations

import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4


class WalletBookingReconcileTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        db_path = f"{self._tmpdir.name}/tickets.db"
        from ticketing import config as ticketing_config
        from ticketing import db as ticketing_db

        self._prev_sqlite = ticketing_config.settings.sqlite_path
        ticketing_config.settings.sqlite_path = db_path
        await ticketing_db.close_ticketing_db()
        await ticketing_db.init_ticketing_db()

    async def asyncTearDown(self):
        from ticketing import config as ticketing_config
        from ticketing import db as ticketing_db

        await ticketing_db.close_ticketing_db()
        ticketing_config.settings.sqlite_path = self._prev_sqlite
        self._tmpdir.cleanup()

    async def test_reconcile_overwrites_stale_seats_and_purges_orphans(self):
        from ticketing.customer_bookings import list_bookings_for_email, upsert_booking
        from ticketing.wallet_booking_reconcile import reconcile_wallet_bookings

        email = "iconagr@gmail.com"
        tid = str(uuid4())
        await upsert_booking(
            {
                "id": "B-B606D55B",
                "saasBookingId": "pg-1",
                "pnr": "BK-B606D55B",
                "email": email,
                "seats": ["1B", "4B", "1A", "13B"],
                "seat": "1B, 4B, 1A, 13B",
                "tripTitle": "Ημερήσια στα Μετέωρα",
                "status": "Επιβεβαιωμένη",
                "tenant_id": tid,
            },
            customer_email=email,
            tenant_id=tid,
        )
        await upsert_booking(
            {
                "id": "B-GHOST",
                "email": email,
                "seats": ["9Z"],
                "tripTitle": "Ghost trip",
                "tenant_id": tid,
            },
            customer_email=email,
            tenant_id=tid,
        )

        pg_row = {
            "id": "B-B606D55B",
            "saasBookingId": "pg-1",
            "pnr": "BK-B606D55B",
            "email": email,
            "seats": ["1B", "4B"],
            "seat": "1B, 4B",
            "tripTitle": "Ημερήσια στα Μετέωρα",
            "status": "Επιβεβαιωμένη",
            "passengers": [
                {"seat": "1B", "name": "Axilleas Charalambidis", "role": "booker"},
                {"seat": "4B", "name": "Maria", "role": "companion"},
            ],
            "tenant_id": tid,
            "tenantId": tid,
        }

        with patch(
            "ticketing.wallet_booking_reconcile.fetch_postgres_wallet_bookings",
            new=AsyncMock(return_value=(True, [pg_row])),
        ):
            items = await reconcile_wallet_bookings(email=email, tenant_id=tid)

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], "B-B606D55B")
        self.assertEqual(items[0]["seats"], ["1B", "4B"])
        self.assertNotIn("1A", items[0].get("seats") or [])
        cached = await list_bookings_for_email(email, tenant_id=tid)
        self.assertEqual({b["id"] for b in cached}, {"B-B606D55B"})

    async def test_reconcile_keeps_cache_when_postgres_down(self):
        from ticketing.customer_bookings import upsert_booking
        from ticketing.wallet_booking_reconcile import reconcile_wallet_bookings

        email = "keep@example.com"
        tid = str(uuid4())
        await upsert_booking(
            {
                "id": "B-KEEP",
                "email": email,
                "seats": ["2A"],
                "tenant_id": tid,
            },
            customer_email=email,
            tenant_id=tid,
        )
        with patch(
            "ticketing.wallet_booking_reconcile.fetch_postgres_wallet_bookings",
            new=AsyncMock(return_value=(False, [])),
        ):
            items = await reconcile_wallet_bookings(email=email, tenant_id=tid)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], "B-KEEP")

    async def test_sync_endpoint_ignores_client_body(self):
        from api import customer_bookings as api

        req = SimpleNamespace(headers={}, state=SimpleNamespace())
        account = {"email": "a@b.com", "customer_id": "CUST-1", "tenant_id": "t1"}
        body = api.BookingSyncRequest(
            bookings=[
                {
                    "id": "B-FAKE",
                    "seats": ["9Z", "9Y"],
                    "email": "a@b.com",
                }
            ]
        )
        with patch.object(api, "_wallet_tenant", new=AsyncMock(return_value="t1")):
            with patch(
                "ticketing.wallet_booking_reconcile.reconcile_wallet_bookings",
                new=AsyncMock(return_value=[{"id": "B-REAL", "seats": ["1B"]}]),
            ) as recon:
                out = await api.sync_my_bookings(body, req, account)

        recon.assert_awaited()
        self.assertEqual(out["synced"], 0)
        self.assertEqual(out["source"], "postgres")
        self.assertEqual(out["items"][0]["id"], "B-REAL")


class PassengerNameGuardTests(unittest.TestCase):
    def test_numeric_companion_rejected_in_js_contract(self):
        # Mirrors src/lib/ticketing/bookingPassengers.js isPlausiblePassengerName
        import re

        def is_plausible(name: str) -> bool:
            raw = str(name or "").strip()
            if len(raw) < 2:
                return False
            if re.fullmatch(r"[\d\s+()./-]+", raw):
                return False
            digits = len(re.findall(r"\d", raw))
            compact = re.sub(r"\s", "", raw)
            if digits >= 5 and compact and digits / len(compact) >= 0.6:
                return False
            return True

        self.assertFalse(is_plausible("2344455"))
        self.assertTrue(is_plausible("Maria Papadopoulou"))
        self.assertTrue(is_plausible("Γιάννης"))
