"""Sealed My Wallet: /api/site/trips?tenant_id= returns that office's published catalog."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from api.site_appearance_router import get_public_office_trips


class SiteTripsByTenantIdTests(unittest.IsolatedAsyncioTestCase):
    async def test_explicit_tenant_id_skips_host_resolve(self):
        req = MagicMock()
        req.headers = {}
        rows = [
            {
                "id": 91001,
                "title": "Ημερήσια στα Μετέωρα",
                "destination": "Μετέωρα",
                "departureTime": "2026-06-15T08:00:00Z",
                "arrivalTime": "2026-06-15T12:30:00Z",
                "price": 45.0,
                "availableSeats": 12,
                "totalSeats": 30,
                "vehicleType": "Luxury Coach",
                "currency": "EUR",
                "image": "/images/meteora.png",
                "images": ["/images/meteora.png", "/images/demo/meteora-2.jpg"],
                "officeSeed": True,
                "catalogSource": "office_seed",
            }
        ]

        with (
            patch(
                "travel_platform.operations.tenant_trip_catalog_store.list_tenant_trips",
                return_value=rows,
            ) as listed,
            patch(
                "olympus.tenant.domain_resolver.DomainResolver.resolve",
                new=AsyncMock(),
            ) as resolve,
        ):
            out = await get_public_office_trips(
                req,
                host="127.0.0.1:8003",
                tenant_id="11111111-1111-1111-1111-111111111111",
            )

        listed.assert_called_once_with(
            "11111111-1111-1111-1111-111111111111",
            published_only=True,
        )
        resolve.assert_not_called()
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0].id, 91001)
        self.assertEqual(out[0].title, "Ημερήσια στα Μετέωρα")
        self.assertEqual(out[0].image, "/images/meteora.png")
        self.assertEqual(out[0].images[0], "/images/meteora.png")

    async def test_empty_without_tenant_or_host(self):
        req = MagicMock()
        req.headers = {}
        out = await get_public_office_trips(req, host=None, tenant_id=None)
        self.assertEqual(out, [])


if __name__ == "__main__":
    unittest.main()
