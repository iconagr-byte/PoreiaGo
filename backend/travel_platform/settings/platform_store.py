"""Runtime platform settings (tenant SaaS config) — in-memory + JSON file."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from core.config import get_platform_settings

_SETTINGS_FILE = Path(__file__).resolve().parent / "platform_settings.json"


@dataclass
class PlatformRuntimeSettings:
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


_store: PlatformRuntimeSettings | None = None


def _defaults() -> PlatformRuntimeSettings:
    s = get_platform_settings()
    return PlatformRuntimeSettings(
        abandoned_pending_minutes=s.abandoned_pending_minutes,
        abandoned_recovery_cooldown_hours=s.abandoned_recovery_cooldown_hours,
        pricing_high_occupancy_threshold=s.pricing_high_occupancy_threshold,
        pricing_high_occupancy_markup_pct=s.pricing_high_occupancy_markup_pct,
        pricing_low_occupancy_threshold=s.pricing_low_occupancy_threshold,
        pricing_low_occupancy_discount_pct=s.pricing_low_occupancy_discount_pct,
        master_qr_ttl_hours=s.master_qr_ttl_hours,
        webhook_max_retries=s.webhook_max_retries,
        smtp_from_email=s.smtp_from_email,
        sms_sender_id=s.sms_sender_id,
    )


def _load_from_disk() -> PlatformRuntimeSettings | None:
    if not _SETTINGS_FILE.exists():
        return None
    try:
        raw = json.loads(_SETTINGS_FILE.read_text(encoding="utf-8"))
        allowed = PlatformRuntimeSettings.__dataclass_fields__
        filtered = {k: v for k, v in raw.items() if k in allowed}
        return PlatformRuntimeSettings(**filtered)
    except (json.JSONDecodeError, TypeError, ValueError):
        return None


def _persist(store: PlatformRuntimeSettings) -> None:
    _SETTINGS_FILE.write_text(
        json.dumps(asdict(store), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def get_platform_config() -> PlatformRuntimeSettings:
    global _store
    if _store is None:
        _store = _load_from_disk() or _defaults()
    return _store


def update_platform_config(patch: dict[str, Any]) -> PlatformRuntimeSettings:
    global _store
    if _store is None:
        _store = _load_from_disk() or _defaults()
    allowed = set(PlatformRuntimeSettings.__dataclass_fields__.keys())
    for k, v in patch.items():
        if k in allowed and v is not None:
            setattr(_store, k, v)
    _persist(_store)
    return _store
