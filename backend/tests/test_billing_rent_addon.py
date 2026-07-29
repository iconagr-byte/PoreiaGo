"""Existing-office rent add-on enablement via local trial / settings sync."""

from __future__ import annotations

import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.subscription import SubscriptionStatus
from app.models.tenant import Tenant, TenantPlan
from app.services.billing_service import BillingService
from app.services.tenant_modules import modules_for_tenant


class BillingRentAddonTests(unittest.IsolatedAsyncioTestCase):
    async def test_local_trial_enables_rent_addon_on_bus_plan(self):
        tenant = Tenant(
            id=uuid4(),
            slug="demo-office",
            legal_name="Demo Office",
            subdomain="demo-office",
            plan=TenantPlan.STARTER,
            settings_json='{"theme":{"primary":"#111"}}',
            is_active=True,
        )
        sub = SimpleNamespace(
            stripe_subscription_id=None,
            status=SubscriptionStatus.TRIALING,
            plan=TenantPlan.STARTER,
            trial_ends_at=None,
            base_amount_cents=0,
        )

        session = AsyncMock()
        billing = BillingService(session)
        billing.get_or_create_subscription = AsyncMock(return_value=sub)

        with patch("app.services.billing_service.stripe_readiness", return_value={"checkout_ready": False, "demo_mode": True}):
            await billing.start_local_trial(
                tenant,
                plan=TenantPlan.PROFESSIONAL,
                billing_interval="month",
                rent_addon=True,
            )

        self.assertEqual(tenant.plan, TenantPlan.PROFESSIONAL)
        bag = json.loads(tenant.settings_json)
        self.assertTrue(bag["addons"]["rent"])
        self.assertTrue(bag["modules"]["rent_enabled"])
        mods = modules_for_tenant(tenant)
        self.assertEqual(mods["mode"], "both")
        session.flush.assert_awaited()

    async def test_local_trial_rent_only_seeds_modules(self):
        tenant = Tenant(
            id=uuid4(),
            slug="rent-office",
            legal_name="Rent Only SA",
            subdomain="rent-office",
            plan=TenantPlan.STARTER,
            settings_json=None,
            is_active=True,
        )
        sub = SimpleNamespace(
            stripe_subscription_id=None,
            status=SubscriptionStatus.TRIALING,
            plan=TenantPlan.STARTER,
            trial_ends_at=None,
            base_amount_cents=0,
        )
        session = AsyncMock()
        billing = BillingService(session)
        billing.get_or_create_subscription = AsyncMock(return_value=sub)

        with patch("app.services.billing_service.stripe_readiness", return_value={"checkout_ready": False, "demo_mode": True}):
            await billing.start_local_trial(
                tenant,
                plan=TenantPlan.RENT,
                billing_interval="month",
            )

        mods = modules_for_tenant(tenant)
        self.assertEqual(mods["mode"], "rent_only")
        self.assertTrue(mods["rent_enabled"])
        self.assertFalse(mods["trips_enabled"])


if __name__ == "__main__":
    unittest.main()
