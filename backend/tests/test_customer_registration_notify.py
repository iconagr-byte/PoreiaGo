"""Customer registration notify + tenant account list."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

from ticketing.customer_registration_notify import notify_customer_registration


def test_notify_syncs_crm_and_sends_emails():
    account = {
        "email": "new.guest@example.com",
        "name": "Νέος Πελάτης",
        "phone": "",
        "picture": "",
        "auth_provider": "email",
        "customer_id": "CUST-042",
    }
    with (
        patch(
            "ticketing.customer_registration_notify._admin_email_for_tenant",
            return_value="office@achilliotravel.com",
        ),
        patch(
            "ticketing.customer_registration_notify._office_label",
            return_value="Achillio Travel",
        ),
        patch(
            "ticketing.customer_registration_notify._sync_office_crm",
        ) as sync_crm,
        patch(
            "ticketing.customer_registration_notify.send_email",
            new_callable=AsyncMock,
        ) as send,
    ):
        asyncio.run(
            notify_customer_registration(
                account, tenant_id="tenant-achillio", method="email"
            )
        )
        sync_crm.assert_called_once()
        assert send.await_count == 2
        to_addrs = {call.args[0] for call in send.await_args_list}
        assert "new.guest@example.com" in to_addrs
        assert "office@achilliotravel.com" in to_addrs
