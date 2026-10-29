"""Wallet accounts must appear in office Πελάτες with the wallet/Google name."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("AUTH_JWT_SECRET", "test-wallet-crm-bridge-jwt-secret-32!")


class PreferNameTests(unittest.TestCase):
    def test_fuller_wallet_name_wins(self):
        from travel_platform.settings.wallet_crm_bridge import prefer_display_name

        self.assertEqual(
            prefer_display_name("Dodopoulos", "Axilleas Charalambidis"),
            "Axilleas Charalambidis",
        )

    def test_keeps_crm_when_equal_richness(self):
        from travel_platform.settings.wallet_crm_bridge import prefer_display_name

        self.assertEqual(
            prefer_display_name("Ευαγγελία Παπαλαζάρου", "Ευαγγελία"),
            "Ευαγγελία Παπαλαζάρου",
        )


class MirrorWalletCrmTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store_path = Path(self.tmp.name) / "office_customers.json"
        self._store_patch = patch(
            "travel_platform.settings.office_customers_store.STORE_FILE",
            self.store_path,
        )
        self._store_patch.start()

    async def asyncTearDown(self):
        self._store_patch.stop()
        self.tmp.cleanup()

    def test_mirror_inserts_wallet_account(self):
        from travel_platform.settings.office_customers_store import list_customers
        from travel_platform.settings.wallet_crm_bridge import mirror_wallet_account_to_crm

        row = mirror_wallet_account_to_crm(
            "office-achillio",
            {
                "email": "iconagr@gmail.com",
                "name": "Axilleas Charalambidis",
                "phone": "6976678967",
                "auth_provider": "google",
                "picture": "https://example.com/a.jpg",
            },
        )
        self.assertIsNotNone(row)
        self.assertEqual(row["name"], "Axilleas Charalambidis")
        self.assertEqual(row["source"], "wallet")
        self.assertEqual(row["authProvider"], "google")
        rows = list_customers("office-achillio", service_scope="buses")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["email"], "iconagr@gmail.com")

    def test_mirror_upgrades_booking_surname_to_wallet_name(self):
        from travel_platform.settings.office_customers_store import list_customers, upsert_customer
        from travel_platform.settings.wallet_crm_bridge import mirror_wallet_account_to_crm

        upsert_customer(
            "office-achillio",
            {
                "email": "iconagr@gmail.com",
                "name": "Dodopoulos",
                "phone": "6976678967",
                "source": "booking",
                "serviceScope": "buses",
            },
        )
        mirror_wallet_account_to_crm(
            "office-achillio",
            {
                "email": "iconagr@gmail.com",
                "name": "Axilleas Charalambidis",
                "phone": "6976678967",
                "auth_provider": "google",
            },
        )
        rows = list_customers("office-achillio", service_scope="buses")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["name"], "Axilleas Charalambidis")
        self.assertEqual(rows[0]["phone"], "6976678967")
        self.assertEqual(rows[0]["source"], "wallet")

    def test_google_name_always_wins_over_booking_surname(self):
        from travel_platform.settings.office_customers_store import list_customers, upsert_customer
        from travel_platform.settings.wallet_crm_bridge import mirror_wallet_account_to_crm

        upsert_customer(
            "office-achillio",
            {
                "email": "iconagr@gmail.com",
                "name": "Dodopoulos",
                "source": "booking",
                "serviceScope": "buses",
            },
        )
        mirror_wallet_account_to_crm(
            "office-achillio",
            {
                "email": "iconagr@gmail.com",
                "name": "Axilleas Charalambidis",
                "auth_provider": "google",
            },
        )
        self.assertEqual(
            list_customers("office-achillio", service_scope="buses")[0]["name"],
            "Axilleas Charalambidis",
        )

    async def test_sync_upgrades_even_when_wallet_home_mismatched(self):
        from travel_platform.settings.office_customers_store import list_customers, upsert_customer
        from travel_platform.settings.wallet_crm_bridge import sync_wallet_accounts_into_crm

        upsert_customer(
            "office-achillio",
            {
                "email": "iconagr@gmail.com",
                "name": "Dodopoulos",
                "source": "booking",
                "serviceScope": "buses",
            },
        )
        with (
            patch(
                "ticketing.customer_accounts.list_accounts_for_tenant",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "ticketing.customer_accounts.get_account",
                new_callable=AsyncMock,
                return_value={
                    "email": "iconagr@gmail.com",
                    "name": "Axilleas Charalambidis",
                    "auth_provider": "google",
                    "wallet_tenant_id": "some-other-office",
                },
            ),
        ):
            await sync_wallet_accounts_into_crm("office-achillio")
        self.assertEqual(
            list_customers("office-achillio", service_scope="buses")[0]["name"],
            "Axilleas Charalambidis",
        )

    async def test_sync_pulls_tenant_wallet_accounts(self):
        from travel_platform.settings.office_customers_store import list_customers
        from travel_platform.settings.wallet_crm_bridge import sync_wallet_accounts_into_crm

        with patch(
            "ticketing.customer_accounts.list_accounts_for_tenant",
            new_callable=AsyncMock,
            return_value=[
                {
                    "email": "ax@example.com",
                    "name": "Axilleas Charalambidis",
                    "phone": "6976678967",
                    "auth_provider": "google",
                    "wallet_tenant_id": "office-achillio",
                }
            ],
        ):
            n = await sync_wallet_accounts_into_crm("office-achillio")
        self.assertEqual(n, 1)
        rows = list_customers("office-achillio", service_scope="buses")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["name"], "Axilleas Charalambidis")

    async def test_sync_upgrades_crm_row_by_email_when_unbound(self):
        """Booking surname in CRM + wallet Google name → CRM shows wallet name."""
        from travel_platform.settings.office_customers_store import list_customers, upsert_customer
        from travel_platform.settings.wallet_crm_bridge import sync_wallet_accounts_into_crm

        upsert_customer(
            "office-achillio",
            {
                "email": "iconagr@gmail.com",
                "name": "Dodopoulos",
                "phone": "6976678867",
                "source": "booking",
                "serviceScope": "buses",
            },
        )
        with (
            patch(
                "ticketing.customer_accounts.list_accounts_for_tenant",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "ticketing.customer_accounts.get_account",
                new_callable=AsyncMock,
                return_value={
                    "email": "iconagr@gmail.com",
                    "name": "Axilleas Charalambidis",
                    "phone": "6976678967",
                    "auth_provider": "google",
                    "wallet_tenant_id": None,
                },
            ),
        ):
            n = await sync_wallet_accounts_into_crm("office-achillio")
        self.assertGreaterEqual(n, 1)
        rows = list_customers("office-achillio", service_scope="buses")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["name"], "Axilleas Charalambidis")
        self.assertEqual(rows[0]["phone"], "6976678967")

    def test_mirror_does_not_revive_soft_deleted(self):
        from travel_platform.settings.office_customers_store import (
            delete_customer,
            list_customers,
            upsert_customer,
        )
        from travel_platform.settings.wallet_crm_bridge import mirror_wallet_account_to_crm

        row = upsert_customer(
            "office-achillio",
            {
                "email": "evangelia@example.com",
                "name": "Παπαλαζάρου Ευαγγελία",
                "serviceScope": "buses",
                "source": "booking",
            },
        )
        self.assertTrue(delete_customer("office-achillio", row["id"]))
        mirrored = mirror_wallet_account_to_crm(
            "office-achillio",
            {
                "email": "evangelia@example.com",
                "name": "Παπαλαζάρου Ευαγγελία",
                "auth_provider": "email",
                "wallet_tenant_id": "office-achillio",
            },
        )
        self.assertIsNone(mirrored)
        self.assertEqual(list_customers("office-achillio", service_scope="buses"), [])


if __name__ == "__main__":
    unittest.main()
