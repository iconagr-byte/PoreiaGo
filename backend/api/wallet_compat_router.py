"""
Συμβατότητα wallet API με το frontend — χωρίς import από backend/platform ή schemas package.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

router = APIRouter(tags=["wallet-compat"])

_DATA = Path(__file__).resolve().parents[1] / "data"
_BRANDING_FILE = _DATA / "tenant_branding.json"
_SETTINGS_FILE = Path(__file__).resolve().parents[1] / "platform" / "settings" / "platform_settings.json"

_DEFAULT_BRANDING = {
    "slug": "poreiago",
    "display_name": "PoreiaGo",
    "logo_url": "",
    "primary_color": "#0040df",
    "custom_domain": "",
    "css_injection_url": "",
    "css_injection_inline": "",
    "verified_domain": True,
    "checkout_base_url": "http://localhost:5173",
    "updated_at": None,
}

_DEFAULT_SETTINGS = {
    "company_name": "AeroStride Travel",
    "support_email": "support@aerostride.app",
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
    "smtp_from_email": "noreply@aerostride.app",
    "sms_sender_id": "AEROSTRIDE",
    "maintenance_mode": False,
    "checkout_base_url": "http://localhost:5173",
    "checkout_deposit_enabled": True,
    "checkout_deposit_percent": 30,
    "checkout_bank_transfer_enabled": True,
    "checkout_bank_name": "Eurobank",
    "checkout_bank_beneficiary": "AeroStride Travel AE",
    "checkout_bank_iban": "GR1601101250000000012300695",
    "checkout_bank_bic": "ERBKGRAA",
    "checkout_bank_instructions": (
        "Μετά την κατάθεση, στείλτε την απόδειξη στο email υποστήριξης. "
        "Η κράτηση επιβεβαιώνεται εντός 24 ωρών."
    ),
    "checkout_bank_reference_template": "VOY-{pnr}",
}


class BrandingAdminResponse(BaseModel):
    slug: str
    display_name: str
    logo_url: str = ""
    primary_color: str = "#0040df"
    custom_domain: str = ""
    css_injection_url: str = ""
    css_injection_inline: str = ""
    verified_domain: bool = False
    checkout_base_url: str = "http://localhost:5173"
    updated_at: str | None = None


class BrandingAdminUpdate(BaseModel):
    display_name: str | None = None
    slug: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None
    custom_domain: str | None = None
    css_injection_url: str | None = None
    css_injection_inline: str | None = Field(None, max_length=50_000)
    verified_domain: bool | None = None
    checkout_base_url: str | None = None


class PlatformSettingsResponse(BaseModel):
    company_name: str = "AeroStride Travel"
    support_email: str = "support@aerostride.app"
    default_locale: str = "el-GR"
    timezone: str = "Europe/Athens"
    abandoned_pending_minutes: int = 60
    abandoned_recovery_cooldown_hours: int = 24
    pricing_high_occupancy_threshold: float = 0.80
    pricing_high_occupancy_markup_pct: float = 10.0
    pricing_low_occupancy_threshold: float = 0.30
    pricing_low_occupancy_discount_pct: float = 5.0
    master_qr_ttl_hours: int = 24
    webhook_max_retries: int = 5
    smtp_from_email: str = "noreply@aerostride.app"
    sms_sender_id: str = "AEROSTRIDE"
    maintenance_mode: bool = False
    checkout_base_url: str = "http://localhost:5173"
    checkout_deposit_enabled: bool = True
    checkout_deposit_percent: int = 30
    checkout_bank_transfer_enabled: bool = True
    checkout_bank_name: str = "Eurobank"
    checkout_bank_beneficiary: str = "AeroStride Travel AE"
    checkout_bank_iban: str = "GR1601101250000000012300695"
    checkout_bank_bic: str = "ERBKGRAA"
    checkout_bank_instructions: str = (
        "Μετά την κατάθεση, στείλτε την απόδειξη στο email υποστήριξης. "
        "Η κράτηση επιβεβαιώνεται εντός 24 ωρών."
    )
    checkout_bank_reference_template: str = "VOY-{pnr}"


class PlatformSettingsUpdate(BaseModel):
    company_name: str | None = None
    support_email: str | None = None
    default_locale: str | None = None
    timezone: str | None = None
    abandoned_pending_minutes: int | None = None
    abandoned_recovery_cooldown_hours: int | None = None
    pricing_high_occupancy_threshold: float | None = None
    pricing_high_occupancy_markup_pct: float | None = None
    pricing_low_occupancy_threshold: float | None = None
    pricing_low_occupancy_discount_pct: float | None = None
    master_qr_ttl_hours: int | None = None
    webhook_max_retries: int | None = None
    smtp_from_email: str | None = None
    sms_sender_id: str | None = None
    maintenance_mode: bool | None = None
    checkout_base_url: str | None = None
    checkout_deposit_enabled: bool | None = None
    checkout_deposit_percent: int | None = Field(None, ge=5, le=90)
    checkout_bank_transfer_enabled: bool | None = None
    checkout_bank_name: str | None = None
    checkout_bank_beneficiary: str | None = None
    checkout_bank_iban: str | None = None
    checkout_bank_bic: str | None = None
    checkout_bank_instructions: str | None = None
    checkout_bank_reference_template: str | None = None


def _read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, TypeError):
        return {}


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _branding_dict(host: str | None = None) -> dict:
    raw = _read_json(_BRANDING_FILE)
    row = raw.get("default") or _DEFAULT_BRANDING
    merged = {**_DEFAULT_BRANDING, **row}
    if host:
        h = host.lower().removeprefix("www.")
        for entry in raw.values():
            if isinstance(entry, dict) and entry.get("custom_domain", "").lower() == h:
                merged = {**_DEFAULT_BRANDING, **entry}
                break
    return merged


def _settings_dict() -> dict:
    disk = _read_json(_SETTINGS_FILE)
    return {**_DEFAULT_SETTINGS, **disk}


@router.get("/api/branding/current", response_model=BrandingAdminResponse)
async def get_current_branding(host: str | None = Query(default=None)):
    return BrandingAdminResponse(**_branding_dict(host))


@router.get("/api/admin/platform/settings", response_model=PlatformSettingsResponse)
async def get_platform_settings():
    return PlatformSettingsResponse(**_settings_dict())


@router.patch("/api/admin/platform/settings", response_model=PlatformSettingsResponse)
async def patch_platform_settings(body: PlatformSettingsUpdate):
    current = _settings_dict()
    current.update(body.model_dump(exclude_unset=True))
    _write_json(_SETTINGS_FILE, current)
    if body.checkout_base_url:
        branding_raw = _read_json(_BRANDING_FILE)
        if "default" not in branding_raw:
            branding_raw["default"] = {**_DEFAULT_BRANDING}
        branding_raw["default"]["checkout_base_url"] = body.checkout_base_url
        _write_json(_BRANDING_FILE, branding_raw)
    return PlatformSettingsResponse(**current)


@router.get("/api/admin/platform/branding", response_model=BrandingAdminResponse)
async def get_admin_branding():
    return BrandingAdminResponse(**_branding_dict())


@router.put("/api/admin/platform/branding", response_model=BrandingAdminResponse)
async def put_admin_branding(body: BrandingAdminUpdate):
    raw = _read_json(_BRANDING_FILE)
    current = {**_DEFAULT_BRANDING, **raw.get("default", {})}
    current.update(body.model_dump(exclude_unset=True))
    raw["default"] = current
    _write_json(_BRANDING_FILE, raw)
    return BrandingAdminResponse(**current)
