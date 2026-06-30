"""
Tax Gateway — tenant-aware AADE myDATA integration pattern.

Booking API publishes events; this module (or a separate worker container) consumes them.
Each agency signs with their own credentials stored in Vault/KMS.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class InvoiceEventType(str, Enum):
    BOOKING_PAID = "booking.paid"
    BOOKING_REFUNDED = "booking.refunded"


@dataclass(frozen=True)
class TenantTaxProfile:
    tenant_id: str
    vat_number: str  # ΑΦΜ
    aade_user_id: str
    aade_subscription_key: str
    certificate_ref: str  # path in Vault, not raw cert in code


@dataclass(frozen=True)
class InvoiceRequest:
    tenant_id: str
    booking_id: str
    amount_eur: float
    customer_country: str
    line_items: list[dict[str, Any]]
    idempotency_key: str


async def load_tenant_tax_profile(tenant_id: str) -> TenantTaxProfile:
    """Load from secrets manager — never from QR or public API."""
    # TODO: vault.read(f"tenants/{tenant_id}/aade")
    raise NotImplementedError("Wire to HashiCorp Vault / AWS Secrets Manager")


async def submit_invoice_to_aade(req: InvoiceRequest) -> str:
    """
    1. Load tenant credentials
    2. Build myDATA XML (per AADE spec)
    3. POST with mTLS if required
    4. Return MARK on success
    """
    profile = await load_tenant_tax_profile(req.tenant_id)
    logger.info(
        "AADE transmit tenant=%s booking=%s amount=%.2f vat=%s",
        req.tenant_id,
        req.booking_id,
        req.amount_eur,
        profile.vat_number,
    )
    # Idempotent: same idempotency_key → return cached MARK
    # On 5xx: raise for Celery retry with exponential backoff
    return f"MARK-PENDING-{req.idempotency_key[:12]}"


async def handle_booking_paid_event(event: dict[str, Any]) -> str:
    req = InvoiceRequest(
        tenant_id=event["tenant_id"],
        booking_id=event["booking_id"],
        amount_eur=event["amount"],
        customer_country=event.get("country", "GR"),
        line_items=event.get("line_items", []),
        idempotency_key=f"{event['tenant_id']}:{event['booking_id']}:paid",
    )
    mark = await submit_invoice_to_aade(req)
    return mark
