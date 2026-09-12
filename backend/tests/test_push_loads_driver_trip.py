"""Contract: office Push loads the excursion into the driver app."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import travel_platform.notifications.push_subscription_store as store

ROOT = Path(__file__).resolve().parents[2]


class PushLoadsDriverTripContractTests(unittest.TestCase):
    def test_sw_forwards_shift_invite_to_open_clients(self) -> None:
        sw = (ROOT / "public" / "driver-sw.js").read_text(encoding="utf-8")
        self.assertIn("DRIVER_SHIFT_INVITE", sw)
        self.assertIn("driver_shift_invite", sw)
        self.assertIn("client.postMessage", sw)
        # Prefer in-app bind over Client.navigate on iOS PWAs.
        self.assertIn("isShiftInvite", sw)

    def test_command_center_applies_shift_invite(self) -> None:
        cmd = (
            ROOT / "src" / "pages" / "driver" / "DriverCommandCenter.jsx"
        ).read_text(encoding="utf-8")
        self.assertIn("applyDriverShiftInvite", cmd)
        self.assertIn("DRIVER_SHIFT_INVITE", cmd)
        self.assertIn("φορτώθηκε", cmd)

    def test_master_qr_panel_requires_driver_and_syncs(self) -> None:
        panel = (
            ROOT / "src" / "components" / "admin" / "MasterQrPanel.jsx"
        ).read_text(encoding="utf-8")
        self.assertIn("Επιλέξτε οδηγό για Push", panel)
        self.assertIn("syncTripsToPostgres", panel)
        self.assertIn("frontendBase", panel)

    def test_notify_api_accepts_frontend_base(self) -> None:
        api = (ROOT / "src" / "services" / "platformApi.js").read_text(encoding="utf-8")
        self.assertIn("frontend_base", api)
        schema = (ROOT / "backend" / "schemas" / "platform_admin.py").read_text(
            encoding="utf-8"
        )
        self.assertIn("frontend_base", schema)

    def test_extract_token_helper_exists(self) -> None:
        helper = (
            ROOT / "src" / "lib" / "driver" / "applyDriverShiftInvite.js"
        ).read_text(encoding="utf-8")
        self.assertIn("extractMasterQrToken", helper)
        self.assertIn("exchangeMasterQr", helper)
        self.assertIn("clearDriverShiftLaunchState", helper)


class PushInvitePayloadTests(unittest.IsolatedAsyncioTestCase):
    async def test_push_payload_includes_auth_and_trip(self) -> None:
        from travel_platform.notifications.driver_push_service import (
            send_driver_shift_invite_push,
        )

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "push_subscriptions.json"
            with patch.object(store, "_STORE_FILE", path):
                store.upsert_subscription(
                    email="driver:x@t1",
                    endpoint="https://push.example/x",
                    keys={"p256dh": "a", "auth": "b"},
                    tenant_id="t1",
                    audience="driver",
                    driver_id="drv-1",
                )
                captured: list[dict] = []

                async def _capture(sub, payload):
                    captured.append(payload)
                    return {"sent": True}

                with patch(
                    "travel_platform.notifications.driver_push_service.web_push_configured",
                    return_value=True,
                ), patch(
                    "travel_platform.notifications.driver_push_service.send_push_to_subscription",
                    new=_capture,
                ):
                    result = await send_driver_shift_invite_push(
                        tenant_id="t1",
                        trip_id=42,
                        driver_id="drv-1",
                        trip_title="Ναύπλιο",
                        auth_url="https://www.poreiago.com/driver/auth?token=mq1.abc",
                    )
                self.assertTrue(result.get("ok"))
                self.assertEqual(len(captured), 1)
                payload = captured[0]
                self.assertEqual(payload["data"]["type"], "driver_shift_invite")
                self.assertEqual(payload["data"]["trip_id"], 42)
                self.assertIn("/driver/auth?token=", payload["url"])
                self.assertIn("mq1.abc", payload["data"]["auth_url"])


class FrontendBaseAuthUrlTests(unittest.TestCase):
    def test_build_respects_override_base(self) -> None:
        from travel_platform.operations.master_qr_normalize import build_driver_auth_url

        url = build_driver_auth_url(
            "mq1.tok",
            base_url="https://www.poreiago.com",
        )
        self.assertTrue(url.startswith("https://www.poreiago.com/driver/auth?token="))


if __name__ == "__main__":
    unittest.main()
