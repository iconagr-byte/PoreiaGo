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


if __name__ == "__main__":
    unittest.main()
