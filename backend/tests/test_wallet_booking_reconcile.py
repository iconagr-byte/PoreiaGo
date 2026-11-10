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

    async def test_reconcile_overwrites_stale_wallet_money(self):
        """Office cash must win over unpaid localStorage → SQLite cache."""
        from ticketing.customer_bookings import list_bookings_for_email, upsert_booking
        from ticketing.wallet_booking_reconcile import reconcile_wallet_bookings

        email = "money@example.com"
        tid = str(uuid4())
        await upsert_booking(
            {
                "id": "B-CASH1",
                "email": email,
                "price": 90.0,
                "amountPaid": 0,
                "balanceDue": 90.0,
                "paymentStatus": "PENDING",
                "tenant_id": tid,
            },
            customer_email=email,
            tenant_id=tid,
        )
        pg_row = {
            "id": "B-CASH1",
            "email": email,
            "price": 90.0,
            "amountPaid": 90.0,
            "balanceDue": 0.0,
            "paymentStatus": "PAID (Cash)",
            "tenant_id": tid,
            "tenantId": tid,
        }
        with patch(
            "ticketing.wallet_booking_reconcile.fetch_postgres_wallet_bookings",
            new=AsyncMock(return_value=(True, [pg_row])),
        ):
            items = await reconcile_wallet_bookings(email=email, tenant_id=tid)

        self.assertEqual(len(items), 1)
        self.assertEqual(float(items[0]["amountPaid"]), 90.0)
        self.assertEqual(float(items[0]["balanceDue"]), 0.0)
        self.assertIn("PAID", str(items[0]["paymentStatus"]).upper())
        cached = await list_bookings_for_email(email, tenant_id=tid)
        self.assertEqual(float(cached[0]["amountPaid"]), 90.0)


class AdminMoneyMapperTests(unittest.TestCase):
    def test_balance_due_prefers_columns_over_stale_meta(self):
        from decimal import Decimal
        from types import SimpleNamespace
        from uuid import uuid4

        from api.admin_booking_mapper import booking_to_admin_dict
        from app.models.booking import BookingStatus

        booking = SimpleNamespace(
            id=uuid4(),
            tenant_id=uuid4(),
            reference_code="BK-MONEY1",
            passenger_name="Test",
            passenger_email="money@example.com",
            passenger_vat_id=None,
            fiscal_mark=None,
            customer_user_id=None,
            seat_label="1A",
            status=BookingStatus.CONFIRMED,
            total_price=Decimal("100.00"),
            amount_paid=Decimal("100.00"),
            amount_eur=Decimal("100.00"),
            created_at=None,
            trip_id=None,
            notes=None,
            # Stale after cash capture — would wrongly show €100 due.
            metadata_json={
                "balance_due": 100,
                "amount_paid": 0,
                "payment_status": "PENDING",
                "seats": ["1A"],
            },
        )
        out = booking_to_admin_dict(booking)
        self.assertEqual(out["amountPaid"], 100.0)
        self.assertEqual(out["balanceDue"], 0.0)
        self.assertIn("PAID", str(out["paymentStatus"]).upper())

    def test_unpaid_does_not_invent_amount_paid_from_amount_eur(self):
        from decimal import Decimal
        from types import SimpleNamespace
        from uuid import uuid4

        from api.admin_booking_mapper import booking_to_admin_dict
        from app.models.booking import BookingStatus

        booking = SimpleNamespace(
            id=uuid4(),
            tenant_id=uuid4(),
            reference_code="BK-UNPAID1",
            passenger_name="Test",
            passenger_email="u@example.com",
            passenger_vat_id=None,
            fiscal_mark=None,
            customer_user_id=None,
            seat_label="2A",
            status=BookingStatus.PENDING,
            total_price=Decimal("50.00"),
            amount_paid=None,
            amount_eur=Decimal("50.00"),
            created_at=None,
            trip_id=None,
            notes=None,
            metadata_json={"seats": ["2A"]},
        )
        out = booking_to_admin_dict(booking)
        self.assertEqual(out["amountPaid"], 0.0)
        self.assertEqual(out["balanceDue"], 50.0)


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
