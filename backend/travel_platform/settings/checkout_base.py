"""Resolve production checkout base URLs — never leave localhost in live emails."""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

PRODUCTION_PLATFORM_CHECKOUT = "https://www.poreiago.com"
PRODUCTION_ACHILLIO_CHECKOUT = "https://www.achilliotravel.com"


def is_localhost_checkout_url(url: str | None) -> bool:
    raw = str(url or "").strip()
    if not raw:
        return True
    try:
        parsed = urlparse(raw if "://" in raw else f"https://{raw}")
        host = (parsed.hostname or "").lower()
    except Exception:
        host = raw.lower()
    return host in {"localhost", "127.0.0.1", "0.0.0.0", "::1"} or host.endswith(".localhost")


def normalize_public_origin(host_or_url: str) -> str:
    raw = str(host_or_url or "").strip()
    if not raw:
        return ""
    try:
        parsed = urlparse(raw if "://" in raw else f"https://{raw}")
        host = (parsed.hostname or "").lower().removeprefix("www.")
    except Exception:
        host = raw.lower().removeprefix("https://").removeprefix("http://")
        host = host.split("/")[0].split(":")[0].removeprefix("www.")
    if not host or is_localhost_checkout_url(host):
        return ""
    return f"https://www.{host}"


def resolve_tenant_checkout_base(tenant: Any, *, base_domain: str = "poreiago.com") -> str:
    """Pick the public origin for abandoned-cart / recovery links for one office."""
    try:
        from app.services.tenant_modules import (
            is_achillio_travel_office,
            is_poreiago_platform_office,
        )
    except Exception:
        is_achillio_travel_office = None  # type: ignore[assignment]
        is_poreiago_platform_office = None  # type: ignore[assignment]

    if is_achillio_travel_office and is_achillio_travel_office(tenant):
        custom = str(getattr(tenant, "custom_domain", None) or "").strip()
        return normalize_public_origin(custom) or PRODUCTION_ACHILLIO_CHECKOUT

    if is_poreiago_platform_office and is_poreiago_platform_office(tenant):
        return PRODUCTION_PLATFORM_CHECKOUT

    custom = str(getattr(tenant, "custom_domain", None) or "").strip()
    origin = normalize_public_origin(custom)
    if origin:
        return origin

    platform = (base_domain or "poreiago.com").strip().lower().removeprefix("www.")
    subdomain = str(getattr(tenant, "subdomain", None) or getattr(tenant, "slug", None) or "").strip().lower()
    subdomain = "".join(ch if ch.isalnum() or ch == "-" else "" for ch in subdomain)
    if subdomain and subdomain not in {"www", "api", "admin", "mail", "wallet"}:
        return f"https://{subdomain}.{platform}"
    return f"https://www.{platform}"


def heal_checkout_base_url(url: str | None, *, fallback: str = PRODUCTION_PLATFORM_CHECKOUT) -> str:
    """Replace empty/localhost checkout URLs with a production fallback."""
    raw = str(url or "").strip().rstrip("/")
    if is_localhost_checkout_url(raw):
        return str(fallback or PRODUCTION_PLATFORM_CHECKOUT).rstrip("/")
    return raw
