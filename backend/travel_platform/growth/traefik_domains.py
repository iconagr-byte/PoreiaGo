"""Write Traefik Host() routers for tenant custom domains (Let's Encrypt)."""

from __future__ import annotations

import logging
import os
import re
import socket
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


def platform_ingress_ips() -> set[str]:
    """IPs that count as “points at PoreiaGo” for apex DNS checks."""
    raw = (os.getenv("PLATFORM_INGRESS_IP") or os.getenv("PLATFORM_INGRESS_IPS") or "").strip()
    ips = {p.strip() for p in raw.split(",") if p.strip()}
    # Well-known production ingress (www/api.poreiago.com on Contabo).
    ips.add("169.58.199.186")
    return ips


def apex_points_to_platform(domain: str, *, ingress_ips: set[str] | None = None) -> bool:
    """True when apex A/AAAA records include a platform ingress IP."""
    host = _normalize_domain(domain)
    if not host:
        return False
    allowed = ingress_ips if ingress_ips is not None else platform_ingress_ips()
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
    resolved = {info[4][0] for info in infos if info and info[4]}
    return bool(resolved & allowed)


def render_custom_domains_yaml(
    domains: list[str],
    *,
    include_apex: bool | None = None,
    apex_domains: set[str] | None = None,
) -> str:
    """Build Traefik dynamic YAML for custom domains.

    By default only ``www.{domain}`` is certified/routed. Apex is included when:
    - ``include_apex=True`` for all domains, or
    - the domain is listed in ``apex_domains``, or
    - ``include_apex is None`` (auto) and apex DNS already points at the platform.

    Apex and www use **separate** Let's Encrypt mains (not SANs) so a bad apex
    DNS record cannot break the www certificate.
    """
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
        "# Do not edit by hand; regenerated when Domain settings are saved / API boots.",
        "# Apex is added only when DNS A/AAAA already points at PLATFORM_INGRESS_IP.",
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
        use_apex = False
        if include_apex is True:
            use_apex = True
        elif include_apex is False:
            use_apex = False
        elif apex_domains is not None:
            use_apex = domain in apex_domains
        else:
            use_apex = apex_points_to_platform(domain)

        hosts = [f"www.{domain}"]
        if use_apex:
            hosts.insert(0, domain)
        rid = _router_id("www-" + domain if not use_apex else domain)
        rule = " || ".join(f"Host(`{h}`)" for h in hosts)
        lines.extend(
            [
                f"    {rid}:",
                f"      rule: {rule}",
                "      entryPoints:",
                "        - websecure",
                "      service: tenant-custom-frontend",
                "      priority: 40",
                "      tls:",
                "        certResolver: letsencrypt",
                "        domains:",
            ]
        )
        # Separate LE certificates — never attach apex as SAN of www.
        for host in hosts:
            lines.append(f'          - main: "{host}"')
        lines.extend(
            [
                "      middlewares:",
                "        - security-headers@file",
                "",
            ]
        )
        if use_apex:
            logger.info("Traefik custom domain includes apex: %s", domain)
        else:
            logger.info("Traefik custom domain www-only (apex DNS not on platform): %s", domain)

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


def write_custom_domains_file(
    domains: list[str],
    *,
    path: Path | None = None,
    include_apex: bool | None = None,
) -> Path | None:
    target_dir = path.parent if path else _traefik_dynamic_dir()
    if target_dir is None:
        logger.info("TRAEFIK_DYNAMIC_DIR unset — skip custom domain Traefik sync")
        return None

    out = path or (target_dir / "custom-domains.yml")
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
        content = render_custom_domains_yaml(domains, include_apex=include_apex)
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
    write_custom_domains_file(domains, include_apex=None)
    return domains
