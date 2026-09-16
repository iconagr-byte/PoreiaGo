"""Mailbox trash must survive IMAP sync (Κάδος persistence)."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("AUTH_JWT_SECRET", "test-mailbox-trash-jwt-secret-32c!")


class TrashPersistUpsertTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(self._tmpdir.name) / "mailbox-trash.db"
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

    async def test_upsert_does_not_resurrect_trashed_message(self):
        from email_client.store import list_messages, update_message, upsert_message

        msg = await upsert_message(
            {
                "message_id": "<re-onlyfans@test>",
                "email_settings_id": "EMS-1",
                "subject": "Re: onlyfans",
                "sender": "a@b.com",
                "recipient": "info@office.com",
                "body_html": "<p>x</p>",
                "folder": "Inbox",
                "date": "2026-03-01T00:00:00+00:00",
                "imap_uid": "42",
            }
        )
        self.assertIsNotNone(msg)
        trashed = await update_message(msg["id"], {"folder": "Trash", "is_read": True})
        self.assertEqual(trashed["folder"], "Trash")

        # Simulate IMAP sync re-importing the same Message-ID from INBOX.
        revived = await upsert_message(
            {
                "message_id": "<re-onlyfans@test>",
                "email_settings_id": "EMS-1",
                "subject": "Re: onlyfans",
                "sender": "a@b.com",
                "recipient": "info@office.com",
                "body_html": "<p>x</p>",
                "folder": "Inbox",
                "date": "2026-03-01T00:00:00+00:00",
                "imap_uid": "42",
            }
        )
        self.assertEqual(revived["id"], msg["id"])
        self.assertEqual(revived["folder"], "Trash")
        inbox = await list_messages(folder="Inbox", email_settings_id="EMS-1")
        trash = await list_messages(folder="Trash", email_settings_id="EMS-1")
        self.assertEqual(inbox, [])
        self.assertEqual(len(trash), 1)

    async def test_upsert_can_still_update_active_inbox_message(self):
        from email_client.store import upsert_message

        msg = await upsert_message(
            {
                "message_id": "<alive@test>",
                "email_settings_id": "EMS-1",
                "subject": "Hello",
                "sender": "a@b.com",
                "recipient": "info@office.com",
                "body_html": "<p>1</p>",
                "folder": "Inbox",
                "date": "2026-03-01T00:00:00+00:00",
            }
        )
        updated = await upsert_message(
            {
                "message_id": "<alive@test>",
                "email_settings_id": "EMS-1",
                "subject": "Hello again",
                "sender": "a@b.com",
                "recipient": "info@office.com",
                "body_html": "<p>2</p>",
                "folder": "Inbox",
                "is_read": True,
                "date": "2026-03-01T00:00:00+00:00",
            }
        )
        self.assertEqual(updated["id"], msg["id"])
        self.assertEqual(updated["folder"], "Inbox")
        self.assertEqual(updated["subject"], "Hello again")
        self.assertTrue(updated["is_read"])


class MoveToTrashImapTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(self._tmpdir.name) / "mailbox-trash-imap.db"
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

    async def test_move_to_trash_calls_imap_then_sets_local_folder(self):
        from email_client.mailbox_service import move_to_trash
        from email_client.store import upsert_message

        msg = await upsert_message(
            {
                "message_id": "<bulk@test>",
                "email_settings_id": "EMS-imap",
                "subject": "Bulk",
                "sender": "a@b.com",
                "recipient": "info@office.com",
                "body_html": "<p>x</p>",
                "folder": "Inbox",
                "date": "2026-03-01T00:00:00+00:00",
                "imap_uid": "7",
            }
        )
        account = {
            "id": "EMS-imap",
            "email_address": "info@office.com",
            "imap_host": "mail.example.com",
            "imap_port": 993,
            "imap_secure": True,
            "mail_username": "info@office.com",
            "mail_password": "secret",
            "imap_mailbox": "INBOX",
            "imap_folder_sent": "Sent",
            "imap_folder_spam": "Spam",
        }
        with patch(
            "email_client.mailbox_service.get_settings",
            new_callable=AsyncMock,
            return_value=account,
        ), patch(
            "email_client.mailbox_service.imap_move_message_to_trash",
            return_value={"ok": True, "moved": True, "error": None},
        ) as imap_mock:
            updated = await move_to_trash(msg["id"])
        self.assertEqual(updated["folder"], "Trash")
        imap_mock.assert_called_once()
        kwargs = imap_mock.call_args.kwargs
        self.assertEqual(kwargs["message_id"], "<bulk@test>")
        self.assertEqual(kwargs["local_folder"], "Inbox")

    async def test_move_to_trash_still_works_when_imap_fails(self):
        from email_client.mailbox_service import move_to_trash
        from email_client.store import upsert_message

        msg = await upsert_message(
            {
                "message_id": "<offline@test>",
                "email_settings_id": "EMS-imap",
                "subject": "Offline",
                "sender": "a@b.com",
                "recipient": "info@office.com",
                "body_html": "<p>x</p>",
                "folder": "Inbox",
                "date": "2026-03-01T00:00:00+00:00",
            }
        )
        with patch(
            "email_client.mailbox_service.get_settings",
            new_callable=AsyncMock,
            return_value={
                "id": "EMS-imap",
                "email_address": "info@office.com",
                "imap_host": "mail.example.com",
                "mail_username": "info@office.com",
                "mail_password": "secret",
            },
        ), patch(
            "email_client.mailbox_service.imap_move_message_to_trash",
            side_effect=RuntimeError("timeout"),
        ):
            updated = await move_to_trash(msg["id"])
        self.assertEqual(updated["folder"], "Trash")


class ImapTrashHelpersTests(unittest.TestCase):
    def test_resolve_trash_prefers_special_use(self):
        from email_client.imap_trash import _resolve_trash_mailbox

        client = MagicMock()
        client.list.return_value = (
            "OK",
            [
                b'(\\HasChildren) "." INBOX',
                b'(\\HasNoChildren \\Trash) "." INBOX.Trash',
            ],
        )
        box = _resolve_trash_mailbox(client, {"imap_folder_trash": "Trash"})
        self.assertEqual(box, "INBOX.Trash")

    def test_message_id_candidates(self):
        from email_client.imap_trash import _message_id_candidates

        self.assertEqual(
            _message_id_candidates("<a@b>"),
            ["<a@b>", "a@b"],
        )
        self.assertEqual(
            _message_id_candidates("a@b"),
            ["a@b", "<a@b>"],
        )

    def test_copy_delete_fallback_when_move_missing(self):
        from email_client.imap_trash import imap_move_message_to_trash

        client = MagicMock()
        client.list.return_value = (
            "OK",
            [
                b'(\\HasChildren) "." INBOX',
                b'(\\HasNoChildren \\Trash) "." INBOX.Trash',
            ],
        )
        client.select.return_value = ("OK", [b"1"])
        client.search.return_value = ("OK", [b"3"])
        client._simple_command.side_effect = AttributeError("no MOVE")
        client.copy.return_value = ("OK", [b"1"])
        client.store.return_value = ("OK", [b"1"])
        client.expunge.return_value = ("OK", [b"1"])
        client.logout.return_value = ("BYE", [])

        with patch("email_client.imap_trash.connect_imap", return_value=client):
            result = imap_move_message_to_trash(
                {
                    "host": "mail.example.com",
                    "user": "info@office.com",
                    "password": "secret",
                    "use_ssl": True,
                    "imap_mailbox": "INBOX",
                    "imap_folder_sent": "Sent",
                    "imap_folder_spam": "Spam",
                    "imap_folder_trash": "Trash",
                },
                message_id="<x@y>",
                local_folder="Inbox",
            )
        self.assertTrue(result["ok"])
        self.assertTrue(result["moved"])
        client.copy.assert_called()
        client.store.assert_called()
        client.expunge.assert_called()


if __name__ == "__main__":
    unittest.main()
