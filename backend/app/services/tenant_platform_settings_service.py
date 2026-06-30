"""Tenant-scoped platform/checkout settings — stored in tenants.settings_json.platform."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditAction
from app.models.tenant import Tenant
from app.services.audit_service import AuditService

DEFAULT_PLATFORM_SETTINGS: dict[str, Any] = {
    "company_name": "PoreiaGo Travel",
    "support_email": "support@poreiago.app",
    "default_locale": "el-GR",
    "timezone": "Europe/Athens",
    "abandoned_pending_minutes": 60,
    "abandoned_recovery_cooldown_hours": 24,
    "pricing_high_occupancy_threshold": 0.80,
    "pricing_high_occupancy_markup_pct": 10.0,
    "pricing_low_occupancy_threshold": 0.30,
    "pricing_low_occupancy_discount_pct": 5.0,
    "master_qr_ttl_hours": 24,
    "webhook_max_retries": 5,
    "smtp_from_email": "noreply@poreiago.app",
    "sms_sender_id": "AEROSTRIDE",
    "maintenance_mode": False,
    "checkout_base_url": "http://localhost:5173",
    "checkout_deposit_enabled": True,
    "checkout_deposit_percent": 30,
    "checkout_bank_transfer_enabled": True,
    "checkout_bank_name": "Eurobank",
    "checkout_bank_beneficiary": "PoreiaGo Travel AE",
    "checkout_bank_iban": "GR1601101250000000012300695",
    "checkout_bank_bic": "ERBKGRAA",
    "checkout_bank_instructions": (
        "Μετά την κατάθεση, στείλτε την απόδειξη στο email υποστήριξης. "
        "Η κράτηση επιβεβαιώνεται εντός 24 ωρών."
    ),
    "checkout_bank_reference_template": "VOY-{pnr}",
}


def _parse_settings(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


class TenantPlatformSettingsService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._audit = AuditService(session)

    async def get_settings(self, tenant_id: UUID) -> dict[str, Any]:
        tenant = await self._get_tenant(tenant_id)
        settings = _parse_settings(tenant.settings_json)
        platform = settings.get("platform")
        merged = {**DEFAULT_PLATFORM_SETTINGS, **(platform if isinstance(platform, dict) else {})}
        merged["storage_source"] = "postgres"
        merged["tenant_slug"] = tenant.slug
        return merged

    async def update_settings(
        self,
        tenant_id: UUID,
        patch: dict[str, Any],
        *,
        actor_email: str | None = None,
    ) -> dict[str, Any]:
        tenant = await self._get_tenant(tenant_id)
        settings = _parse_settings(tenant.settings_json)
        current = settings.get("platform")
        base = current if isinstance(current, dict) else {}
        allowed = set(DEFAULT_PLATFORM_SETTINGS.keys())
        filtered = {k: v for k, v in patch.items() if k in allowed}
        updated = {**DEFAULT_PLATFORM_SETTINGS, **base, **filtered}
        settings["platform"] = updated
        tenant.settings_json = json.dumps(settings, ensure_ascii=False)
        await self._session.flush()
        await self._audit.record(
            tenant_id=tenant_id,
            actor_id=None,
            actor_email=actor_email or "tenant_admin",
            action=AuditAction.UPDATE,
            resource_type="platform_settings",
            resource_id=str(tenant_id),
            detail="Updated tenant platform settings",
        )
        return await self.get_settings(tenant_id)

    async def _get_tenant(self, tenant_id: UUID) -> Tenant:
        result = await self._session.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise ValueError("Tenant not found")
        return tenant
