"""Office booking emails prefer the tenant Email Hub SMTP (Achillio mailbox)."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch


class TenantMailboxBookingEmailTests(unittest.IsolatedAsyncioTestCase):
    async def test_send_email_uses_tenant_mailbox_first(self) -> None:
        from ticketing.email_dispatch import send_email

        account = {
            "id": "acc1",
            "email_address": "info@achilliotravel.com",
            "smtp_host": "srv23.intechs.gr",
            "mail_username": "info@achilliotravel.com",
        }
        with patch(
            "email_client.settings_store.list_settings",
            new=AsyncMock(return_value=[{"id": "acc1"}]),
        ), patch(
            "email_client.settings_store.get_settings",
            new=AsyncMock(return_value=account),
        ), patch(
            "email_client.dynamic_mailer.send_email_smtp",
            new=AsyncMock(return_value="email-smtp-desk@achilliotravel.com"),
        ) as send_smtp, patch(
            "ticketing.email_dispatch._smtp_configured",
            return_value=False,
        ):
            ref = await send_email(
                "desk@achilliotravel.com",
                "Νέα κράτηση",
                "<p>hi</p>",
                tenant_id="tenant-achillio",
            )
        self.assertTrue(str(ref).startswith("email-"))
        send_smtp.assert_awaited_once()

    async def test_resolve_office_recipient_falls_back_to_mailbox(self) -> None:
        from ticketing.payment_confirmation_email import resolve_office_recipient

        with patch(
            "ticketing.payment_confirmation_email._read_notification_settings",
            return_value={"notify_customer": True, "notify_admin": True, "admin_email": ""},
        ), patch(
            "ticketing.payment_confirmation_email._tenant_office_emails",
            new=AsyncMock(return_value=[]),
        ), patch(
            "ticketing.payment_confirmation_email._tenant_mailbox_email",
            new=AsyncMock(return_value="info@achilliotravel.com"),
        ):
            email = await resolve_office_recipient("tenant-achillio")
        self.assertEqual(email, "info@achilliotravel.com")


if __name__ == "__main__":
    unittest.main()
