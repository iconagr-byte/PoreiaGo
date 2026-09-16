"""
Per-office public SEO (title / description / JSON-LD) for storefront HTML shells.

Googlebot reads static <title> and meta description — never rely on React alone.
"""

from __future__ import annotations

import html
import json
import os
import re
from typing import Any

PLATFORM_TITLE = "PoreiaGo — Πλατφόρμα για ταξιδιωτικά γραφεία"
PLATFORM_DESCRIPTION = (
    "PoreiaGo — πλατφόρμα κρατήσεων, στόλου και wallet για ταξιδιωτικά γραφεία."
)
PLATFORM_NAME = "PoreiaGo"

# Known custom domains when branding API is briefly unavailable.
KNOWN_OFFICE_SEO: dict[str, dict[str, str]] = {
    "achilliotravel.com": {
        "title": "Achillio Travel — Εκδρομές με λεωφορείο",
        "site_name": "Achillio Travel",
        "description": (
            "Achillio Travel — εκδρομές με λεωφορείο στην Ελλάδα. "
            "Κράτηση θέσης, εισιτήρια και My Wallet στο achilliotravel.com."
        ),
    },
}

_TITLE_RE = re.compile(r"<title>[^<]*</title>", re.I)
_APP_NAME_RE = re.compile(
    r'<meta\s+name=["\']application-name["\']\s+content=["\'][^"\']*["\']\s*/?>',
    re.I,
)
_OG_TITLE_RE = re.compile(
    r'<meta\s+property=["\']og:title["\']\s+content=["\'][^"\']*["\']\s*/?>',
    re.I,
)
_TW_TITLE_RE = re.compile(
    r'<meta\s+name=["\']twitter:title["\']\s+content=["\'][^"\']*["\']\s*/?>',
    re.I,
)
_DESC_RE = re.compile(
    r'<meta\s+name=["\']description["\']\s+content=["\'][^"\']*["\']\s*/?>',
    re.I,
)
_OG_DESC_RE = re.compile(
    r'<meta\s+property=["\']og:description["\']\s+content=["\'][^"\']*["\']\s*/?>',
    re.I,
)
_CANONICAL_RE = re.compile(r'<link\s+rel=["\']canonical["\']\s+href=["\'][^"\']*["\']\s*/?>', re.I)
_OG_URL_RE = re.compile(
    r'<meta\s+property=["\']og:url["\']\s+content=["\'][^"\']*["\']\s*/?>',
    re.I,
)
_OG_SITE_RE = re.compile(
    r'<meta\s+property=["\']og:site_name["\']\s+content=["\'][^"\']*["\']\s*/?>',
    re.I,
)
_JSON_LD_RE = re.compile(
    r'<script\s+type=["\']application/ld\+json["\'][^>]*>.*?</script>',
    re.I | re.S,
)
_HTML_COMMENT_POREIAGO_RE = re.compile(
    r"<!--\s*Default = PoreiaGo marketing\..*?-->",
    re.I | re.S,
)


def apex_host(host: str | None) -> str:
    value = str(host or "").strip().lower().split(",")[0].strip()
    value = value.split(":")[0].strip()
    if value.startswith("www."):
        value = value[4:]
    return value


def is_platform_marketing_host(host: str | None) -> bool:
    apex = apex_host(host)
    if not apex:
        return True
    if apex in {"poreiago.com", "localhost", "127.0.0.1"}:
        return True
    if apex.startswith("api."):
        return True
    return False


def humanize_host_label(host: str) -> str:
    apex = apex_host(host)
    if not apex:
        return PLATFORM_NAME
    if apex.endswith(".poreiago.com"):
        slug = apex[: -len(".poreiago.com")]
        if slug and "." not in slug and slug not in {"www", "api", "admin"}:
            return slug.replace("-", " ").title()
    label = apex.split(".")[0] or apex
    return label.replace("-", " ").title()


def build_office_description(site_name: str, hero_title: str = "", hero_subtitle: str = "") -> str:
    brand = (site_name or "").strip() or "Ταξιδιωτικό γραφείο"
    title = re.sub(r"\s+", " ", str(hero_title or "").strip())
    subtitle = re.sub(r"\s+", " ", str(hero_subtitle or "").strip())
    parts = [f"{brand} — επίσημη ιστοσελίδα κρατήσεων."]
    if title:
        parts.append(title.rstrip(":") + ".")
    if subtitle:
        parts.append(subtitle)
    text = " ".join(parts)
    return text[:300].rstrip()


def resolve_seo_payload(
    *,
    host: str | None,
    display_name: str | None = None,
    footer_brand_name: str | None = None,
    hero_title: str | None = None,
    hero_subtitle: str | None = None,
    custom_domain: str | None = None,
    scheme: str = "https",
) -> dict[str, Any]:
    """Build SEO fields for a request host."""
    raw_host = str(host or "").strip().lower().split(",")[0].strip().split(":")[0]
    apex = apex_host(raw_host)
    platform = is_platform_marketing_host(raw_host)

    if platform:
        canonical_host = "www.poreiago.com"
        return {
            "title": PLATFORM_TITLE,
            "site_name": PLATFORM_NAME,
            "description": PLATFORM_DESCRIPTION,
            "canonical_url": f"{scheme}://{canonical_host}/",
            "is_platform": True,
            "office_kind": "poreiago_platform",
        }

    known = KNOWN_OFFICE_SEO.get(apex) or {}
    brand = (
        str(display_name or "").strip()
        or str(footer_brand_name or "").strip()
        or known.get("site_name")
        or humanize_host_label(apex)
    )
    if re.fullmatch(r"(?i)poreiago(\s+platform)?", brand or ""):
        brand = known.get("site_name") or humanize_host_label(apex)

    title = known.get("title") or brand
    description = known.get("description") or build_office_description(
        brand,
        hero_title=hero_title or "",
        hero_subtitle=hero_subtitle or "",
    )

    pub_host = str(custom_domain or raw_host or apex).strip().lower().removeprefix("www.")
    if pub_host and not pub_host.startswith("localhost"):
        canonical = f"{scheme}://www.{pub_host}/"
    else:
        canonical = f"{scheme}://{raw_host or apex}/"

    return {
        "title": title,
        "site_name": brand,
        "description": description,
        "canonical_url": canonical,
        "is_platform": False,
        "office_kind": "achillio_travel" if apex == "achilliotravel.com" else "customer",
    }


def _meta(attr: str, key: str, content: str) -> str:
    return f'<meta {attr}="{key}" content="{html.escape(content, quote=True)}" />'


def inject_office_seo_into_html(raw_html: str, seo: dict[str, Any]) -> str:
    """Rewrite SPA shell head tags for the resolved office / platform SEO."""
    title = str(seo.get("title") or PLATFORM_TITLE).strip()
    site_name = str(seo.get("site_name") or title.split("—")[0]).strip()
    description = str(seo.get("description") or "").strip()
    canonical = str(seo.get("canonical_url") or "").strip()
    out = str(raw_html or "")

    out = _HTML_COMMENT_POREIAGO_RE.sub("", out)

    if _TITLE_RE.search(out):
        out = _TITLE_RE.sub(f"<title>{html.escape(title)}</title>", out, count=1)
    else:
        out = out.replace("<head>", f"<head>\n    <title>{html.escape(title)}</title>", 1)

    def upsert(pattern: re.Pattern[str], tag: str) -> None:
        nonlocal out
        if pattern.search(out):
            out = pattern.sub(tag, out, count=1)
        else:
            out = out.replace("</title>", f"</title>\n    {tag}", 1)

    upsert(_OG_TITLE_RE, _meta("property", "og:title", title))
    upsert(_TW_TITLE_RE, _meta("name", "twitter:title", title))
    upsert(
        _APP_NAME_RE,
        _meta("name", "application-name", site_name),
    )
    if description:
        upsert(_DESC_RE, _meta("name", "description", description))
        upsert(_OG_DESC_RE, _meta("property", "og:description", description))
    if canonical:
        upsert(
            _CANONICAL_RE,
            f'<link rel="canonical" href="{html.escape(canonical, quote=True)}" />',
        )
        upsert(_OG_URL_RE, _meta("property", "og:url", canonical))
    upsert(_OG_SITE_RE, _meta("property", "og:site_name", site_name))

    ld = {
        "@context": "https://schema.org",
        "@type": "TravelAgency" if not seo.get("is_platform") else "SoftwareApplication",
        "name": site_name,
        "url": canonical or None,
        "description": description or None,
    }
    ld = {k: v for k, v in ld.items() if v}
    ld_tag = (
        '<script type="application/ld+json">'
        + json.dumps(ld, ensure_ascii=False, separators=(",", ":"))
        + "</script>"
    )
    if _JSON_LD_RE.search(out):
        out = _JSON_LD_RE.sub(ld_tag, out, count=1)
    else:
        out = out.replace("</head>", f"    {ld_tag}\n  </head>", 1)

    return out


def spa_shell_internal_url(*, is_platform: bool) -> str:
    if is_platform:
        return os.getenv(
            "SPA_SHELL_POREIAGO_URL",
            "http://frontend/index.poreiago.html",
        )
    # Default Achillio / tenant-safe shell (title rewritten again by inject).
    return os.getenv("SPA_SHELL_INTERNAL_URL", "http://frontend/index.html")


def public_origin_from_request_headers(
    host: str | None,
    *,
    forwarded_proto: str | None = None,
) -> str:
    apex = apex_host(host)
    scheme = (forwarded_proto or "https").split(",")[0].strip() or "https"
    if is_platform_marketing_host(host):
        return f"{scheme}://www.poreiago.com"
    if apex:
        return f"{scheme}://www.{apex}"
    return f"{scheme}://localhost"
