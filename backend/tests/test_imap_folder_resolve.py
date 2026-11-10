"""cPanel/Dovecot Sent folder resolution (INBOX.Sent vs bare Sent)."""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock

from email_client.constants import FOLDER_INBOX, FOLDER_SENT, FOLDER_SPAM
from email_client.imap_sync import (
    _parse_list_mailbox,
    _pick_special_mailbox,
    _resolve_folder_names,
)


class ImapFolderResolveTests(unittest.TestCase):
    def test_parse_list_line_with_sent_flag(self):
        flags, name = _parse_list_mailbox(
            b'(\\HasNoChildren \\UnMarked \\Sent) "." INBOX.Sent'
        )
        self.assertIn("\\SENT", flags.split())
        self.assertEqual(name, "INBOX.Sent")

    def test_pick_sent_prefers_special_use_over_bare_sent(self):
        listed = [
            ("\\HASNOCHILDREN", "INBOX"),
            ("\\HASNOCHILDREN \\SENT", "INBOX.Sent"),
            ("\\HASNOCHILDREN \\JUNK", "INBOX.spam"),
        ]
        picked = _pick_special_mailbox(
            listed,
            flag="\\Sent",
            preferred="Sent",
            fallbacks=("INBOX.Sent", "Sent"),
        )
        self.assertEqual(picked, "INBOX.Sent")

    def test_resolve_rewrites_sent_and_spam_for_cpanel(self):
        client = MagicMock()
        client.list.return_value = (
            "OK",
            [
                b'(\\HasChildren) "." INBOX',
                b'(\\HasNoChildren \\Sent) "." INBOX.Sent',
                b'(\\HasNoChildren \\Junk) "." INBOX.spam',
            ],
        )
        cfg = {
            "imap_mailbox": "INBOX",
            "imap_folder_sent": "Sent",
            "imap_folder_spam": "Spam",
        }
        resolved = _resolve_folder_names(client, cfg)
        self.assertEqual(
            resolved,
            [
                ("INBOX", FOLDER_INBOX),
                ("INBOX.Sent", FOLDER_SENT),
                ("INBOX.spam", FOLDER_SPAM),
            ],
        )


if __name__ == "__main__":
    unittest.main()
