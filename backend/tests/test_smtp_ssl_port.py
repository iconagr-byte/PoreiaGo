"""SMTP config — port 465 uses SSL, 587 uses STARTTLS."""

from __future__ import annotations

import unittest
import unittest.mock


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

    def test_cpanel_sixteen_char_spaced_password_not_stripped(self):
        """Do not treat cPanel passwords as Google app passwords."""
        from email_client.dynamic_mailer import normalize_mail_password

        raw = "abcd efgh ijkl mnop"  # 16 letters + spaces
        self.assertEqual(
            normalize_mail_password(
                raw,
                host="mail.achilliotravel.com",
                email="info@achilliotravel.com",
            ),
            raw,
        )

    def test_smtp_535_maps_to_auth_fail_hint(self):
        from email_client.dynamic_mailer import SMTP_AUTH_FAIL_HINT_EL, _format_smtp_error

        exc = Exception("(535, b'Incorrect authentication data')")
        self.assertEqual(_format_smtp_error(exc), SMTP_AUTH_FAIL_HINT_EL)
        self.assertIn("δεν είναι firewall", _format_smtp_error(exc))
        self.assertIn("webmail", _format_smtp_error(exc))

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

    def test_auth_debug_never_leaks_password(self):
        from email_client.dynamic_mailer import auth_debug_meta, test_account_connection

        account = {
            "imap_host": "mail.achilliotravel.com",
            "imap_port": 993,
            "smtp_host": "mail.achilliotravel.com",
            "smtp_port": 465,
            "email_address": "info@achilliotravel.com",
            "mail_username": "info@achilliotravel.com",
            "mail_password": "SecretPass99",
            "imap_secure": True,
        }
        meta = auth_debug_meta(account)
        self.assertEqual(meta["username"], "info@achilliotravel.com")
        self.assertEqual(meta["password_len"], len("SecretPass99"))
        self.assertNotIn("SecretPass99", str(meta))



class MailProbeDiagnosticsTests(unittest.TestCase):
    def test_remote_auth_flag_when_imap_auth_fails_after_tcp(self):
        from email_client import dynamic_mailer as dm

        account = {
            "imap_host": "mail.example-office.gr",
            "imap_port": 993,
            "smtp_host": "mail.example-office.gr",
            "smtp_port": 465,
            "email_address": "info@example-office.gr",
            "mail_username": "info@example-office.gr",
            "mail_password": "DefinitelyWrongPass99",
            "imap_secure": True,
        }

        def fake_imap(_cfg):
            return {
                "ok": False,
                "tcp_ok": True,
                "peer_ip": "1.2.3.4",
                "auth_mechs": "PLAIN",
                "server_reply": "[AUTHENTICATIONFAILED] Authentication failed.",
                "error": Exception("[AUTHENTICATIONFAILED] Authentication failed."),
            }

        def fake_smtp(_cfg):
            return {
                "ok": False,
                "tcp_ok": True,
                "peer_ip": "1.2.3.4",
                "auth_mechs": "PLAIN LOGIN",
                "server_reply": "(535, b'Incorrect authentication data')",
                "error": Exception("535 Incorrect authentication data"),
            }

        with (
            unittest.mock.patch.object(dm, "probe_imap_login", side_effect=fake_imap),
            unittest.mock.patch.object(dm, "probe_smtp_login", side_effect=fake_smtp),
            unittest.mock.patch.object(dm, "discover_egress_ip", return_value="169.58.199.186"),
        ):
            result = dm.test_account_connection(account)

        self.assertFalse(result["ok"])
        self.assertFalse(result["imap"].get("ok"))
        self.assertTrue(result.get("credentials_rejected") or result.get("remote_auth"))
        self.assertTrue(result["remote_auth"])
        self.assertFalse(result.get("wrong_mail_host"))
        diag = result.get("diagnostics") or {}
        self.assertTrue(diag.get("imap_tcp_ok"))
        self.assertEqual(diag.get("egress_ip"), "169.58.199.186")
        auth_debug = result.get("auth_debug") or {}
        self.assertIn("password_len", auth_debug)
        self.assertNotIn("DefinitelyWrongPass99", str(result))

    def test_wrong_mail_host_flag_for_achillio_dns(self):
        from email_client import dynamic_mailer as dm

        account = {
            "imap_host": "mail.achilliotravel.com",
            "imap_port": 993,
            "smtp_host": "mail.achilliotravel.com",
            "smtp_port": 465,
            "email_address": "info@achilliotravel.com",
            "mail_username": "info@achilliotravel.com",
            "mail_password": "DefinitelyWrongPass99",
            "imap_secure": True,
        }

        def fake_imap(_cfg):
            return {
                "ok": False,
                "tcp_ok": True,
                "peer_ip": "185.104.144.132",
                "auth_mechs": "PLAIN",
                "server_reply": "[AUTHENTICATIONFAILED] Authentication failed.",
                "error": Exception("[AUTHENTICATIONFAILED] Authentication failed."),
            }

        def fake_smtp(_cfg):
            return {
                "ok": False,
                "tcp_ok": True,
                "peer_ip": "185.104.144.132",
                "auth_mechs": "PLAIN LOGIN",
                "server_reply": "(535, b'Incorrect authentication data')",
                "error": Exception("535 Incorrect authentication data"),
            }

        with (
            unittest.mock.patch.object(dm, "probe_imap_login", side_effect=fake_imap),
            unittest.mock.patch.object(dm, "probe_smtp_login", side_effect=fake_smtp),
            unittest.mock.patch.object(dm, "discover_egress_ip", return_value="169.58.199.186"),
        ):
            result = dm.test_account_connection(account)

        self.assertFalse(result["ok"])
        diag = result.get("diagnostics") or {}
        self.assertTrue(result.get("wrong_mail_host") or diag.get("wrong_mail_host"))
        self.assertEqual(
            result.get("suggested_mail_host") or diag.get("suggested_mail_host"),
            "srv23.intechs.gr",
        )
        # Prefer wrong-host guidance over remote-auth whitelist for this DNS case.
        self.assertFalse(result.get("remote_auth"))
        self.assertNotIn("DefinitelyWrongPass99", str(result))



if __name__ == "__main__":
    unittest.main()
