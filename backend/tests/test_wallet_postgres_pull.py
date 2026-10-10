"""Wallet must surface office/guest SaaS bookings by email without claim code."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4


class MirrorGuestBookingToWalletTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(self._tmpdir.name) / "wallet.sqlite"
        self._env = patch.dict(
            "os.environ",
            {"TICKETING_DB_PATH": str(db_path), "POREIAGO_DATA_DIR": self._tmpdir.name},
            clear=False,
        )
        self._env.start()
        from ticketing import config as ticketing_config
        from ticketing import db as ticketing_db

        ticketing_config.settings.sqlite_path = str(db_path)
        await ticketing_db.close_ticketing_db()
        await ticketing_db.init_ticketing_db()

    async def asyncTearDown(self):
        from ticketing import db as ticketing_db

        await ticketing_db.close_ticketing_db()
        self._env.stop()
        self._tmpdir.cleanup()

    async def test_mirror_office_booking_appears_in_wallet_list(self):
        from app.services.customer_wallet_booking_sync import mirror_single_booking_to_wallet
        from ticketing.customer_bookings import list_bookings_for_email

        from datetime import datetime
        from uuid import UUID

        tid = str(uuid4())
        email = "dimi@gmail.com"
        booking = SimpleNamespace(
            id=uuid4(),
            tenant_id=UUID(tid),
            reference_code="BK-53D167BD",
            status=SimpleNamespace(value="CONFIRMED"),
            payment_status=SimpleNamespace(value="PAID"),
            seat_label="2A",
            passenger_name="Δημητρης Χαραλαμπιδης",
            passenger_email=email,
            passenger_vat_id=None,
            notes=None,
            total_price=22.0,
            amount_paid=22.0,
            amount_eur=22.0,
            created_at=datetime(2026, 8, 3, 15, 19),
            metadata_json={
                "source": "Office Walk-in",
                "trip_title": "Εκδρομή",
                "external_trip_id": 1,
                "seats": ["2A"],
            },
            customer_user_id=None,
        )

        # booking_to_admin_dict expects BookingStatus enums — patch mapper
        admin_dict = {
            "id": "B-53D167BD",
            "email": email,
            "pnr": "BK-53D167BD",
            "customerName": "Δημητρης Χαραλαμπιδης",
            "seat": "2A",
            "tripTitle": "Εκδρομή",
            "tenant_id": tid,
            "tenantId": tid,
            "bookingSource": "Office Walk-in",
            "status": "Επιβεβαιωμένη",
            "paymentStatus": "PAID",
        }
        with patch(
            "api.admin_booking_mapper.booking_to_admin_dict",
            return_value=admin_dict,
        ):
            ok = await mirror_single_booking_to_wallet(booking, tenant_id=tid)
        self.assertTrue(ok)

        items = await list_bookings_for_email(email, tenant_id=tid)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], "B-53D167BD")
        self.assertEqual(items[0]["email"], email)

    async def test_pull_skips_invalid_email(self):
        from app.services.customer_wallet_booking_sync import pull_postgres_bookings_into_wallet

        n = await pull_postgres_bookings_into_wallet(
            customer_email="",
            tenant_id=str(uuid4()),
        )
        self.assertEqual(n, 0)


if __name__ == "__main__":
    unittest.main()
