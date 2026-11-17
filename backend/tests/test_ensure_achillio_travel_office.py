"""ensure_achillio_travel_office creates/binds the real Achillio Travel office."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.tenant import TenantPlan
from app.services.tenant_modules import (
    ACHILLIO_TRAVEL_BUS_HERO,
    ACHILLIO_TRAVEL_CANONICAL_DOMAIN,
    ACHILLIO_TRAVEL_CANONICAL_SLUG,
    ensure_achillio_travel_office,
    restore_achillio_travel_bus_hero,
)


class EnsureAchillioTravelOfficeTests(unittest.IsolatedAsyncioTestCase):
    async def test_creates_office_when_missing(self):
        session = AsyncMock()
        # 1) schema heal plan, 2) schema heal name, 3) poison scan (empty),
        # 4) slug lookup miss, 5) classifier scan empty, 6) optional name UPDATE
        empty = MagicMock()
        empty.scalars.return_value.all.return_value = []
        miss = MagicMock()
        miss.scalar_one_or_none.return_value = None
        session.execute = AsyncMock(side_effect=[None, None, empty, miss, empty, None])
        session.add = MagicMock()
        session.flush = AsyncMock()
        session.commit = AsyncMock()
        session.rollback = AsyncMock()

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
        # 1) schema heal plan, 2) schema heal name, 3) poison scan, 4) slug hit
        session.execute = AsyncMock(side_effect=[None, None, poison_scan, hit])
        session.commit = AsyncMock()
        session.rollback = AsyncMock()

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

    async def test_restores_bus_hero_when_mistaken_upload(self):
        import json

        office = SimpleNamespace(
            id=uuid4(),
            slug=ACHILLIO_TRAVEL_CANONICAL_SLUG,
            subdomain=ACHILLIO_TRAVEL_CANONICAL_SLUG,
            custom_domain=ACHILLIO_TRAVEL_CANONICAL_DOMAIN,
            legal_name="Achillio Travel",
            settings_json=json.dumps(
                {
                    "site_appearance": {
                        "hero_image_url": (
                            "/api/site/office-assets/97798681/hero/hero.jpg"
                        ),
                        "footer_brand_name": "Achillio Travel",
                    }
                }
            ),
            plan=TenantPlan.PROFESSIONAL,
        )
        poison_scan = MagicMock()
        poison_scan.scalars.return_value.all.return_value = [office]
        hit = MagicMock()
        hit.scalar_one_or_none.return_value = office

        session = AsyncMock()
        session.execute = AsyncMock(side_effect=[None, None, poison_scan, hit])
        session.commit = AsyncMock()
        session.rollback = AsyncMock()

        with patch(
            "app.services.tenant_modules.apply_known_office_rent_policy",
            return_value=None,
        ), patch("middleware.domain_tenant.clear_host_resolve_cache"):
            result = await ensure_achillio_travel_office(session)

        self.assertTrue(result["hero_restored"])
        saved = json.loads(office.settings_json)
        self.assertEqual(
            saved["site_appearance"]["hero_image_url"],
            ACHILLIO_TRAVEL_BUS_HERO,
        )

    def test_restore_helper_is_idempotent(self):
        already = {
            "site_appearance": {"hero_image_url": ACHILLIO_TRAVEL_BUS_HERO}
        }
        self.assertIsNone(restore_achillio_travel_bus_hero(already))
        swapped = restore_achillio_travel_bus_hero(
            {"site_appearance": {"hero_image_url": "/api/site/office-assets/x/hero.jpg"}}
        )
        self.assertEqual(
            swapped["site_appearance"]["hero_image_url"],
            ACHILLIO_TRAVEL_BUS_HERO,
        )


if __name__ == "__main__":
    unittest.main()
