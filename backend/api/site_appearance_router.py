"""Public + admin site appearance (homepage logo, hero, footer) — lightweight JSON store."""

from __future__ import annotations

import json
import logging
import mimetypes
import os
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.core.data_paths import migrate_file_once, poreiago_data_dir

router = APIRouter(tags=["site-appearance"])
logger = logging.getLogger(__name__)

_LEGACY_DATA = Path(__file__).resolve().parents[1] / "data"
_ALLOWED_KINDS = frozenset({"logo", "hero"})
_MAX_UPLOAD_BYTES = 4 * 1024 * 1024
# Only legacy PoreiaGo/AeroStride brand marks — not /api/site/assets/logo
# (that path is the real uploaded office logo from the upload API).
_PLATFORM_LOGO_RE = re.compile(r"poreiago|aerostride", re.I)
_PLATFORM_HOST_RE = re.compile(
    r"^(www\.)?(poreiago\.com|localhost|127\.0\.0\.1)$",
    re.I,
)


def _data_root() -> Path:
    return poreiago_data_dir()


def _appearance_file() -> Path:
    return migrate_file_once(
        _data_root() / "site_appearance.json",
        _LEGACY_DATA / "site_appearance.json",
    )


def _upload_dir() -> Path:
    d = _data_root() / "uploads" / "site"
    legacy = _LEGACY_DATA / "uploads" / "site"
    if not d.exists() and legacy.is_dir():
        try:
            d.mkdir(parents=True, exist_ok=True)
            for item in legacy.iterdir():
                dest = d / item.name
                if not dest.exists():
                    dest.write_bytes(item.read_bytes()) if item.is_file() else None
        except OSError:
            return legacy
    return d


def _platform_settings_file() -> Path:
    return migrate_file_once(
        _data_root() / "platform_settings.json",
        Path(__file__).resolve().parents[1] / "platform" / "settings" / "platform_settings.json",
    )


def _purge_achillion_marker() -> Path:
    return _data_root() / ".purged_achillion_platform_logo_v1"


def _is_platform_placeholder_logo(url: str | None) -> bool:
    value = str(url or "").strip()
    if not value:
        return True
    if value.startswith("data:image/") or value.startswith("/api/site/assets/"):
        return False
    return bool(_PLATFORM_LOGO_RE.search(value))

DEFAULT_SITE_APPEARANCE = {
    "logo_url": "",
    "logo_height_px": 40,
    "logo_max_width_px": 180,
    "logo_show_name": True,
    "hero_image_url": "",
    "hero_image_focal": "center",
    "hero_badge": "Premium Ταξιδιωτική Εμπειρία",
    "hero_title": "Η Ελλάδα, όπως δεν την έχεις ξαναδεί:",
    "hero_title_accent": "Άνεση, ασφάλεια & θέση εξασφαλισμένη.",
    "hero_subtitle": (
        "Διάλεξτε από τις προγραμματισμένες εκδρομές μας — χωρίς αναζήτηση προορισμού, "
        "μόνο ταξίδια που οργανώνουμε εμείς."
    ),
    "hero_search_label": "Πρόγραμμα εκδρομών",
    "footer_brand_name": "",
    "footer_copyright": "",
    "footer_privacy_label": "Πολιτική Απορρήτου",
    "footer_privacy_url": "#",
    "footer_terms_label": "Όροι Χρήσης",
    "footer_terms_url": "#",
    "footer_contact_email": "",
    "footer_contact_phone": "",
    "footer_address": "",
    "rent_office_name": "",
    "rent_hero_title": "Το όχημά σας, σε λίγα βήματα",
    "rent_hero_copy": "Κράτηση, ημερολόγιο και χάρτης παραλαβής — όλα σε μία σελίδα.",
    "rent_guest_hero_title": "Δες τον στόλο πριν κλείσεις",
    "rent_guest_hero_copy": "",
    "rent_cta_label": "Βρες όχημα",
    # Extra pickup/dropoff points for /rent search (office address is always included).
    "rent_pickup_locations": [],
    "rent_coverage_options": [],
    "rent_included_defaults": [],
    "rent_upsell_coverage_id": "",
    "trip_extra_options": [],
    "rent_notify_email_enabled": True,
    "rent_notify_sms_enabled": True,
    "rent_notify_email_label": "Θέλω προσφορές στο email",
    "rent_notify_sms_label": "Θέλω ενημερώσεις SMS για την κράτηση",
    "rent_notify_email_default": False,
    "rent_notify_sms_default": False,
    "rent_notify_sms_template_confirmed": (
        "Κράτηση {ref} επιβεβαιώθηκε. Παραλαβή: {pickup} · {start}. {office}"
    ),
    "rent_notify_sms_template_status": "Κράτηση {ref}: νέα κατάσταση {status}. {office}",
    "rent_notify_email_subject": "Κράτηση {ref} — επιβεβαίωση",
    "rent_notify_email_body": (
        "Γεια σου {name},<br/><br/>Η κράτησή σου <strong>{ref}</strong> επιβεβαιώθηκε."
        "<br/>Παραλαβή: {pickup}<br/>Έναρξη: {start}<br/><br/>Ευχαριστούμε,<br/>{office}"
    ),
    "home_slider_enabled": False,
    "home_slider_autoplay": True,
    "home_slider_interval_sec": 5,
    "home_slider_options": {},
    "home_slider_slides": [],
    "rent_slider_enabled": False,
    "rent_slider_autoplay": True,
    "rent_slider_interval_sec": 5,
    "rent_slider_options": {},
    "rent_slider_slides": [],
    "homepage_theme_id": "aegean_classic",
    "accent_color": "#0ea5e9",
    "secondary_color": "#1e3a5f",
    "surface_color": "#f8fafc",
    "show_fleet_section": True,
    "show_why_us_section": True,
    "header_template": "glass_dark",
    "hero_template": "fullscreen_overlay",
    "trips_layout_template": "grid_three",
    "trip_card_template": "premium",
    "footer_template": "classic_columns",
    "intl_trips_layout_template": "horizontal_scroll",
    "intl_trip_card_template": "abroad_horizontal",
    "trips_section_eyebrow": "Ανακαλύψτε",
    "trips_section_title": "Εκδρομές στην Ελλάδα",
    "trips_section_subtitle": (
        "Ημερήσιες και πολυήμερες διαδρομές με premium στόλο — κράτηση θέσης online."
    ),
    "intl_section_eyebrow": "Διεθνή δρομολόγια",
    "intl_section_title": "Ταξίδια προς το Εξωτερικό",
    "intl_section_subtitle": (
        "Οριζόντια προβολή διεθνών εκδρομών με λεωφορείο — σύρετε για να δείτε όλες."
    ),
    "updated_at": None,
}


class SiteAppearanceResponse(BaseModel):
    logo_url: str = ""
    logo_height_px: int = 40
    logo_max_width_px: int = 180
    logo_show_name: bool = True
    hero_image_url: str = ""
    hero_image_focal: str = "center"
    hero_badge: str = "Premium Ταξιδιωτική Εμπειρία"
    hero_title: str = "Η Ελλάδα, όπως δεν την έχεις ξαναδεί:"
    hero_title_accent: str = "Άνεση, ασφάλεια & θέση εξασφαλισμένη."
    hero_subtitle: str = (
        "Διάλεξτε από τις προγραμματισμένες εκδρομές μας — χωρίς αναζήτηση προορισμού, "
        "μόνο ταξίδια που οργανώνουμε εμείς."
    )
    hero_search_label: str = "Πρόγραμμα εκδρομών"
    footer_brand_name: str = ""
    footer_copyright: str = ""
    footer_privacy_label: str = "Πολιτική Απορρήτου"
    footer_privacy_url: str = "#"
    footer_terms_label: str = "Όροι Χρήσης"
    footer_terms_url: str = "#"
    footer_contact_email: str = ""
    footer_contact_phone: str = ""
    footer_address: str = ""
    rent_office_name: str = ""
    rent_hero_title: str = "Το όχημά σας, σε λίγα βήματα"
    rent_hero_copy: str = (
        "Κράτηση, ημερολόγιο και χάρτης παραλαβής — όλα σε μία σελίδα."
    )
    rent_guest_hero_title: str = "Δες τον στόλο πριν κλείσεις"
    rent_guest_hero_copy: str = ""
    rent_cta_label: str = "Βρες όχημα"
    rent_pickup_locations: list[str] = []
    rent_coverage_options: list[dict] = []
    rent_included_defaults: list[str] = []
    rent_upsell_coverage_id: str = ""
    trip_extra_options: list[dict] = []
    rent_notify_email_enabled: bool = True
    rent_notify_sms_enabled: bool = True
    rent_notify_email_label: str = "Θέλω προσφορές στο email"
    rent_notify_sms_label: str = "Θέλω ενημερώσεις SMS για την κράτηση"
    rent_notify_email_default: bool = False
    rent_notify_sms_default: bool = False
    rent_notify_sms_template_confirmed: str = ""
    rent_notify_sms_template_status: str = ""
    rent_notify_email_subject: str = ""
    rent_notify_email_body: str = ""
    home_slider_enabled: bool = False
    home_slider_autoplay: bool = True
    home_slider_interval_sec: int = 5
    home_slider_options: dict = {}
    home_slider_slides: list[dict] = []
    rent_slider_enabled: bool = False
    rent_slider_autoplay: bool = True
    rent_slider_interval_sec: int = 5
    rent_slider_options: dict = {}
    rent_slider_slides: list[dict] = []
    homepage_theme_id: str = "aegean_classic"
    accent_color: str = "#0ea5e9"
    secondary_color: str = "#1e3a5f"
    surface_color: str = "#f8fafc"
    show_fleet_section: bool = True
    show_why_us_section: bool = True
    header_template: str = "glass_dark"
    hero_template: str = "fullscreen_overlay"
    trips_layout_template: str = "grid_three"
    trip_card_template: str = "premium"
    footer_template: str = "classic_columns"
    intl_trips_layout_template: str = "horizontal_scroll"
    intl_trip_card_template: str = "abroad_horizontal"
    trips_section_eyebrow: str = "Ανακαλύψτε"
    trips_section_title: str = "Εκδρομές στην Ελλάδα"
    trips_section_subtitle: str = (
        "Ημερήσιες και πολυήμερες διαδρομές με premium στόλο — κράτηση θέσης online."
    )
    intl_section_eyebrow: str = "Διεθνή δρομολόγια"
    intl_section_title: str = "Ταξίδια προς το Εξωτερικό"
    intl_section_subtitle: str = (
        "Οριζόντια προβολή διεθνών εκδρομών με λεωφορείο — σύρετε για να δείτε όλες."
    )
    updated_at: str | None = None


class CheckoutSettingsResponse(BaseModel):
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


class SiteAppearanceUpdate(BaseModel):
    logo_url: str | None = None
    logo_height_px: int | None = None
    logo_max_width_px: int | None = None
    logo_show_name: bool | None = None
    hero_image_url: str | None = None
    hero_image_focal: str | None = None
    hero_badge: str | None = None
    hero_title: str | None = None
    hero_title_accent: str | None = None
    hero_subtitle: str | None = None
    hero_search_label: str | None = None
    footer_brand_name: str | None = None
    footer_copyright: str | None = None
    footer_privacy_label: str | None = None
    footer_privacy_url: str | None = None
    footer_terms_label: str | None = None
    footer_terms_url: str | None = None
    footer_contact_email: str | None = None
    footer_contact_phone: str | None = None
    footer_address: str | None = None
    rent_office_name: str | None = None
    rent_hero_title: str | None = None
    rent_hero_copy: str | None = None
    rent_guest_hero_title: str | None = None
    rent_guest_hero_copy: str | None = None
    rent_cta_label: str | None = None
    rent_pickup_locations: list[str] | None = None
    rent_coverage_options: list[dict] | None = None
    rent_included_defaults: list[str] | None = None
    rent_upsell_coverage_id: str | None = None
    trip_extra_options: list[dict] | None = None
    rent_notify_email_enabled: bool | None = None
    rent_notify_sms_enabled: bool | None = None
    rent_notify_email_label: str | None = None
    rent_notify_sms_label: str | None = None
    rent_notify_email_default: bool | None = None
    rent_notify_sms_default: bool | None = None
    rent_notify_sms_template_confirmed: str | None = None
    rent_notify_sms_template_status: str | None = None
    rent_notify_email_subject: str | None = None
    rent_notify_email_body: str | None = None
    home_slider_enabled: bool | None = None
    home_slider_autoplay: bool | None = None
    home_slider_interval_sec: int | None = None
    home_slider_options: dict | None = None
    home_slider_slides: list[dict] | None = None
    rent_slider_enabled: bool | None = None
    rent_slider_autoplay: bool | None = None
    rent_slider_interval_sec: int | None = None
    rent_slider_options: dict | None = None
    rent_slider_slides: list[dict] | None = None
    homepage_theme_id: str | None = None
    accent_color: str | None = None
    secondary_color: str | None = None
    surface_color: str | None = None
    show_fleet_section: bool | None = None
    show_why_us_section: bool | None = None
    header_template: str | None = None
    hero_template: str | None = None
    trips_layout_template: str | None = None
    trip_card_template: str | None = None
    footer_template: str | None = None
    intl_trips_layout_template: str | None = None
    intl_trip_card_template: str | None = None
    trips_section_eyebrow: str | None = None
    trips_section_title: str | None = None
    trips_section_subtitle: str | None = None
    intl_section_eyebrow: str | None = None
    intl_section_title: str | None = None
    intl_section_subtitle: str | None = None


def _clamp_logo_fields(data: dict) -> dict:
    out = {**data}
    if "logo_height_px" in out and out["logo_height_px"] is not None:
        try:
            out["logo_height_px"] = max(20, min(96, int(out["logo_height_px"])))
        except (TypeError, ValueError):
            out["logo_height_px"] = 40
    if "logo_max_width_px" in out and out["logo_max_width_px"] is not None:
        try:
            out["logo_max_width_px"] = max(60, min(400, int(out["logo_max_width_px"])))
        except (TypeError, ValueError):
            out["logo_max_width_px"] = 180
    if "logo_show_name" in out and out["logo_show_name"] is not None:
        out["logo_show_name"] = bool(out["logo_show_name"])
    return out


def _read_appearance() -> dict:
    if not _appearance_file().exists():
        return {**DEFAULT_SITE_APPEARANCE}
    try:
        raw = json.loads(_appearance_file().read_text(encoding="utf-8"))
    except (json.JSONDecodeError, TypeError):
        return {**DEFAULT_SITE_APPEARANCE}
    merged = {**DEFAULT_SITE_APPEARANCE, **raw}
    brand = str(merged.get("footer_brand_name") or "").strip()
    if not brand or brand.lower() in {"aerostride", "poreiago"}:
        merged["footer_brand_name"] = ""
    copyright_text = str(merged.get("footer_copyright") or "")
    if not copyright_text or re.search(r"aerostride|poreiago", copyright_text, re.I):
        merged["footer_copyright"] = ""
    return merged


def _write_appearance(data: dict) -> dict:
    _appearance_file().parent.mkdir(parents=True, exist_ok=True)
    merged = {**DEFAULT_SITE_APPEARANCE, **data}
    merged["updated_at"] = datetime.now(timezone.utc).isoformat()
    _appearance_file().write_text(
        json.dumps(merged, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return merged


def _asset_file(kind: str) -> Path | None:
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        path = _upload_dir() / f"{kind}{ext}"
        if path.is_file():
            return path
    return None


def _asset_api_url(kind: str) -> str:
    path = _asset_file(kind)
    if not path:
        return ""
    version = int(path.stat().st_mtime)
    return f"/api/site/assets/{kind}?v={version}"


def _is_platform_host(host: str | None) -> bool:
    value = str(host or "").strip()
    if not value:
        return True
    return bool(_PLATFORM_HOST_RE.match(value))


def _scrub_achillio_from_platform_appearance(data: dict) -> dict:
    """Never serve Achillio Travel identity from the shared PoreiaGo file store."""
    out = dict(data or {})
    ach_re = re.compile(r"achillio|achillion", re.I)
    brand_poisoned = False
    for key in ("footer_brand_name", "rent_office_name", "display_name", "footer_copyright"):
        if ach_re.search(str(out.get(key) or "")):
            brand_poisoned = True
            out[key] = "PoreiaGo" if key != "footer_copyright" else ""
    logo = str(out.get("logo_url") or "")
    if ach_re.search(logo) or brand_poisoned:
        out["logo_url"] = ""
    if ach_re.search(str(out.get("hero_image_url") or "")):
        out["hero_image_url"] = ""
    return out


def purge_mistaken_platform_logo(*, force: bool = False) -> bool:
    """Remove Achillion Travel logo from the PoreiaGo platform appearance store.

    The shared uploads/site/logo.* file was used as the marketing-site logo on
    poreiago.com. Tenant offices keep their own branding in Postgres.
    """
    if not force and _purge_achillion_marker().exists():
        return False
    removed_files = 0
    try:
        _upload_dir().mkdir(parents=True, exist_ok=True)
        for path in list(_upload_dir().glob("logo.*")):
            path.unlink(missing_ok=True)
            removed_files += 1
        current = _read_appearance()
        logo = str(current.get("logo_url") or "").strip()
        if logo:
            current["logo_url"] = ""
            _write_appearance(current)
        _data_root().mkdir(parents=True, exist_ok=True)
        _purge_achillion_marker().write_text(
            "Cleared platform site logo — Achillion Travel mark was incorrectly "
            "used on PoreiaGo marketing hosts.\n",
            encoding="utf-8",
        )
        logger.info(
            "Purged mistaken platform logo (removed_files=%s, cleared_logo_url=%s)",
            removed_files,
            bool(logo),
        )
        return True
    except OSError as exc:
        logger.warning("Failed to purge mistaken platform logo: %s", exc)
        return False


def _read_checkout_settings(tenant_id: str | None = None) -> dict:
    try:
        from travel_platform.settings.payment_settings_store import get_public_payment_settings

        pub = get_public_payment_settings(tenant_id)
        default_account = next((a for a in pub["bank_accounts"] if a.get("is_default")), None)
        if not default_account and pub["bank_accounts"]:
            default_account = pub["bank_accounts"][0]
        default_account = default_account or {}
        return {
            "checkout_deposit_enabled": bool(pub["deposit"].get("enabled", True)),
            "checkout_deposit_percent": int(pub["deposit"].get("percent") or 30),
            "checkout_bank_transfer_enabled": bool(
                pub["methods"].get("bank_transfer", {}).get("enabled", True)
            ),
            "checkout_bank_name": default_account.get("bank_name") or "",
            "checkout_bank_beneficiary": default_account.get("beneficiary") or "",
            "checkout_bank_iban": default_account.get("iban") or "",
            "checkout_bank_bic": default_account.get("bic") or "",
            "checkout_bank_instructions": (
                default_account.get("instructions") or pub.get("global_bank_instructions") or ""
            ),
            "checkout_bank_reference_template": default_account.get("reference_template") or "VOY-{pnr}",
        }
    except Exception:
        pass
    defaults = {
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
    if not _platform_settings_file().exists():
        return defaults
    try:
        raw = json.loads(_platform_settings_file().read_text(encoding="utf-8"))
    except (json.JSONDecodeError, TypeError, OSError):
        return defaults
    try:
        pct = int(raw.get("checkout_deposit_percent") or 30)
    except (TypeError, ValueError):
        pct = 30
    pct = max(5, min(90, pct))
    iban = str(raw.get("checkout_bank_iban") or defaults["checkout_bank_iban"]).replace(" ", "").strip()
    return {
        "checkout_deposit_enabled": bool(raw.get("checkout_deposit_enabled", True)),
        "checkout_deposit_percent": pct,
        "checkout_bank_transfer_enabled": bool(raw.get("checkout_bank_transfer_enabled", True)),
        "checkout_bank_name": str(raw.get("checkout_bank_name") or defaults["checkout_bank_name"]).strip(),
        "checkout_bank_beneficiary": str(
            raw.get("checkout_bank_beneficiary") or defaults["checkout_bank_beneficiary"]
        ).strip(),
        "checkout_bank_iban": iban,
        "checkout_bank_bic": str(raw.get("checkout_bank_bic") or defaults["checkout_bank_bic"]).strip(),
        "checkout_bank_instructions": str(
            raw.get("checkout_bank_instructions") or defaults["checkout_bank_instructions"]
        ).strip(),
        "checkout_bank_reference_template": str(
            raw.get("checkout_bank_reference_template") or defaults["checkout_bank_reference_template"]
        ).strip(),
    }


@router.get("/api/site/checkout-settings", response_model=CheckoutSettingsResponse)
async def get_public_checkout_settings(request: Request):
    from api.request_tenant import public_tenant_id

    tid = await public_tenant_id(request)
    return CheckoutSettingsResponse(**_read_checkout_settings(tid))


@router.get("/api/site/appearance", response_model=SiteAppearanceResponse)
async def get_public_site_appearance(host: str | None = Query(default=None)):
    purge_mistaken_platform_logo()

    # Prefer tenant homepage from Postgres when Host maps to an office.
    if host:
        try:
            from app.core.database import AsyncSessionLocal
            from olympus.tenant.domain_resolver import DomainResolver
            from app.services.tenant_site_appearance_service import TenantSiteAppearanceService

            async with AsyncSessionLocal() as session:
                resolved = await DomainResolver(session).resolve(host)
                if resolved:
                    data = await TenantSiteAppearanceService(session).get_appearance(resolved.tenant_id)
                    # Drop internal keys not in response model.
                    clean = {k: v for k, v in data.items() if k in SiteAppearanceResponse.model_fields}
                    return SiteAppearanceResponse(**{**DEFAULT_SITE_APPEARANCE, **clean})
        except Exception:
            pass

        # Custom / office host without DB row — never serve PoreiaGo platform logo.
        if not _is_platform_host(host):
            data = {**DEFAULT_SITE_APPEARANCE, **_read_appearance()}
            logo = str(data.get("logo_url") or "")
            if _is_platform_placeholder_logo(logo):
                data["logo_url"] = ""
            return SiteAppearanceResponse(**data)

    data = _read_appearance()
    # Platform marketing hosts: never auto-fill logo from the shared uploads/site
    # file store. That path resurrected the Achillion Travel mark after logo_url
    # was cleared in JSON. Explicit admin uploads still set logo_url on write.
    if not _is_platform_host(host) and not data.get("logo_url"):
        api_logo = _asset_api_url("logo")
        if api_logo:
            data["logo_url"] = api_logo
    if data.get("hero_image_url") in ("", "/api/site/assets/hero"):
        api_hero = _asset_api_url("hero")
        if api_hero:
            data["hero_image_url"] = api_hero
    if _is_platform_host(host):
        data = _scrub_achillio_from_platform_appearance(data)
    return SiteAppearanceResponse(**data)


@router.get("/api/site/assets/{kind}")
async def get_site_asset(kind: str):
    if kind not in _ALLOWED_KINDS:
        raise HTTPException(status_code=404, detail="Asset not found")
    path = _asset_file(kind)
    if not path:
        raise HTTPException(status_code=404, detail="Asset not found")
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type)


@router.get("/api/site/driver-photos/{filename}")
async def get_driver_photo(filename: str):
    """Public driver headshot for admin + driver PWA headers."""
    import os
    import re

    if not re.fullmatch(r"[A-Za-z0-9._-]+", filename) or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    data_root = Path(os.getenv("POREIAGO_DATA_DIR") or Path(__file__).resolve().parents[1] / "data")
    path = (data_root / "uploads" / "driver_photos" / filename).resolve()
    allowed_root = (data_root / "uploads" / "driver_photos").resolve()
    if not str(path).startswith(str(allowed_root)) or not path.is_file():
        raise HTTPException(status_code=404, detail="Photo not found")
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return FileResponse(
        path,
        media_type=media_type,
        headers={
            # Tiny map avatars are fetched often — let browsers keep them warm.
            "Cache-Control": "public, max-age=604800, immutable",
        },
    )


@router.get("/api/site/rental-photos/{filename}")
async def get_rental_damage_photo(filename: str):
    """Public rental check-in/out damage selfie for admin desk."""
    import os
    import re

    if not re.fullmatch(r"[A-Za-z0-9._-]+", filename) or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    data_root = Path(os.getenv("POREIAGO_DATA_DIR") or Path(__file__).resolve().parents[1] / "data")
    path = (data_root / "uploads" / "rental_damage" / filename).resolve()
    allowed_root = (data_root / "uploads" / "rental_damage").resolve()
    if not str(path).startswith(str(allowed_root)) or not path.is_file():
        raise HTTPException(status_code=404, detail="Photo not found")
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=604800, immutable"},
    )


@router.get("/api/admin/platform/site-appearance", response_model=SiteAppearanceResponse)
async def get_admin_site_appearance():
    return await get_public_site_appearance()


@router.patch("/api/admin/platform/site-appearance", response_model=SiteAppearanceResponse)
async def patch_site_appearance(body: SiteAppearanceUpdate):
    current = _read_appearance()
    patch = _clamp_logo_fields(body.model_dump(exclude_unset=True))
    for key, value in patch.items():
        if value is not None:
            current[key] = value
    saved = _write_appearance(current)
    return SiteAppearanceResponse(**saved)


@router.post("/api/admin/platform/site-appearance/upload/{kind}")
async def upload_site_asset(kind: str, file: UploadFile = File(...)):
    if kind not in _ALLOWED_KINDS:
        raise HTTPException(status_code=400, detail="Invalid asset kind")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    content = await file.read()
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 4 MB)")
    ext = Path(file.filename or "upload.jpg").suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        ext = ".jpg"
    _upload_dir().mkdir(parents=True, exist_ok=True)
    for old in _upload_dir().glob(f"{kind}.*"):
        old.unlink(missing_ok=True)
    out_path = _upload_dir() / f"{kind}{ext}"
    out_path.write_bytes(content)
    current = _read_appearance()
    url_key = "logo_url" if kind == "logo" else "hero_image_url"
    current[url_key] = _asset_api_url(kind)
    saved = _write_appearance(current)
    return {
        "ok": True,
        "kind": kind,
        "url": saved[url_key],
        "appearance": SiteAppearanceResponse(**saved),
    }


@router.delete("/api/admin/platform/site-appearance/upload/{kind}")
async def clear_site_asset(kind: str):
    if kind not in _ALLOWED_KINDS:
        raise HTTPException(status_code=400, detail="Invalid asset kind")
    for old in _upload_dir().glob(f"{kind}.*"):
        old.unlink(missing_ok=True)
    current = _read_appearance()
    if kind == "logo":
        current["logo_url"] = ""
    else:
        current["hero_image_url"] = DEFAULT_SITE_APPEARANCE["hero_image_url"]
    saved = _write_appearance(current)
    return {"ok": True, "appearance": SiteAppearanceResponse(**saved)}


class PublicFleetVehicleResponse(BaseModel):
    id: str
    name: str
    make: str
    model: str
    category: str
    year: int
    seat_count: int
    amenities: list[str]
    summary: str
    image_url: str
    status_label: str


@router.get("/api/site/fleet", response_model=list[PublicFleetVehicleResponse])
async def get_public_fleet(host: str | None = Query(default=None)):
    from api.fleet_public_reader import read_public_fleet

    tenant_id: str | None = None
    if host:
        try:
            from app.core.database import AsyncSessionLocal
            from olympus.tenant.domain_resolver import DomainResolver

            async with AsyncSessionLocal() as session:
                resolved = await DomainResolver(session).resolve(host)
                if resolved:
                    tenant_id = str(resolved.tenant_id)
        except Exception:
            tenant_id = None

    return read_public_fleet(tenant_id=tenant_id)


class OfficeModulesResponse(BaseModel):
    trips_enabled: bool = True
    rent_enabled: bool = False
    plan: str = "starter"
    mode: str = "trips_only"


@router.get("/api/site/modules", response_model=OfficeModulesResponse)
async def get_public_office_modules(
    request: Request,
    host: str | None = Query(default=None),
):
    """
    Public storefront modules for an office host.
    Rent-only contracts hide trips; bus plans show trips; add-on enables Rent.
    """
    effective_host = host or request.headers.get("x-forwarded-host") or request.headers.get("host")
    if effective_host and "," in effective_host:
        effective_host = effective_host.split(",")[0].strip()

    if effective_host:
        try:
            from app.core.database import AsyncSessionLocal
            from olympus.tenant.domain_resolver import DomainResolver
            from app.services.tenant_modules import (
                apply_known_office_rent_policy,
                is_poreiago_platform_office,
                modules_for_tenant,
            )
            from sqlalchemy import select
            from app.models.tenant import Tenant

            async with AsyncSessionLocal() as session:
                resolved = await DomainResolver(session).resolve(effective_host)
                if resolved:
                    row = await session.execute(
                        select(Tenant).where(Tenant.id == resolved.tenant_id)
                    )
                    tenant = row.scalar_one_or_none()
                    if tenant:
                        try:
                            updated = apply_known_office_rent_policy(tenant)
                            if updated is not None:
                                tenant.settings_json = json.dumps(
                                    updated, ensure_ascii=False
                                )
                                await session.commit()
                                await session.refresh(tenant)
                        except Exception:
                            logger.debug(
                                "apply_known_office_rent_policy skipped on /site/modules",
                                exc_info=True,
                            )
                        mods = modules_for_tenant(tenant)
                        if is_poreiago_platform_office(tenant):
                            mods = {
                                **mods,
                                "rent_enabled": True,
                                "trips_enabled": True,
                                "mode": "both",
                            }
                        return OfficeModulesResponse(**mods)
        except Exception:
            logger.exception("office modules resolve failed for host=%s", effective_host)

    host_l = str(effective_host or "").strip().lower().split(":")[0].removeprefix("www.")
    # PoreiaGo marketing apex — Rent + trips (platform product), not bus-only.
    if host_l in {"", "poreiago.com", "localhost", "127.0.0.1"}:
        return OfficeModulesResponse(
            trips_enabled=True,
            rent_enabled=True,
            plan="professional",
            mode="both",
        )

    # Unknown tenant host — default bus storefront shape.
    return OfficeModulesResponse(
        trips_enabled=True,
        rent_enabled=False,
        plan="starter",
        mode="trips_only",
    )


class PublicTripResponse(BaseModel):
    id: int
    title: str = ""
    destination: str = ""
    departureTime: str = ""
    arrivalTime: str = ""
    price: float = 0
    childPrice: float | None = None
    availableSeats: int = 0
    totalSeats: int = 0
    description: str = ""
    image: str = ""
    hook: str = ""
    durationLabel: str = ""
    badge: str = ""
    featured: bool = False
    status: str = "published"
    meetingPoint: str = ""
    highlights: list = Field(default_factory=list)
    stops: list = Field(default_factory=list)
    market: str | None = None
    vehicleType: str = ""
    currency: str = "EUR"


@router.get("/api/site/trips", response_model=list[PublicTripResponse])
async def get_public_office_trips(
    request: Request,
    host: str | None = Query(default=None),
):
    """
    Published trips for an office Host — strictly scoped by tenant_id.
    Never returns another office's catalog or shared demo trips.
    """
    from travel_platform.operations.tenant_trip_catalog_store import list_tenant_trips

    effective_host = host or request.headers.get("x-forwarded-host") or request.headers.get("host")
    if effective_host and "," in effective_host:
        effective_host = effective_host.split(",")[0].strip()
    if effective_host and ":" in effective_host:
        effective_host = effective_host.split(":")[0].strip()

    tenant_id: str | None = None
    if effective_host:
        try:
            from app.core.database import AsyncSessionLocal
            from olympus.tenant.domain_resolver import DomainResolver

            async with AsyncSessionLocal() as session:
                resolved = await DomainResolver(session).resolve(effective_host)
                if resolved:
                    tenant_id = str(resolved.tenant_id)
        except Exception:
            logger.exception("public trips resolve failed for host=%s", effective_host)
            tenant_id = None

    if not tenant_id:
        return []

    rows = list_tenant_trips(tenant_id, published_only=True)
    return [PublicTripResponse(**row) for row in rows]
