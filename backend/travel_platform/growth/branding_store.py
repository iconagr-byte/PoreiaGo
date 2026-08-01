"""File-backed white-label branding (demo / no Postgres tenant_branding)."""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.data_paths import poreiago_data_dir, resolve_data_file

_LEGACY_DATA = Path(__file__).resolve().parents[2] / "data"
DATA_DIR = poreiago_data_dir()
STORE_PATH = resolve_data_file("tenant_branding.json", _LEGACY_DATA / "tenant_branding.json")

DEFAULT_BRANDING = {
    "slug": "poreiago",
    "display_name": "PoreiaGo",
    "logo_url": "",
    "primary_color": "#0040df",
    "custom_domain": "",
    "css_injection_url": "",
    "css_injection_inline": "",
    "verified_domain": True,
    "checkout_base_url": "http://localhost:5173",
}


@dataclass
class BrandingConfig:
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

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _load_all() -> dict[str, dict[str, Any]]:
    if not STORE_PATH.exists():
        return {"default": {**DEFAULT_BRANDING}}
    try:
        return json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, TypeError):
        return {"default": {**DEFAULT_BRANDING}}


def _save_all(data: dict[str, dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    STORE_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


_ACHILLIO_TRAVEL_SLUGS = frozenset(
    {"admin-achillio-gr", "achillio-travel", "achilliotravel"}
)
_PLATFORM_KEYS = frozenset({"default", "poreiago", "achillio", "platform", "demo"})


def _heal_platform_row(key: str, row: dict[str, Any]) -> dict[str, Any]:
    """Never let shared platform keys advertise Achillio Travel domain/name."""
    if key not in _PLATFORM_KEYS:
        return row
    merged = {**DEFAULT_BRANDING, **row}
    domain = str(merged.get("custom_domain") or "").strip().lower().removeprefix("www.")
    if domain == "achilliotravel.com" or domain.endswith(".achilliotravel.com"):
        merged["custom_domain"] = ""
        merged["verified_domain"] = True
    checkout = str(merged.get("checkout_base_url") or "").strip().lower()
    if "achilliotravel.com" in checkout:
        merged["checkout_base_url"] = "https://www.poreiago.com"
    slug = str(merged.get("slug") or "").strip().lower()
    if slug in _ACHILLIO_TRAVEL_SLUGS:
        merged["slug"] = "poreiago"
    name = str(merged.get("display_name") or "").strip()
    if (not name) or ("achillio" in name.lower()):
        merged["display_name"] = "PoreiaGo"
    return merged


def get_branding(tenant_key: str = "default") -> BrandingConfig:
    data = _load_all()
    key = (tenant_key or "default").strip().lower() or "default"
    row = data.get(key) or data.get("default") or DEFAULT_BRANDING
    healed = _heal_platform_row(key if key in data else "default", dict(row))
    return BrandingConfig(**{**DEFAULT_BRANDING, **healed})


def update_branding(tenant_key: str, patch: dict[str, Any]) -> BrandingConfig:
    data = _load_all()
    current = {**DEFAULT_BRANDING, **data.get(tenant_key, {})}
    allowed = set(BrandingConfig.__dataclass_fields__.keys())
    for k, v in patch.items():
        if k in allowed and v is not None:
            current[k] = v
    if patch.get("custom_domain") and patch["custom_domain"] != current.get("custom_domain"):
        current["verified_domain"] = False
    current["updated_at"] = datetime.now(timezone.utc).isoformat()
    data[tenant_key] = current
    _save_all(data)
    return BrandingConfig(**current)


def resolve_by_host(host: str) -> BrandingConfig | None:
    h = (host or "").lower().removeprefix("www.")
    if not h or h in ("localhost", "127.0.0.1"):
        return get_branding("default")
    for key, row in _load_all().items():
        if key in ("default",):
            continue
        domain = (row.get("custom_domain") or "").lower().removeprefix("www.")
        if domain and domain == h and row.get("verified_domain", False):
            return BrandingConfig(**{**DEFAULT_BRANDING, **row})
    # Unknown hosts: do NOT fall back to poisoned "default" (last office writer).
    return None
