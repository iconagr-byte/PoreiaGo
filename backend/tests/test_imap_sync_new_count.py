"""IMAP sync ``synced`` counts only newly inserted messages."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("AUTH_JWT_SECRET", "test-imap-sync-new-count-jwt-secret!")


class ImapSyncNewCountTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(self._tmpdir.name) / "imap-new-count.db"
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

    async def test_second_sync_reports_zero_new(self):
        from email_client.imap_sync import sync_account_imap

        payload = [
            {
                "email_settings_id": "EMS-1",
                "message_id": "<already@test>",
                "subject": "Εκδρομές",
                "sender": "axilleas0@yahoo.gr",
                "recipient": "info@achilliotravel.com",
                "body_html": "<p>Θα πάμε</p>",
                "body_text": "Θα πάμε",
                "folder": "Inbox",
                "is_read": False,
                "date": "2026-10-27T15:47:00+00:00",
                "imap_uid": "1",
                "in_reply_to": None,
            }
        ]
        account = {
            "id": "EMS-1",
            "email_address": "info@achilliotravel.com",
            "imap_host": "mail.example.com",
            "imap_port": 993,
            "imap_secure": True,
            "mail_username": "info@achilliotravel.com",
            "mail_password": "secret",
            "has_password": True,
        }

        with patch(
            "email_client.imap_sync._fetch_all_from_imap",
            return_value=(payload, []),
        ), patch(
            "email_client.settings_store.record_sync_result",
            new_callable=AsyncMock,
        ):
            first = await sync_account_imap(account)
            second = await sync_account_imap(account)

        self.assertTrue(first["ok"])
        self.assertEqual(first["synced"], 1)
        self.assertTrue(second["ok"])
        self.assertEqual(second["synced"], 0)


if __name__ == "__main__":
    unittest.main()
