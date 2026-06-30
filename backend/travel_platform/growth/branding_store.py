"""File-backed white-label branding (demo / no Postgres tenant_branding)."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
STORE_PATH = DATA_DIR / "tenant_branding.json"

DEFAULT_BRANDING = {
    "slug": "achillio",
    "display_name": "Achillio Travel",
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


def get_branding(tenant_key: str = "default") -> BrandingConfig:
    data = _load_all()
    row = data.get(tenant_key) or data.get("default") or DEFAULT_BRANDING
    return BrandingConfig(**{**DEFAULT_BRANDING, **row})


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
        domain = (row.get("custom_domain") or "").lower().removeprefix("www.")
        if domain and domain == h and row.get("verified_domain", False):
            return BrandingConfig(**{**DEFAULT_BRANDING, **row})
    return get_branding("default")
