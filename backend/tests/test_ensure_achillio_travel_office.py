"""ensure_achillio_travel_office creates/binds the real Achillio Travel office."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.tenant import TenantPlan
from app.services.tenant_modules import (
    ACHILLIO_TRAVEL_CANONICAL_DOMAIN,
    ACHILLIO_TRAVEL_CANONICAL_SLUG,
    ensure_achillio_travel_office,
)


class EnsureAchillioTravelOfficeTests(unittest.IsolatedAsyncioTestCase):
    async def test_creates_office_when_missing(self):
        session = AsyncMock()
        # 1) poison scan (empty), 2) slug lookup miss, 3) classifier scan empty
        empty = MagicMock()
        empty.scalars.return_value.all.return_value = []
        miss = MagicMock()
        miss.scalar_one_or_none.return_value = None
        session.execute = AsyncMock(side_effect=[empty, miss, empty])
        session.add = MagicMock()
        session.flush = AsyncMock()
        session.commit = AsyncMock()

        with patch("middleware.domain_tenant.clear_host_resolve_cache"):
            result = await ensure_achillio_travel_office(session)

        self.assertTrue(result["created"])
        self.assertTrue(result["domain_set"])
        self.assertEqual(result["slug"], ACHILLIO_TRAVEL_CANONICAL_SLUG)
        self.assertEqual(result["custom_domain"], ACHILLIO_TRAVEL_CANONICAL_DOMAIN)
        session.add.assert_called_once()
        added = session.add.call_args[0][0]
        self.assertEqual(added.slug, ACHILLIO_TRAVEL_CANONICAL_SLUG)
        self.assertEqual(added.custom_domain, ACHILLIO_TRAVEL_CANONICAL_DOMAIN)
        self.assertEqual(added.plan, TenantPlan.PROFESSIONAL)

    async def test_binds_domain_on_existing_office_and_clears_poison(self):
        poison = SimpleNamespace(
            id=uuid4(),
            slug="achillio",
            subdomain="achillio",
            custom_domain="www.achilliotravel.com",
            legal_name="PoreiaGo",
            settings_json=None,
        )
        office = SimpleNamespace(
            id=uuid4(),
            slug=ACHILLIO_TRAVEL_CANONICAL_SLUG,
            subdomain=ACHILLIO_TRAVEL_CANONICAL_SLUG,
            custom_domain=None,
            legal_name="Achillio Travel",
            settings_json=None,
            plan=TenantPlan.PROFESSIONAL,
        )
        poison_scan = MagicMock()
        poison_scan.scalars.return_value.all.return_value = [poison, office]
        hit = MagicMock()
        hit.scalar_one_or_none.return_value = office

        session = AsyncMock()
        session.execute = AsyncMock(side_effect=[poison_scan, hit])
        session.commit = AsyncMock()

        with patch(
            "app.services.tenant_modules.apply_known_office_rent_policy",
            return_value=None,
        ), patch("middleware.domain_tenant.clear_host_resolve_cache"):
            result = await ensure_achillio_travel_office(session)

        self.assertFalse(result["created"])
        self.assertTrue(result["domain_set"])
        self.assertEqual(result["poison_cleared"], 1)
        self.assertIsNone(poison.custom_domain)
        self.assertEqual(office.custom_domain, ACHILLIO_TRAVEL_CANONICAL_DOMAIN)


if __name__ == "__main__":
    unittest.main()
