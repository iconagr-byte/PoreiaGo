"""Domain exceptions for platform services."""

from __future__ import annotations


class PlatformError(Exception):
    """Base platform error."""

    code: str = "PLATFORM_ERROR"

    def __init__(self, message: str, *, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class TenantIsolationError(PlatformError):
    code = "TENANT_ISOLATION_VIOLATION"


class PricingError(PlatformError):
    code = "PRICING_ERROR"


class MasterQrError(PlatformError):
    code = "MASTER_QR_ERROR"


class SafetyVerificationError(PlatformError):
    code = "SAFETY_VERIFICATION_ERROR"


class WebhookDeliveryError(PlatformError):
    code = "WEBHOOK_DELIVERY_ERROR"


class AadeTransmissionError(PlatformError):
    code = "AADE_TRANSMISSION_ERROR"


class FiscalAPIError(PlatformError):
    code = "FISCAL_API_ERROR"


class AuditImmutableError(PlatformError):
    code = "AUDIT_IMMUTABLE_VIOLATION"
