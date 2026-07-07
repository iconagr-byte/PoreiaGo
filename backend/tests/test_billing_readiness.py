"""Billing readiness and local trial tests."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.subscription import SubscriptionStatus
from app.models.tenant import Tenant, TenantPlan
from app.services.billing_service import BillingService, stripe_readiness


class StripeReadinessTests(unittest.TestCase):
    def test_missing_stripe_key(self):
        with patch("app.services.billing_service.get_settings") as gs:
            settings = MagicMock()
            settings.stripe_secret_key = ""
            settings.stripe_price_starter = ""
            settings.stripe_price_professional = ""
            settings.stripe_price_starter_yearly = ""
            settings.stripe_price_professional_yearly = ""
            settings.stripe_price_enterprise = ""
            gs.return_value = settings
            data = stripe_readiness()
        self.assertFalse(data["checkout_ready"])
        self.assertIn("STRIPE_SECRET_KEY", data["missing_env"])


class LocalTrialTests(unittest.IsolatedAsyncioTestCase):
    async def test_start_local_trial_when_stripe_not_ready(self):
        tenant = Tenant(
            id=uuid4(),
            slug="demo",
            legal_name="Demo",
            subdomain="demo",
            plan=TenantPlan.STARTER,
            is_active=True,
        )
        session = AsyncMock()
        billing = BillingService(session)
        billing.get_or_create_subscription = AsyncMock(
            return_value=MagicMock(
                stripe_subscription_id=None,
                status=SubscriptionStatus.TRIALING,
            ),
        )

        with patch("app.services.billing_service.stripe_readiness", return_value={"checkout_ready": False}), patch(
            "app.services.billing_service._plan_base_cents",
            return_value=29900,
        ):
            sub = await billing.start_local_trial(
                tenant,
                plan=TenantPlan.PROFESSIONAL,
                billing_interval="month",
            )

        self.assertEqual(sub.plan, TenantPlan.PROFESSIONAL)
        self.assertEqual(sub.status, SubscriptionStatus.TRIALING)
        self.assertIsNotNone(sub.trial_ends_at)
        self.assertGreater(sub.trial_ends_at, datetime.now(timezone.utc))


if __name__ == "__main__":
    unittest.main()
