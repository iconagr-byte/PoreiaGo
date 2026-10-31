"""Achillio Host remaps fleet tenant like drivers — admin matches public site."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from api import admin_platform as ap


class FleetTenantAchillioHostTests(unittest.IsolatedAsyncioTestCase):
    async def test_achillio_host_remaps_demo_jwt_to_office(self):
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
            with patch.object(
                ap,
                "_tenant_is_achillio_office",
                new=AsyncMock(return_value=True),
            ):
                tid = await ap._fleet_tenant_id(req)

        self.assertEqual(tid, achillio)

    async def test_spoofed_office_header_does_not_remap(self):
        req = SimpleNamespace(
            headers={
                "host": "api.poreiago.com",
                "x-poreiago-office-host": "www.achilliotravel.com",
            },
            state=SimpleNamespace(tenant_id=ap.DEMO_TENANT_ID),
        )
        with patch.object(ap, "_request_tenant_id", return_value=ap.DEMO_TENANT_ID):
            tid = await ap._fleet_tenant_id(req)
        self.assertEqual(tid, ap.DEMO_TENANT_ID)

    async def test_non_achillio_host_uses_jwt(self):
        office = str(uuid4())
        req = SimpleNamespace(
            headers={"host": "customer.example.com"},
            state=SimpleNamespace(tenant_id=office),
        )
        with patch.object(ap, "_request_tenant_id", return_value=office):
            tid = await ap._fleet_tenant_id(req)
        self.assertEqual(tid, office)
