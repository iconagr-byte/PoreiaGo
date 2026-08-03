"""Strict office isolation for Achillio DEMO claim — no header spoofing."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from api import admin_platform as ap


class AchillioDriversListHostTests(unittest.IsolatedAsyncioTestCase):
    def test_spoofable_office_header_ignored(self):
        """X-Poreiago-Office-Host / Origin must not authorize Achillio claim."""
        req = SimpleNamespace(
            headers={
                "host": "api.poreiago.com",
                "x-poreiago-office-host": "www.achilliotravel.com",
                "origin": "https://www.achilliotravel.com",
            }
        )
        self.assertFalse(ap._host_looks_like_achillio(req))

    def test_proxied_achillio_host_trusted(self):
        req = SimpleNamespace(headers={"host": "www.achilliotravel.com"})
        self.assertTrue(ap._host_looks_like_achillio(req))
        req2 = SimpleNamespace(
            headers={
                "host": "api-blue:8000",
                "x-forwarded-host": "www.achilliotravel.com",
            }
        )
        self.assertTrue(ap._host_looks_like_achillio(req2))

    async def test_poreiago_jwt_cannot_switch_to_achillio_via_host(self):
        poreiago = str(uuid4())
        achillio = str(uuid4())
        req = SimpleNamespace(
            headers={"host": "www.achilliotravel.com"},
            state=SimpleNamespace(tenant_id=poreiago),
        )
        with patch.object(ap, "_tenant_is_achillio_office", new=AsyncMock(return_value=False)):
            with patch.object(
                ap,
                "_resolve_achillio_tenant_id_from_request",
                new=AsyncMock(return_value=achillio),
            ):
                tid, include, claim = await ap._drivers_list_tenant_id(req)

        self.assertEqual(tid, poreiago)
        self.assertFalse(include)
        self.assertFalse(claim)

    async def test_achillio_jwt_on_poreiago_keeps_achillio_drivers(self):
        """Achillio JWT must still list Achilleas on www.poreiago.com (no empty remap)."""
        achillio = str(uuid4())
        platform = str(uuid4())
        req = SimpleNamespace(
            headers={"host": "www.poreiago.com"},
            state=SimpleNamespace(tenant_id=achillio),
        )
        with patch.object(ap, "_tenant_is_achillio_office", new=AsyncMock(return_value=True)):
            with patch.object(ap, "_request_is_platform_host", return_value=True):
                with patch.object(ap, "_request_is_impersonating", return_value=False):
                    with patch(
                        "travel_platform.settings.office_host_guard.resolve_poreiago_platform_tenant_id",
                        new=AsyncMock(return_value=platform),
                    ):
                        tid, include, claim = await ap._drivers_list_tenant_id(req)

        self.assertEqual(tid, achillio)
        self.assertNotEqual(tid, platform)
        self.assertFalse(include)
        self.assertFalse(claim)

    async def test_achillio_jwt_on_achillio_host_no_demo_claim(self):
        """On achilliotravel.com, Achillio JWT stays Achillio — still no DEMO claim."""
        achillio = str(uuid4())
        req = SimpleNamespace(
            headers={"host": "www.achilliotravel.com"},
            state=SimpleNamespace(tenant_id=achillio),
        )
        with patch.object(
            ap,
            "_resolve_achillio_tenant_id_from_request",
            new=AsyncMock(return_value=achillio),
        ):
            with patch.object(ap, "_tenant_is_achillio_office", new=AsyncMock(return_value=True)):
                tid, include, claim = await ap._drivers_list_tenant_id(req)

        self.assertEqual(tid, achillio)
        self.assertFalse(include)
        self.assertFalse(claim)

    async def test_demo_jwt_on_proxied_achillio_host_remaps_without_claim(self):
        achillio = str(uuid4())
        req = SimpleNamespace(
            headers={"host": "www.achilliotravel.com"},
            state=SimpleNamespace(tenant_id=ap.DEMO_TENANT_ID),
        )
        with patch.object(
            ap,
            "_resolve_achillio_tenant_id_from_request",
            new=AsyncMock(return_value=achillio),
        ):
            with patch.object(ap, "_tenant_is_achillio_office", new=AsyncMock(return_value=True)):
                tid, include, claim = await ap._drivers_list_tenant_id(req)

        self.assertEqual(tid, achillio)
        self.assertFalse(include)
        self.assertFalse(claim)

    async def test_fail_closed_when_not_achillio(self):
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
