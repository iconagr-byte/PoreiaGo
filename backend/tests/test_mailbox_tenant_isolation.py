"""Mailbox API must never leak another office's emails (GDPR / office seal)."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("AUTH_JWT_SECRET", "test-mailbox-seal-jwt-secret-32chars!")


def _request(tenant_id: str):
    return SimpleNamespace(state=SimpleNamespace(tenant_id=tenant_id))


class MailboxTenantIsolationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(self._tmpdir.name) / "mailbox-seal.db"
        from ticketing import config as ticketing_config
        from ticketing import db as ticketing_db

        self._prev_sqlite = ticketing_config.settings.sqlite_path
        ticketing_config.settings.sqlite_path = str(db_path)
        await ticketing_db.init_ticketing_db()
        from email_marketing.store import init_email_marketing_tables
        from email_client.store import init_email_client_tables

        await init_email_marketing_tables()
        await init_email_client_tables()

        from email_client.settings_store import create_settings
        from email_client.store import upsert_message

        self.achillio = await create_settings(
            {
                "owner_key": "tenant:achillio-office",
                "email_address": "info@achilliotravel.com",
                "imap_host": "mail.achilliotravel.com",
                "smtp_host": "mail.achilliotravel.com",
                "mail_username": "info@achilliotravel.com",
                "mail_password": "secret",
            }
        )
        self.poreiago = await create_settings(
            {
                "owner_key": "tenant:poreiago-office",
                "email_address": "hello@poreiago.com",
                "imap_host": "mail.poreiago.com",
                "smtp_host": "mail.poreiago.com",
                "mail_username": "hello@poreiago.com",
                "mail_password": "secret",
            }
        )
        self.ach_msg, _ = await upsert_message(
            {
                "message_id": "<achillio-booking@test>",
                "email_settings_id": self.achillio["id"],
                "subject": "[Γραφείο] Νέα κράτηση Achillio",
                "sender": "info@achilliotravel.com",
                "recipient": "info@achilliotravel.com",
                "body_html": "<p>tenant secret</p>",
                "folder": "Inbox",
                "date": "2026-11-02T00:00:00+00:00",
            }
        )
        self.por_msg, _ = await upsert_message(
            {
                "message_id": "<poreiago-note@test>",
                "email_settings_id": self.poreiago["id"],
                "subject": "PoreiaGo only",
                "sender": "a@b.com",
                "recipient": "hello@poreiago.com",
                "body_html": "<p>ok</p>",
                "folder": "Inbox",
                "date": "2026-11-02T01:00:00+00:00",
            }
        )

    async def asyncTearDown(self):
        from ticketing import config as ticketing_config
        from ticketing import db as ticketing_db

        await ticketing_db.close_ticketing_db()
        ticketing_config.settings.sqlite_path = self._prev_sqlite
        self._tmpdir.cleanup()

    async def test_poreiago_list_hides_achillio_when_unscoped(self):
        from api.email_mailbox_router import list_mailbox_messages

        rows = await list_mailbox_messages(
            _request("poreiago-office"),
            folder="Inbox",
            email_settings_id=None,
            limit=50,
            offset=0,
        )
        subjects = {r.subject for r in rows}
        self.assertIn("PoreiaGo only", subjects)
        self.assertNotIn("[Γραφείο] Νέα κράτηση Achillio", subjects)

    async def test_poreiago_without_accounts_sees_empty_not_achillio(self):
        from api.email_mailbox_router import list_mailbox_messages

        rows = await list_mailbox_messages(
            _request("empty-office-no-mail"),
            folder="Inbox",
            email_settings_id=None,
            limit=50,
            offset=0,
        )
        self.assertEqual(rows, [])

    async def test_cannot_open_foreign_message_by_id(self):
        from api.email_mailbox_router import get_mailbox_message
        from fastapi import HTTPException

        with self.assertRaises(HTTPException) as ctx:
            await get_mailbox_message(self.ach_msg["id"], _request("poreiago-office"))
        self.assertEqual(ctx.exception.status_code, 404)

    async def test_foreign_account_id_returns_404(self):
        from api.email_mailbox_router import list_mailbox_messages
        from fastapi import HTTPException

        with self.assertRaises(HTTPException) as ctx:
            await list_mailbox_messages(
                _request("poreiago-office"),
                folder="Inbox",
                email_settings_id=self.achillio["id"],
                limit=50,
                offset=0,
            )
        self.assertEqual(ctx.exception.status_code, 404)

    async def test_store_empty_ids_returns_empty(self):
        from email_client.store import list_messages

        rows = await list_messages(folder="Inbox", email_settings_ids=[])
        self.assertEqual(rows, [])

    async def test_sync_owner_key_skips_other_offices(self):
        from email_client.imap_sync import sync_imap_to_database_async

        with patch(
            "email_client.imap_sync.sync_account_imap",
            new_callable=AsyncMock,
            return_value={"ok": True, "synced": 1, "folders": {"Inbox": 1}, "errors": []},
        ) as sync_mock:
            result = await sync_imap_to_database_async(owner_key="tenant:poreiago-office")
        self.assertTrue(result["ok"])
        self.assertEqual(result["accounts"], 1)
        synced_ids = [c.args[0]["id"] for c in sync_mock.await_args_list]
        self.assertEqual(synced_ids, [self.poreiago["id"]])


if __name__ == "__main__":
    unittest.main()
