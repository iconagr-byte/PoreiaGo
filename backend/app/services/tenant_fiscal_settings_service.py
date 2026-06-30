"""Tenant fiscal provider settings — stored in tenants.settings_json.fiscal."""

from __future__ import annotations

import json
from copy import deepcopy
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditAction
from app.models.tenant import Tenant
from app.services.audit_service import AuditService
from travel_platform.compliance.fiscal_secrets import encrypt_fiscal_secret

DEFAULT_FISCAL_SETTINGS: dict[str, Any] = {
    "provider": "native_aade",
    "issuer_vat": "",
    "series_retail": "ΑΠΥ",
    "series_invoice": "ΤΠΥ",
    "series_credit_retail": "ΠΛΣ",
    "series_credit_invoice": "ΠΛΤ",
    "prosvasis": {
        "api_url": "https://go.s1cloud.net",
        "app_id": "",
        "series_retail": 7001,
        "series_invoice": 7021,
        "branch": 1000,
        "default_trdr": 1,
        "service_mtrl_code": "",
        "payment_codes": {
            "cash": "1001",
            "credit_card": "1003",
            "bank_transfer": "1005",
        },
    },
    "epsilon": {
        "smart_url": "https://epsilonsmart.epsilonnet.gr/",
        "retail_item_code": "",
        "wholesale_item_code": "",
    },
}

def _parse_settings(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _deep_merge(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _is_secret_configured(blob: str | None) -> bool:
    return bool(blob and str(blob).strip())


def _mask_provider_block(block: dict[str, Any] | None, *, secret_keys: tuple[str, ...]) -> dict[str, Any]:
    data = dict(block or {})
    public = {k: v for k, v in data.items() if not k.endswith("_enc")}
    for secret_key in secret_keys:
        enc_key = f"{secret_key}_enc" if not secret_key.endswith("_enc") else secret_key
        public[f"{secret_key}_configured"] = _is_secret_configured(data.get(enc_key) or data.get(secret_key))
    return public


def fiscal_settings_public_view(fiscal: dict[str, Any]) -> dict[str, Any]:
    merged = _deep_merge(DEFAULT_FISCAL_SETTINGS, fiscal)
    return {
        "provider": merged.get("provider", "native_aade"),
        "issuer_vat": merged.get("issuer_vat", ""),
        "series_retail": merged.get("series_retail", "ΑΠΥ"),
        "series_invoice": merged.get("series_invoice", "ΤΠΥ"),
        "series_credit_retail": merged.get("series_credit_retail", "ΠΛΣ"),
        "series_credit_invoice": merged.get("series_credit_invoice", "ΠΛΤ"),
        "prosvasis": _mask_provider_block(
            merged.get("prosvasis"),
            secret_keys=("s1code", "bearer_token"),
        ),
        "epsilon": _mask_provider_block(
            merged.get("epsilon"),
            secret_keys=("jwt", "subscription_key"),
        ),
    }


def _encrypt_secret_fields(provider_block: dict[str, Any], mapping: dict[str, str]) -> dict[str, Any]:
    out = dict(provider_block)
    for plain_key, enc_key in mapping.items():
        value = out.pop(plain_key, None)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            out[enc_key] = encrypt_fiscal_secret(text)
            out.pop(enc_key.replace("_enc", ""), None)
    return out


class TenantFiscalSettingsService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._audit = AuditService(session)

    async def get_settings(self, tenant_id: UUID) -> dict[str, Any]:
        tenant = await self._get_tenant(tenant_id)
        settings = _parse_settings(tenant.settings_json)
        fiscal = settings.get("fiscal") if isinstance(settings.get("fiscal"), dict) else {}
        view = fiscal_settings_public_view(fiscal)
        view["storage_source"] = "postgres"
        view["tenant_slug"] = tenant.slug
        return view

    async def update_settings(
        self,
        tenant_id: UUID,
        patch: dict[str, Any],
        *,
        actor_email: str | None = None,
    ) -> dict[str, Any]:
        tenant = await self._get_tenant(tenant_id)
        settings = _parse_settings(tenant.settings_json)
        current = settings.get("fiscal") if isinstance(settings.get("fiscal"), dict) else {}
        merged = _deep_merge(DEFAULT_FISCAL_SETTINGS, current)

        if patch.get("provider") is not None:
            merged["provider"] = str(patch["provider"])
        for key in ("issuer_vat", "series_retail", "series_invoice"):
            if patch.get(key) is not None:
                merged[key] = patch[key]

        prosvasis_patch = patch.get("prosvasis")
        if isinstance(prosvasis_patch, dict):
            block = dict(merged.get("prosvasis") or {})
            block.update({k: v for k, v in prosvasis_patch.items() if k not in ("s1code", "bearer_token")})
            block = _encrypt_secret_fields(
                {**block, **{k: prosvasis_patch[k] for k in ("s1code", "bearer_token") if k in prosvasis_patch}},
                {"s1code": "s1code_enc", "bearer_token": "bearer_token_enc"},
            )
            merged["prosvasis"] = block

        epsilon_patch = patch.get("epsilon")
        if isinstance(epsilon_patch, dict):
            block = dict(merged.get("epsilon") or {})
            block.update({k: v for k, v in epsilon_patch.items() if k not in ("jwt", "subscription_key")})
            block = _encrypt_secret_fields(
                {**block, **{k: epsilon_patch[k] for k in ("jwt", "subscription_key") if k in epsilon_patch}},
                {"jwt": "jwt_enc", "subscription_key": "subscription_key_enc"},
            )
            merged["epsilon"] = block

        settings["fiscal"] = merged
        tenant.settings_json = json.dumps(settings, ensure_ascii=False)
        await self._session.flush()
        await self._audit.record(
            tenant_id=tenant_id,
            actor_id=None,
            actor_email=actor_email or "tenant_admin",
            action=AuditAction.UPDATE,
            resource_type="fiscal_settings",
            resource_id=str(tenant_id),
            detail="Updated tenant fiscal provider settings",
        )
        return await self.get_settings(tenant_id)

    async def _get_tenant(self, tenant_id: UUID) -> Tenant:
        result = await self._session.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise ValueError("Tenant not found")
        return tenant
