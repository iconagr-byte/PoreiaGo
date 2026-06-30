"""Factory for tenant fiscal providers — decrypt config and issue invoices."""

from __future__ import annotations

from typing import Any

from travel_platform.compliance.fiscal_models import BookingFiscalData, FiscalProvider
from travel_platform.compliance.fiscal_strategy_resolver import transmit_booking_fiscal
from travel_platform.compliance.fiscal_tenant_config import (
    TenantFiscalConfig,
    load_tenant_fiscal_config,
)


class FiscalFactory:
    """
    Resolve the tenant's fiscal provider and issue receipts/invoices.

  Credentials in TenantFiscalConfig are already decrypted via load_tenant_fiscal_config.
    """

    def __init__(
        self,
        *,
        tenant_settings_json: str | None,
        native_credentials: dict[str, str] | None = None,
    ) -> None:
        self._tenant_settings_json = tenant_settings_json
        self._config = load_tenant_fiscal_config(tenant_settings_json)
        self._native_credentials = native_credentials or {}

    @classmethod
    def from_tenant_settings(
        cls,
        tenant_settings_json: str | None,
        *,
        native_credentials: dict[str, str] | None = None,
    ) -> FiscalFactory:
        return cls(
            tenant_settings_json=tenant_settings_json,
            native_credentials=native_credentials,
        )

    @property
    def config(self) -> TenantFiscalConfig | None:
        return self._config

    @property
    def provider(self) -> FiscalProvider:
        return self._config.provider if self._config else FiscalProvider.NATIVE_AADE

    async def issue_invoice(self, data: BookingFiscalData) -> dict[str, Any]:
        """Transmit fiscal document for the charged amount and return unified provider result."""
        return await transmit_booking_fiscal(
            data,
            tenant_settings_json=self._tenant_settings_json,
            native_credentials=self._native_credentials,
        )
