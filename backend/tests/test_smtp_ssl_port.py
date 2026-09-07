"""SMTP config — port 465 uses SSL, 587 uses STARTTLS."""

from __future__ import annotations

import unittest


class SmtpConfigTests(unittest.TestCase):
    def test_port_587_uses_starttls(self):
        from email_client.dynamic_mailer import settings_to_smtp_config

        cfg = settings_to_smtp_config(
            {
                "smtp_host": "mail.example.com",
                "smtp_port": 587,
                "smtp_secure": True,
                "mail_username": "a@b.com",
                "email_address": "a@b.com",
            }
        )
        self.assertFalse(cfg["use_ssl"])
        self.assertTrue(cfg["use_tls"])

    def test_port_465_uses_ssl_not_starttls(self):
        from email_client.dynamic_mailer import settings_to_smtp_config

        cfg = settings_to_smtp_config(
            {
                "smtp_host": "mail.example.com",
                "smtp_port": 465,
                "smtp_secure": True,  # even if checkbox left on, 465 forces SSL
                "mail_username": "a@b.com",
                "email_address": "a@b.com",
            }
        )
        self.assertTrue(cfg["use_ssl"])
        self.assertFalse(cfg["use_tls"])

    def test_gmail_app_password_spaces_stripped(self):
        from email_client.dynamic_mailer import normalize_mail_password, settings_to_imap_config

        self.assertEqual(
            normalize_mail_password("abcd efgh ijkl mnop", host="imap.gmail.com", email="a@gmail.com"),
            "abcdefghijklmnop",
        )
        cfg = settings_to_imap_config(
            {
                "imap_host": "imap.gmail.com",
                "imap_port": 993,
                "email_address": "a@gmail.com",
                "mail_username": "a@gmail.com",
                "mail_password": "abcd efgh ijkl mnop",
                "imap_secure": True,
            }
        )
        self.assertEqual(cfg["password"], "abcdefghijklmnop")

    def test_cpanel_password_keeps_internal_spaces(self):
        from email_client.dynamic_mailer import normalize_mail_password

        self.assertEqual(
            normalize_mail_password(
                " my pass ",
                host="mail.achilliotravel.com",
                email="info@achilliotravel.com",
            ),
            "my pass",
        )

    def test_smtp_535_maps_to_remote_auth_hint(self):
        from email_client.dynamic_mailer import SMTP_REMOTE_AUTH_HINT_EL, _format_smtp_error

        exc = Exception("(535, b'Incorrect authentication data')")
        self.assertEqual(_format_smtp_error(exc), SMTP_REMOTE_AUTH_HINT_EL)

    def test_missing_password_rejected(self):
        from email_client.dynamic_mailer import MISSING_PASSWORD_HINT_EL, test_imap_connection

        r = test_imap_connection(
            {
                "imap_host": "mail.example.com",
                "imap_port": 993,
                "email_address": "a@b.com",
                "mail_username": "a@b.com",
                "mail_password": "",
                "imap_secure": True,
            }
        )
        self.assertFalse(r["ok"])
        self.assertEqual(r["error"], MISSING_PASSWORD_HINT_EL)


if __name__ == "__main__":
    unittest.main()
