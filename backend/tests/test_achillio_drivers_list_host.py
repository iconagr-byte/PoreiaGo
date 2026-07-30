"""AchillioTravel Host must list + claim DEMO legacy drivers on Οδηγοί."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from api import admin_platform as ap


class AchillioDriversListHostTests(unittest.IsolatedAsyncioTestCase):
    def test_host_detection_uses_office_header_and_origin(self):
        req = SimpleNamespace(
            headers={
                "host": "api-blue:8000",
                "x-poreiago-office-host": "www.achilliotravel.com",
            }
        )
        self.assertTrue(ap._host_looks_like_achillio(req))

        req2 = SimpleNamespace(
            headers={
                "host": "api.poreiago.com",
                "origin": "https://www.achilliotravel.com",
            }
        )
        self.assertTrue(ap._host_looks_like_achillio(req2))

        req3 = SimpleNamespace(headers={"host": "api.poreiago.com"})
        self.assertFalse(ap._host_looks_like_achillio(req3))

    async def test_drivers_list_tenant_prefers_achillio_host_mapping(self):
        achillio_tid = str(uuid4())
        req = SimpleNamespace(
            headers={
                "host": "www.achilliotravel.com",
                "x-poreiago-office-host": "www.achilliotravel.com",
            },
            state=SimpleNamespace(tenant_id=ap.DEMO_TENANT_ID),
        )

        with patch.object(
            ap,
            "_resolve_achillio_tenant_id_from_request",
            new=AsyncMock(return_value=achillio_tid),
        ):
            tid, include, claim = await ap._drivers_list_tenant_id(req)

        self.assertEqual(tid, achillio_tid)
        self.assertTrue(include)
        self.assertTrue(claim)

    async def test_poreiago_host_does_not_auto_claim(self):
        other = str(uuid4())
        platform = str(uuid4())
        req = SimpleNamespace(
            headers={"host": "www.poreiago.com"},
            state=SimpleNamespace(tenant_id=other),
        )
        with patch.object(ap, "_tenant_is_achillio_office", new=AsyncMock(return_value=False)):
            with patch(
                "travel_platform.operations.master_qr_bridge.resolve_platform_tenant_id",
                new=AsyncMock(return_value=platform),
            ):
                tid, include, claim = await ap._drivers_list_tenant_id(req)

        self.assertEqual(tid, other)
        self.assertFalse(include)
        self.assertFalse(claim)


if __name__ == "__main__":
    unittest.main()
