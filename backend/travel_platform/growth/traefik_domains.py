"""Write Traefik Host() routers for tenant custom domains (Let's Encrypt)."""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path

logger = logging.getLogger(__name__)

_SAFE_ID = re.compile(r"[^a-z0-9]+")


def _traefik_dynamic_dir() -> Path | None:
    raw = (os.getenv("TRAEFIK_DYNAMIC_DIR") or "").strip()
    if raw:
        return Path(raw)
    # Local / VPS default when API shares the deploy tree.
    candidates = [
        Path("/etc/traefik/dynamic"),
        Path(__file__).resolve().parents[3] / "deploy" / "traefik" / "dynamic",
    ]
    for path in candidates:
        if path.is_dir():
            return path
    return None


def _normalize_domain(value: str) -> str:
    host = value.strip().lower().removeprefix("https://").removeprefix("http://")
    host = host.split("/")[0].split(":")[0].removeprefix("www.")
    return host


def _router_id(domain: str) -> str:
    slug = _SAFE_ID.sub("-", domain).strip("-") or "domain"
    return f"tenant-domain-{slug}"[:63]


def render_custom_domains_yaml(domains: list[str]) -> str:
    """Build Traefik dynamic YAML for apex + www of each custom domain."""
    unique: list[str] = []
    seen: set[str] = set()
    for raw in domains:
        domain = _normalize_domain(raw or "")
        if not domain or domain in seen:
            continue
        # Never steal platform hostnames.
        if domain in {"poreiago.com", "olympus-saas.com"} or domain.endswith(".poreiago.com"):
            continue
        seen.add(domain)
        unique.append(domain)

    lines = [
        "# AUTO-GENERATED — tenant custom domains for Traefik + Let's Encrypt",
        "# Do not edit by hand; regenerated when Domain settings are saved.",
        "",
        "http:",
        "  routers:",
    ]

    if not unique:
        lines.extend(
            [
                "    # (no custom domains registered)",
                "  services:",
                "    tenant-custom-frontend:",
                "      loadBalancer:",
                "        servers:",
                '          - url: "http://frontend:80"',
                "",
            ]
        )
        return "\n".join(lines)

    for domain in unique:
        rid = _router_id(domain)
        lines.extend(
            [
                f"    {rid}:",
                f"      rule: Host(`{domain}`) || Host(`www.{domain}`)",
                "      entryPoints:",
                "        - websecure",
                "      service: tenant-custom-frontend",
                "      priority: 40",
                "      tls:",
                "        certResolver: letsencrypt",
                "        domains:",
                f'          - main: "{domain}"',
                "            sans:",
                f'              - "www.{domain}"',
                "      middlewares:",
                "        - security-headers@file",
                "",
            ]
        )

    lines.extend(
        [
            "  services:",
            "    tenant-custom-frontend:",
            "      loadBalancer:",
            "        servers:",
            '          - url: "http://frontend:80"',
            "",
        ]
    )
    return "\n".join(lines)


def write_custom_domains_file(domains: list[str], *, path: Path | None = None) -> Path | None:
    target_dir = path.parent if path else _traefik_dynamic_dir()
    if target_dir is None:
        logger.info("TRAEFIK_DYNAMIC_DIR unset — skip custom domain Traefik sync")
        return None

    out = path or (target_dir / "custom-domains.yml")
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
        content = render_custom_domains_yaml(domains)
        tmp = out.with_suffix(".yml.tmp")
        tmp.write_text(content, encoding="utf-8")
        tmp.replace(out)
        logger.info("Wrote Traefik custom domains (%s): %s", len(domains), out)
        return out
    except OSError as exc:
        logger.warning("Failed to write Traefik custom domains file: %s", exc)
        return None


async def sync_traefik_custom_domains_from_db(session) -> list[str]:
    """Load tenants.custom_domain and refresh Traefik dynamic config."""
    from sqlalchemy import select

    from app.models.tenant import Tenant

    result = await session.execute(
        select(Tenant.custom_domain).where(
            Tenant.is_active.is_(True),
            Tenant.custom_domain.is_not(None),
            Tenant.custom_domain != "",
        )
    )
    domains = [row[0] for row in result.all() if row[0]]
    if not domains:
        logger.info("No tenants.custom_domain rows — leave Traefik custom-domains.yml unchanged")
        return []
    write_custom_domains_file(domains)
    return domains
