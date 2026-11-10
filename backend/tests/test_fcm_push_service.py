"""Unit tests for FCM subscription helpers (no live Firebase calls)."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from travel_platform.notifications.fcm_push_service import (
    fcm_endpoint_for_token,
    fcm_token_from_subscription,
    is_fcm_subscription,
    send_fcm_to_subscription,
)


class FcmPushServiceTests(unittest.IsolatedAsyncioTestCase):
    def test_endpoint_helpers(self) -> None:
        self.assertEqual(fcm_endpoint_for_token("abc"), "fcm:abc")
        self.assertTrue(is_fcm_subscription({"channel": "fcm", "endpoint": "fcm:tok"}))
        self.assertTrue(is_fcm_subscription({"endpoint": "fcm:tok"}))
        self.assertFalse(is_fcm_subscription({"endpoint": "https://push.example/1"}))
        self.assertEqual(
            fcm_token_from_subscription({"endpoint": "fcm:tok123", "channel": "fcm"}),
            "tok123",
        )

    async def test_send_skips_when_not_configured(self) -> None:
        with patch(
            "travel_platform.notifications.fcm_push_service.fcm_configured",
            return_value=False,
        ):
            result = await send_fcm_to_subscription(
                {"endpoint": "fcm:tok", "channel": "fcm"},
                {"title": "t", "body": "b"},
            )
        self.assertTrue(result.get("skipped"))
        self.assertEqual(result.get("reason"), "fcm_not_configured")


if __name__ == "__main__":
    unittest.main()
