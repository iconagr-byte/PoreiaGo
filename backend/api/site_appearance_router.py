"""Public + admin site appearance (homepage logo, hero, footer) — lightweight JSON store."""

from __future__ import annotations

import json
import mimetypes
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter(tags=["site-appearance"])

_DATA = Path(__file__).resolve().parents[1] / "data"
_APPEARANCE_FILE = _DATA / "site_appearance.json"
_UPLOAD_DIR = _DATA / "uploads" / "site"
_PLATFORM_SETTINGS_FILE = Path(__file__).resolve().parents[1] / "platform" / "settings" / "platform_settings.json"
_ALLOWED_KINDS = frozenset({"logo", "hero"})
_MAX_UPLOAD_BYTES = 4 * 1024 * 1024

DEFAULT_SITE_APPEARANCE = {
    "logo_url": "",
    "hero_image_url": "/images/hero-bus-achillio.png",
    "hero_badge": "Premium Ταξιδιωτική Εμπειρία",
    "hero_title": "Η Ελλάδα, όπως δεν την έχεις ξαναδεί:",
    "hero_title_accent": "Άνεση, ασφάλεια & θέση εξασφαλισμένη.",
    "hero_subtitle": (
        "Διάλεξτε από τις προγραμματισμένες εκδρομές μας — χωρίς αναζήτηση προορισμού, "
        "μόνο ταξίδια που οργανώνουμε εμείς."
    ),
    "hero_search_label": "Πρόγραμμα εκδρομών",
    "footer_brand_name": "AeroStride",
    "footer_copyright": "© 2024 AeroStride. Redefining the journey.",
    "footer_privacy_label": "Privacy Policy",
    "footer_privacy_url": "#",
    "footer_terms_label": "Terms of Service",
    "footer_terms_url": "#",
    "footer_contact_email": "",
    "footer_contact_phone": "",
    "footer_address": "",
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
    "trips_section_eyebrow": "Ανακαλύψτε",
    "trips_section_title": "Εκδρομές στην Ελλάδα",
    "trips_section_subtitle": (
        "Ημερήσιες και πολυήμερες διαδρομές με premium στόλο — κράτηση θέσης online."
    ),
    "intl_section_eyebrow": "Διεθνή δρομολόγια",
    "intl_section_title": "Ταξίδια προς το Εξωτερικό",
    "intl_section_subtitle": (
        "Αναχωρήσεις από Ελλάδα με Premium & Luxury coach — κράτηση θέσης online σε λίγα δευτερόλεπτα."
    ),
    "updated_at": None,
}


class SiteAppearanceResponse(BaseModel):
    logo_url: str = ""
    hero_image_url: str = "/images/hero-bus-achillio.png"
    hero_badge: str = "Premium Ταξιδιωτική Εμπειρία"
    hero_title: str = "Η Ελλάδα, όπως δεν την έχεις ξαναδεί:"
    hero_title_accent: str = "Άνεση, ασφάλεια & θέση εξασφαλισμένη."
    hero_subtitle: str = (
        "Διάλεξτε από τις προγραμματισμένες εκδρομές μας — χωρίς αναζήτηση προορισμού, "
        "μόνο ταξίδια που οργανώνουμε εμείς."
    )
    hero_search_label: str = "Πρόγραμμα εκδρομών"
    footer_brand_name: str = "AeroStride"
    footer_copyright: str = "© 2024 AeroStride. Redefining the journey."
    footer_privacy_label: str = "Privacy Policy"
    footer_privacy_url: str = "#"
    footer_terms_label: str = "Terms of Service"
    footer_terms_url: str = "#"
    footer_contact_email: str = ""
    footer_contact_phone: str = ""
    footer_address: str = ""
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
    trips_section_eyebrow: str = "Ανακαλύψτε"
    trips_section_title: str = "Εκδρομές στην Ελλάδα"
    trips_section_subtitle: str = (
        "Ημερήσιες και πολυήμερες διαδρομές με premium στόλο — κράτηση θέσης online."
    )
    intl_section_eyebrow: str = "Διεθνή δρομολόγια"
    intl_section_title: str = "Ταξίδια προς το Εξωτερικό"
    intl_section_subtitle: str = (
        "Αναχωρήσεις από Ελλάδα με Premium & Luxury coach — κράτηση θέσης online σε λίγα δευτερόλεπτα."
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
    hero_image_url: str | None = None
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
    trips_section_eyebrow: str | None = None
    trips_section_title: str | None = None
    trips_section_subtitle: str | None = None
    intl_section_eyebrow: str | None = None
    intl_section_title: str | None = None
    intl_section_subtitle: str | None = None


def _read_appearance() -> dict:
    if not _APPEARANCE_FILE.exists():
        return {**DEFAULT_SITE_APPEARANCE}
    try:
        raw = json.loads(_APPEARANCE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, TypeError):
        return {**DEFAULT_SITE_APPEARANCE}
    return {**DEFAULT_SITE_APPEARANCE, **raw}


def _write_appearance(data: dict) -> dict:
    _APPEARANCE_FILE.parent.mkdir(parents=True, exist_ok=True)
    merged = {**DEFAULT_SITE_APPEARANCE, **data}
    merged["updated_at"] = datetime.now(timezone.utc).isoformat()
    _APPEARANCE_FILE.write_text(
        json.dumps(merged, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return merged


def _asset_file(kind: str) -> Path | None:
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        path = _UPLOAD_DIR / f"{kind}{ext}"
        if path.is_file():
            return path
    return None


def _asset_api_url(kind: str) -> str:
    path = _asset_file(kind)
    if not path:
        return ""
    version = int(path.stat().st_mtime)
    return f"/api/site/assets/{kind}?v={version}"


def _read_checkout_settings() -> dict:
    try:
        from travel_platform.settings.payment_settings_store import get_public_payment_settings

        pub = get_public_payment_settings()
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
    if not _PLATFORM_SETTINGS_FILE.exists():
        return defaults
    try:
        raw = json.loads(_PLATFORM_SETTINGS_FILE.read_text(encoding="utf-8"))
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
async def get_public_checkout_settings():
    return CheckoutSettingsResponse(**_read_checkout_settings())


@router.get("/api/site/appearance", response_model=SiteAppearanceResponse)
async def get_public_site_appearance():
    data = _read_appearance()
    if not data.get("logo_url"):
        api_logo = _asset_api_url("logo")
        if api_logo:
            data["logo_url"] = api_logo
    if data.get("hero_image_url") in ("", "/api/site/assets/hero"):
        api_hero = _asset_api_url("hero")
        if api_hero:
            data["hero_image_url"] = api_hero
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
    return FileResponse(path, media_type=media_type)


@router.get("/api/admin/platform/site-appearance", response_model=SiteAppearanceResponse)
async def get_admin_site_appearance():
    return await get_public_site_appearance()


@router.patch("/api/admin/platform/site-appearance", response_model=SiteAppearanceResponse)
async def patch_site_appearance(body: SiteAppearanceUpdate):
    current = _read_appearance()
    patch = body.model_dump(exclude_unset=True)
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
    _UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    for old in _UPLOAD_DIR.glob(f"{kind}.*"):
        old.unlink(missing_ok=True)
    out_path = _UPLOAD_DIR / f"{kind}{ext}"
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
    for old in _UPLOAD_DIR.glob(f"{kind}.*"):
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
async def get_public_fleet():
    from api.fleet_public_reader import read_public_fleet

    return read_public_fleet()
