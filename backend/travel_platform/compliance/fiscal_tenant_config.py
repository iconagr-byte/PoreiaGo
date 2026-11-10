"""Load decrypted fiscal provider credentials from tenant settings_json."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from travel_platform.compliance.fiscal_models import FiscalProvider
from travel_platform.compliance.fiscal_secrets import decrypt_fiscal_secret


@dataclass(frozen=True)
class ProsvasisTenantConfig:
    api_url: str
    app_id: str
    s1code: str
    bearer_token: str
    series_retail: int
    series_invoice: int
    branch: int = 1000
    default_trdr: int = 1
    service_mtrl_code: str | None = None
    payment_codes: dict[str, str] | None = None


@dataclass(frozen=True)
class EpsilonTenantConfig:
    smart_url: str
    bearer_token: str
    subscription_key: str | None = None
    retail_item_code: str | None = None
    wholesale_item_code: str | None = None


@dataclass(frozen=True)
class EinvoicingTenantConfig:
    """SoftOne eINVOICING / Impact EINVOICING shared config."""

    api_url: str
    api_key: str
    issuer_name: str | None = None
    branch_code: int = 0
    item_code: str | None = None


@dataclass(frozen=True)
class TenantFiscalConfig:
    provider: FiscalProvider
    prosvasis: ProsvasisTenantConfig | None = None
    epsilon: EpsilonTenantConfig | None = None
    softone: EinvoicingTenantConfig | None = None
    impact: EinvoicingTenantConfig | None = None


def _parse_settings(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _decrypt_field(blob: str | None) -> str:
    if not blob:
        return ""
    if blob.startswith("enc:"):
        return decrypt_fiscal_secret(blob[4:])
    return blob


def _parse_einvoicing_block(raw: dict[str, Any], *, default_url: str) -> EinvoicingTenantConfig:
    return EinvoicingTenantConfig(
        api_url=str(raw.get("api_url") or default_url).rstrip("/"),
        api_key=_decrypt_field(raw.get("api_key_enc") or raw.get("api_key") or raw.get("key")),
        issuer_name=(str(raw.get("issuer_name") or "").strip() or None),
        branch_code=int(raw.get("branch_code") or 0),
        item_code=(str(raw.get("item_code") or "").strip() or None),
    )


def load_tenant_fiscal_config(settings_json: str | None) -> TenantFiscalConfig | None:
    """
    Read tenants.settings_json.fiscal and decrypt provider secrets.
    """
    settings = _parse_settings(settings_json)
    fiscal = settings.get("fiscal")
    if not isinstance(fiscal, dict):
        return None

    provider_raw = str(fiscal.get("provider") or "").strip().lower()
    if not provider_raw:
        return None

    try:
        provider = FiscalProvider(provider_raw)
    except ValueError:
        return None

    prosvasis_cfg = None
    epsilon_cfg = None
    softone_cfg = None
    impact_cfg = None

    prosvasis_raw = fiscal.get("prosvasis")
    if isinstance(prosvasis_raw, dict):
        prosvasis_cfg = ProsvasisTenantConfig(
            api_url=str(prosvasis_raw.get("api_url") or "https://go.s1cloud.net").rstrip("/"),
            app_id=str(prosvasis_raw.get("app_id") or ""),
            s1code=_decrypt_field(prosvasis_raw.get("s1code_enc") or prosvasis_raw.get("s1code")),
            bearer_token=_decrypt_field(
                prosvasis_raw.get("bearer_token_enc")
                or prosvasis_raw.get("token_enc")
                or prosvasis_raw.get("bearer_token")
                or prosvasis_raw.get("token"),
            ),
            series_retail=int(prosvasis_raw.get("series_retail") or 7001),
            series_invoice=int(prosvasis_raw.get("series_invoice") or 7021),
            branch=int(prosvasis_raw.get("branch") or 1000),
            default_trdr=int(prosvasis_raw.get("default_trdr") or 1),
            service_mtrl_code=prosvasis_raw.get("service_mtrl_code"),
            payment_codes=prosvasis_raw.get("payment_codes"),
        )

    epsilon_raw = fiscal.get("epsilon")
    if isinstance(epsilon_raw, dict):
        epsilon_cfg = EpsilonTenantConfig(
            smart_url=str(epsilon_raw.get("smart_url") or "https://epsilonsmart.epsilonnet.gr/"),
            bearer_token=_decrypt_field(
                epsilon_raw.get("jwt_enc")
                or epsilon_raw.get("bearer_token_enc")
                or epsilon_raw.get("jwt")
                or epsilon_raw.get("bearer_token"),
            ),
            subscription_key=_decrypt_field(
                epsilon_raw.get("subscription_key_enc") or epsilon_raw.get("subscription_key"),
            )
            or None,
            retail_item_code=epsilon_raw.get("retail_item_code"),
            wholesale_item_code=epsilon_raw.get("wholesale_item_code"),
        )

    softone_raw = fiscal.get("softone")
    if isinstance(softone_raw, dict):
        softone_cfg = _parse_einvoicing_block(
            softone_raw,
            default_url="https://einvoice.s1ecos.gr",
        )

    impact_raw = fiscal.get("impact")
    if isinstance(impact_raw, dict):
        impact_cfg = _parse_einvoicing_block(
            impact_raw,
            default_url="https://einvoiceapi.impact.gr",
        )

    return TenantFiscalConfig(
        provider=provider,
        prosvasis=prosvasis_cfg,
        epsilon=epsilon_cfg,
        softone=softone_cfg,
        impact=impact_cfg,
    )
