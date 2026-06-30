"""Stripe signup webhook → TenantProvisioningService integration tests."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.provisioning import ProvisioningJobStatus, TenantProvisioningJob
from app.models.tenant import Tenant, TenantPlan
from app.services.billing_service import BillingService


class SignupCheckoutWebhookTests(unittest.IsolatedAsyncioTestCase):
    async def test_signup_checkout_provisions_tenant(self):
        job_id = uuid4()
        tenant_id = uuid4()
        payload = {
            "legal_name": "Acme Travel",
            "admin_email": "admin@acme.test",
            "subdomain": "acme-travel",
            "plan": "starter",
            "admin_password_hash": "pbkdf2_sha256$salt$digest",
        }
        job = TenantProvisioningJob(
            id=job_id,
            status=ProvisioningJobStatus.CHECKOUT_STARTED.value,
            isolation_strategy="shared_rls",
            payload=payload,
            created_at=datetime.now(timezone.utc),
        )

        mock_tenant = Tenant(
            id=tenant_id,
            slug="acme-travel",
            legal_name="Acme Travel",
            subdomain="acme-travel",
            plan=TenantPlan.STARTER,
        )

        session = AsyncMock()
        job_result = MagicMock()
        job_result.scalar_one_or_none.return_value = job
        existing_result = MagicMock()
        existing_result.scalar_one_or_none.return_value = None

        session.execute = AsyncMock(side_effect=[job_result, existing_result])

        billing = BillingService(session)
        billing.sync_subscription_from_stripe = AsyncMock()

        with patch("app.services.billing_service._stripe_client"), patch(
            "app.services.billing_service.stripe.Subscription.retrieve",
            return_value={"id": "sub_123", "status": "active", "items": {"data": []}},
        ), patch(
            "app.services.billing_service.TenantProvisioningServiceFacade"
        ) as facade_cls:
            facade = facade_cls.return_value
            facade.provision_from_stripe_checkout = AsyncMock(return_value=mock_tenant)

            await billing._on_signup_checkout_completed(
                {
                    "id": "cs_test_123",
                    "customer": "cus_test_123",
                    "subscription": "sub_123",
                    "client_reference_id": str(job_id),
                    "metadata": {
                        "signup_flow": "true",
                        "provisioning_job_id": str(job_id),
                        "plan": "starter",
                    },
                }
            )

        facade.provision_from_stripe_checkout.assert_awaited_once()
        self.assertEqual(job.status, ProvisioningJobStatus.COMPLETED.value)
        self.assertEqual(job.tenant_id, tenant_id)
        billing.sync_subscription_from_stripe.assert_awaited_once_with(
            tenant_id,
            {"id": "sub_123", "status": "active", "items": {"data": []}},
            plan_hint="starter",
        )

    async def test_signup_checkout_idempotent_when_job_completed(self):
        job_id = uuid4()
        tenant_id = uuid4()
        job = TenantProvisioningJob(
            id=job_id,
            tenant_id=tenant_id,
            status=ProvisioningJobStatus.COMPLETED.value,
            isolation_strategy="shared_rls",
            payload={},
            created_at=datetime.now(timezone.utc),
        )

        session = AsyncMock()
        job_result = MagicMock()
        job_result.scalar_one_or_none.return_value = job
        session.execute = AsyncMock(return_value=job_result)

        billing = BillingService(session)
        billing.sync_subscription_from_stripe = AsyncMock()

        with patch("app.services.billing_service._stripe_client"), patch(
            "app.services.billing_service.stripe.Subscription.retrieve",
            return_value={"id": "sub_123", "status": "active", "items": {"data": []}},
        ):
            await billing._on_signup_checkout_completed(
                {
                    "id": "cs_test_456",
                    "customer": "cus_test_456",
                    "subscription": "sub_123",
                    "metadata": {
                        "signup_flow": "true",
                        "provisioning_job_id": str(job_id),
                        "plan": "starter",
                    },
                }
            )

        billing.sync_subscription_from_stripe.assert_awaited_once()
        self.assertEqual(job.status, ProvisioningJobStatus.COMPLETED.value)


if __name__ == "__main__":
    unittest.main()
