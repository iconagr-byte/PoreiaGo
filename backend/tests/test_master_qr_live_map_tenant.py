"""Master QR / GPS tenant alignment for office live map."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from travel_platform.operations.master_qr_bridge import coerce_driver_tenant_id
from travel_platform.operations.master_qr_local import DEFAULT_TENANT

PLATFORM = "81ce186d-40fd-4f51-8e62-1353a9e68f33"


class CoerceTenantTests(unittest.TestCase):
    def test_demo_remaps_to_platform(self):
        self.assertEqual(
            coerce_driver_tenant_id(DEFAULT_TENANT, platform_tenant_id=PLATFORM),
            PLATFORM,
        )

    def test_empty_remaps_to_platform(self):
        self.assertEqual(coerce_driver_tenant_id("", platform_tenant_id=PLATFORM), PLATFORM)

    def test_keeps_real_tenant(self):
        self.assertEqual(
            coerce_driver_tenant_id(PLATFORM, platform_tenant_id=PLATFORM),
            PLATFORM,
        )


class IssueMasterQrTenantTests(unittest.IsolatedAsyncioTestCase):
    async def test_issue_uses_platform_when_no_tenant(self):
        from travel_platform.operations import master_qr_bridge as bridge

        with patch.object(bridge, "resolve_platform_tenant_id", new=AsyncMock(return_value=PLATFORM)):
            with patch.object(bridge, "saas_db_available", new=AsyncMock(return_value=False)):
                with patch.object(
                    bridge,
                    "issue_local",
                    return_value={
                        "qr_content": "https://x/driver/auth?token=mq1.x",
                        "trip_id": 99,
                        "tenant_id": PLATFORM,
                        "expires_at": 1,
                        "manifest_url": "/m",
                    },
                ) as issue_local:
                    result = await bridge.issue_master_qr_hybrid(99)
                    self.assertEqual(result["tenant_id"], PLATFORM)
                    issue_local.assert_called_once()
                    kwargs = issue_local.call_args.kwargs
                    self.assertEqual(kwargs.get("tenant_id"), PLATFORM)


if __name__ == "__main__":
    unittest.main()
