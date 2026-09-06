"""Mailbox IMAP sync — tenant accounts + orphan message claim."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("AUTH_JWT_SECRET", "test-mailbox-sync-jwt-secret-32c!")


class ListAllActiveSettingsTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(self._tmpdir.name) / "mailbox-test.db"
        from ticketing import config as ticketing_config
        from ticketing import db as ticketing_db

        self._prev_sqlite = ticketing_config.settings.sqlite_path
        ticketing_config.settings.sqlite_path = str(db_path)
        await ticketing_db.init_ticketing_db()
        from email_marketing.store import init_email_marketing_tables
        from email_client.store import init_email_client_tables

        await init_email_marketing_tables()
        await init_email_client_tables()

    async def asyncTearDown(self):
        from ticketing import config as ticketing_config
        from ticketing import db as ticketing_db

        await ticketing_db.close_ticketing_db()
        ticketing_config.settings.sqlite_path = self._prev_sqlite
        self._tmpdir.cleanup()

    async def test_list_all_active_includes_tenant_owner(self):
        from email_client.settings_store import create_settings, list_all_active_settings, list_settings

        await create_settings(
            {
                "owner_key": "tenant:office-a",
                "email_address": "info@example.com",
                "imap_host": "mail.example.com",
                "smtp_host": "mail.example.com",
                "mail_username": "info@example.com",
                "mail_password": "secret",
            }
        )
        # Legacy list by default owner must NOT see the tenant account.
        legacy = await list_settings(owner_key="default", active_only=True)
        self.assertEqual(legacy, [])
        all_active = await list_all_active_settings()
        self.assertEqual(len(all_active), 1)
        self.assertEqual(all_active[0]["owner_key"], "tenant:office-a")

    async def test_upsert_claims_orphan_message(self):
        from email_client.store import list_messages, upsert_message

        orphan = await upsert_message(
            {
                "message_id": "<orphan@test>",
                "subject": "Hi",
                "sender": "a@b.com",
                "recipient": "c@d.com",
                "body_html": "<p>x</p>",
                "folder": "Inbox",
                "date": "2026-01-01T00:00:00+00:00",
            }
        )
        self.assertIsNotNone(orphan)
        claimed = await upsert_message(
            {
                "message_id": "<orphan@test>",
                "email_settings_id": "EMS-claim",
                "subject": "Hi2",
                "sender": "a@b.com",
                "recipient": "c@d.com",
                "body_html": "<p>y</p>",
                "folder": "Inbox",
                "date": "2026-01-01T00:00:00+00:00",
            }
        )
        self.assertEqual(claimed["id"], orphan["id"])
        self.assertEqual(claimed["email_settings_id"], "EMS-claim")
        self.assertEqual(claimed["subject"], "Hi2")
        rows = await list_messages(folder="Inbox", email_settings_id="EMS-claim")
        self.assertEqual(len(rows), 1)

    async def test_sync_missing_password_returns_greek_error(self):
        from email_client.imap_sync import sync_account_imap

        result = await sync_account_imap(
            {
                "id": "EMS-nopw",
                "email_address": "info@example.com",
                "imap_host": "mail.example.com",
                "imap_port": 993,
                "imap_secure": True,
                "mail_username": "info@example.com",
                "mail_password": "",
                "has_password": False,
            }
        )
        self.assertFalse(result["ok"])
        self.assertIn("κωδικός", result["error"])

    async def test_bulk_sync_uses_all_active_accounts(self):
        from email_client.imap_sync import sync_imap_to_database_async

        with patch(
            "email_client.settings_store.list_all_active_settings",
            new_callable=AsyncMock,
            return_value=[
                {
                    "id": "EMS-1",
                    "imap_host": "mail.example.com",
                    "owner_key": "tenant:x",
                }
            ],
        ), patch(
            "email_client.settings_store.get_settings",
            new_callable=AsyncMock,
            return_value={
                "id": "EMS-1",
                "imap_host": "mail.example.com",
                "mail_password": "x",
                "email_address": "a@b.com",
            },
        ), patch(
            "email_client.imap_sync.sync_account_imap",
            new_callable=AsyncMock,
            return_value={
                "ok": True,
                "synced": 3,
                "folders": {"Inbox": 3},
                "errors": [],
            },
        ) as sync_mock:
            result = await sync_imap_to_database_async()
        self.assertTrue(result["ok"])
        self.assertEqual(result["synced"], 3)
        self.assertEqual(result["accounts"], 1)
        sync_mock.assert_awaited()


if __name__ == "__main__":
    unittest.main()
