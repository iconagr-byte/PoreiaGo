"""Regression: payment / seat JSON stores and wallet bookings are office-scoped."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from travel_platform.settings.payment_settings_store import (
    get_public_payment_settings,
    read_payment_settings,
    write_payment_settings,
)
from travel_platform.settings.seat_pricing_store import (
    get_layout_pricing,
    write_seat_pricing,
)


class PaymentSeatTenantIsolationTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self._tmpdir.name)
        self._patch = patch.dict("os.environ", {"POREIAGO_DATA_DIR": str(self.data_dir)})
        self._patch.start()

    def tearDown(self):
        self._patch.stop()
        self._tmpdir.cleanup()

    def test_payment_iban_not_shared_across_offices(self):
        office_a = "11111111-1111-1111-1111-111111111111"
        office_b = "22222222-2222-2222-2222-222222222222"
        data = read_payment_settings(office_a)
        data["bank_accounts"] = [
            {
                "id": "bank-a",
                "label": "Office A",
                "bank_name": "Alpha",
                "beneficiary": "Office A AE",
                "iban": "GR1601101250000000012300695",
                "bic": "ERBKGRAA",
                "currency": "EUR",
                "enabled": True,
                "is_default": True,
                "reference_template": "VOY-{pnr}",
                "instructions": "",
            }
        ]
        write_payment_settings(data, office_a)
        a_iban = get_public_payment_settings(office_a)["bank_accounts"][0]["iban"]
        b_pub = get_public_payment_settings(office_b)
        self.assertEqual(a_iban, "GR1601101250000000012300695")
        self.assertNotEqual(b_pub["bank_accounts"][0].get("label"), "Office A")

    def test_seat_pricing_vip_markup_isolated(self):
        office_a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        office_b = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
        write_seat_pricing(
            {"layouts": {"luxury-coach": {"vip_markup_pct": 77}}},
            office_a,
        )
        self.assertEqual(get_layout_pricing("luxury-coach", office_a)["vip_markup_pct"], 77)
        self.assertEqual(get_layout_pricing("luxury-coach", office_b)["vip_markup_pct"], 25)


class WalletBookingTenantIsolationTests(unittest.IsolatedAsyncioTestCase):
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

    async def test_wallet_list_is_office_scoped(self):
        from ticketing.customer_bookings import list_bookings_for_email, upsert_booking

        office_a = "11111111-1111-1111-1111-111111111111"
        office_b = "22222222-2222-2222-2222-222222222222"
        email = "shared@example.com"
        await upsert_booking(
            {
                "id": "B-A1",
                "email": email,
                "tripTitle": "Achillio trip",
                "tenant_id": office_a,
            },
            customer_email=email,
            tenant_id=office_a,
        )
        await upsert_booking(
            {
                "id": "B-B1",
                "email": email,
                "tripTitle": "PoreiaGo trip",
                "tenant_id": office_b,
            },
            customer_email=email,
            tenant_id=office_b,
        )
        a_items = await list_bookings_for_email(email, tenant_id=office_a)
        b_items = await list_bookings_for_email(email, tenant_id=office_b)
        self.assertEqual([b["id"] for b in a_items], ["B-A1"])
        self.assertEqual([b["id"] for b in b_items], ["B-B1"])


if __name__ == "__main__":
    unittest.main()
