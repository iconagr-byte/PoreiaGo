"""Resolve tenant fiscal provider and dispatch transmission."""

from __future__ import annotations

from typing import Any

from core.exceptions import FiscalAPIError
from travel_platform.compliance.epsilon_strategy import EpsilonStrategy
from travel_platform.compliance.fiscal_common import FiscalProviderResult
from travel_platform.compliance.fiscal_models import BookingFiscalData, FiscalProvider
from travel_platform.compliance.fiscal_tenant_config import (
    TenantFiscalConfig,
    load_tenant_fiscal_config,
)
from travel_platform.compliance.native_aade_strategy import NativeAADEStrategy
from travel_platform.compliance.prosvasis_strategy import ProsvasisStrategy


async def transmit_booking_fiscal(
    data: BookingFiscalData,
    *,
    tenant_settings_json: str | None,
    native_credentials: dict[str, str] | None = None,
) -> dict[str, Any]:
    """
    Dispatch fiscal transmission to the tenant's configured provider.

    Returns unified dict: {"success": True, "mark": "...", "uid": "...", "provider": "..."}
    """
    config = load_tenant_fiscal_config(tenant_settings_json)
    provider = config.provider if config else FiscalProvider.NATIVE_AADE

    if provider == FiscalProvider.PROSVASIS:
        if not config or not config.prosvasis:
            raise FiscalAPIError("Tenant fiscal provider is Prosvasis but config is missing")
        result: FiscalProviderResult = await ProsvasisStrategy().transmit(data, config.prosvasis)
    elif provider == FiscalProvider.EPSILON:
        if not config or not config.epsilon:
            raise FiscalAPIError("Tenant fiscal provider is Epsilon but config is missing")
        result = await EpsilonStrategy().transmit(data, config.epsilon)
    else:
        creds = native_credentials or {}
        result = await NativeAADEStrategy().transmit_unified(data, creds)

    return dict(result)
