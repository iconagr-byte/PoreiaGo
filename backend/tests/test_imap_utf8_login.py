"""IMAP UTF-8 login — non-ascii credentials must not crash in ascii mode."""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch


class ImapUtf8LoginTests(unittest.TestCase):
    def test_enable_imap_utf8_sets_encoding(self):
        from email_client.imap_utf8 import enable_imap_utf8

        client = MagicMock()
        client._encoding = "ascii"
        client.utf8_enabled = False
        # Prefer real _mode_utf8 path when present on MagicMock via spec-less call
        enable_imap_utf8(client)
        client._mode_utf8.assert_called_once_with()

    def test_enable_imap_utf8_fallback_without_mode(self):
        from email_client.imap_utf8 import enable_imap_utf8

        class FakeClient:
            _encoding = "ascii"
            utf8_enabled = False

        client = FakeClient()
        enable_imap_utf8(client)
        self.assertEqual(client._encoding, "utf-8")
        self.assertTrue(client.utf8_enabled)

    def test_connect_imap_enables_utf8_before_login_with_greek_password(self):
        from email_client.imap_utf8 import connect_imap

        fake = MagicMock()
        fake._encoding = "ascii"
        fake.utf8_enabled = False

        def mode_utf8():
            fake._encoding = "utf-8"
            fake.utf8_enabled = True

        fake._mode_utf8.side_effect = mode_utf8

        with patch("email_client.imap_utf8.imaplib.IMAP4_SSL", return_value=fake):
            client = connect_imap(
                {
                    "host": "mail.example.com",
                    "port": 993,
                    "user": "info@example.com",
                    "password": "κωδικός1",
                    "use_ssl": True,
                }
            )

        self.assertIs(client, fake)
        fake._mode_utf8.assert_called_once_with()
        fake.login.assert_called_once_with("info@example.com", "κωδικός1")
        self.assertEqual(fake._encoding, "utf-8")

    def test_format_imap_connect_error_greek_hint(self):
        from email_client.imap_utf8 import ENCODING_HINT_EL, format_imap_connect_error

        exc = UnicodeEncodeError("ascii", "κωδικός", 0, 7, "ordinal not in range(128)")
        self.assertEqual(format_imap_connect_error(exc), ENCODING_HINT_EL)
        self.assertIn("encoding", format_imap_connect_error(exc))

    def test_format_timeout_hint(self):
        from email_client.imap_utf8 import TIMEOUT_HINT_EL, format_imap_connect_error

        exc = OSError(110, "Connection timed out")
        self.assertEqual(format_imap_connect_error(exc), TIMEOUT_HINT_EL)
        self.assertIn("34.141.98.145", format_imap_connect_error(exc))

    def test_format_auth_hint(self):
        from email_client.imap_utf8 import AUTH_HINT_EL, format_imap_connect_error

        exc = Exception("b'[AUTHENTICATIONFAILED] Authentication failed.'")
        self.assertEqual(format_imap_connect_error(exc), AUTH_HINT_EL)

    def test_fetch_surfaces_encoding_hint(self):
        from email_client.imap_sync import _fetch_all_from_imap

        with patch(
            "email_client.imap_sync._connect_imap",
            side_effect=UnicodeEncodeError("ascii", "κωδικός", 1, 7, "ordinal not in range(128)"),
        ):
            msgs, errors = _fetch_all_from_imap(
                {
                    "host": "mail.example.com",
                    "user": "info@example.com",
                    "password": "κωδικός1",
                },
                batch_per_folder=10,
            )
        self.assertEqual(msgs, [])
        self.assertEqual(len(errors), 1)
        self.assertIn("encoding", errors[0])
        self.assertNotIn("ascii codec", errors[0])


if __name__ == "__main__":
    unittest.main()
