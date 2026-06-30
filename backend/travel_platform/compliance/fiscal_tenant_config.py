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
class TenantFiscalConfig:
    provider: FiscalProvider
    prosvasis: ProsvasisTenantConfig | None = None
    epsilon: EpsilonTenantConfig | None = None


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


def load_tenant_fiscal_config(settings_json: str | None) -> TenantFiscalConfig | None:
    """
    Read tenants.settings_json.fiscal and decrypt provider secrets.

    Example shape:
    {
      "provider": "prosvasis",
      "prosvasis": {
        "api_url": "https://go.s1cloud.net",
        "app_id": "703",
        "s1code_enc": "enc:...",
        "bearer_token_enc": "enc:...",
        "series_retail": 7001,
        "series_invoice": 7021
      }
    }
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

    return TenantFiscalConfig(provider=provider, prosvasis=prosvasis_cfg, epsilon=epsilon_cfg)
