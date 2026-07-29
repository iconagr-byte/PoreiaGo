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


if __name__ == "__main__":
    unittest.main()
