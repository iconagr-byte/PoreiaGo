"""Tests for fiscal admin alert email."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from app.services.fiscal_alert_service import snapshot_has_issues
from ticketing.fiscal_admin_alert_email import build_fiscal_alert_html


class FiscalAdminAlertEmailTests(unittest.TestCase):
    def test_snapshot_has_issues(self):
        self.assertFalse(snapshot_has_issues({"totals": {"failed": 0, "open": 0}}))
        self.assertTrue(snapshot_has_issues({"totals": {"failed": 1}}))

    def test_build_html_contains_totals(self):
        html = build_fiscal_alert_html(
            {
                "totals": {"failed": 2, "open": 3, "stuck_candidates": 1, "reconciliation_gaps": 4},
                "tenants": [{"slug": "achillio", "name": "Test", "health": "degraded", "failed": 2, "open": 3, "stuck_candidates": 1, "reconciliation_gaps": 4}],
            },
            kind="digest",
        )
        self.assertIn("Αποτυχίες", html)
        self.assertIn("achillio", html)

    def test_send_skips_when_disabled(self):
        import asyncio

        from ticketing.fiscal_admin_alert_email import send_fiscal_pipeline_alert

        async def run():
            with patch("ticketing.fiscal_admin_alert_email._alerts_enabled", return_value=False):
                return await send_fiscal_pipeline_alert({"has_issues": True, "totals": {}, "tenants": []})

        result = asyncio.run(run())
        self.assertEqual(result.get("reason"), "disabled")

    def test_send_skips_cooldown(self):
        import asyncio

        from ticketing.fiscal_admin_alert_email import send_fiscal_pipeline_alert

        async def run():
            with (
                patch("ticketing.fiscal_admin_alert_email._alerts_enabled", return_value=True),
                patch("ticketing.fiscal_admin_alert_email._cooldown_allows", return_value=False),
            ):
                return await send_fiscal_pipeline_alert(
                    {"has_issues": True, "totals": {"failed": 1}, "tenants": []},
                    kind="immediate",
                )

        result = asyncio.run(run())
        self.assertEqual(result.get("reason"), "cooldown")

    def test_send_success(self):
        import asyncio

        from ticketing.fiscal_admin_alert_email import send_fiscal_pipeline_alert

        async def run():
            with (
                patch("ticketing.fiscal_admin_alert_email._alerts_enabled", return_value=True),
                patch("ticketing.fiscal_admin_alert_email._cooldown_allows", return_value=True),
                patch("ticketing.fiscal_admin_alert_email._admin_recipient", return_value="admin@test.gr"),
                patch("ticketing.fiscal_admin_alert_email.send_email", new_callable=AsyncMock) as send,
                patch("ticketing.fiscal_admin_alert_email._mark_sent") as mark_sent,
            ):
                send.return_value = "email-smtp-admin@test.gr"
                result = await send_fiscal_pipeline_alert(
                    {"has_issues": True, "totals": {"failed": 1}, "tenants": []},
                    kind="digest",
                    force=True,
                )
                mark_sent.assert_called_once_with("digest")
                return result

        result = asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
