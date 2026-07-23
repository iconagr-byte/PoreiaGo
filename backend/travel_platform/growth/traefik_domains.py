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
    """IPs that serve PoreiaGo Traefik (apex A records must match one of these)."""
    raw = (os.getenv("PLATFORM_INGRESS_IPS") or os.getenv("PLATFORM_INGRESS_IP") or "").strip()
    ips: set[str] = {p.strip() for p in raw.split(",") if p.strip()}
    cname = (os.getenv("OLYMPUS_INGRESS_CNAME") or os.getenv("DEFAULT_INGRESS_CNAME") or "www.poreiago.com").strip()
    if cname:
        try:
            for info in socket.getaddrinfo(cname, None, type=socket.SOCK_STREAM):
                ips.add(info[4][0])
        except OSError:
            logger.debug("Could not resolve ingress CNAME %s", cname, exc_info=True)
    # Known production Droplet (belt-and-suspenders when DNS lookup is blocked).
    ips.add("34.141.98.145")
    return ips


def resolve_host_ips(hostname: str) -> set[str]:
    try:
        return {info[4][0] for info in socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)}
    except OSError:
        return set()


def apex_points_at_platform(domain: str, *, ingress_ips: set[str] | None = None) -> bool:
    """True when apex A/AAAA already targets the PoreiaGo ingress."""
    host = _normalize_domain(domain)
    if not host:
        return False
    ips = resolve_host_ips(host)
    if not ips:
        return False
    allowed = ingress_ips if ingress_ips is not None else platform_ingress_ips()
    return bool(ips & allowed)


def should_include_apex(domain: str, *, force: bool | None = None) -> bool:
    """Include apex router when forced, env-enabled, or DNS already points at us."""
    if force is not None:
        return force
    env = (os.getenv("TRAEFIK_INCLUDE_APEX") or "").strip().lower()
    if env in {"1", "true", "yes", "always", "all"}:
        return True
    if env in {"0", "false", "no", "never"}:
        return False
    forced = {
        _normalize_domain(d)
        for d in (os.getenv("TRAEFIK_FORCE_APEX_DOMAINS") or "").split(",")
        if d.strip()
    }
    host = _normalize_domain(domain)
    if host in forced:
        return True
    # Default: provisional apex router so the moment DNS flips, LE can issue.
    # Separate www/apex certs — failed apex ACME does not break www.
    return True


def render_custom_domains_yaml(
    domains: list[str],
    *,
    include_apex: bool | None = None,
) -> str:
    """Build Traefik dynamic YAML for custom domains.

    Always routes ``www.{domain}`` with its own Let's Encrypt cert.

    Apex (``{domain}``) gets a *separate* router/cert when ``include_apex`` is
    true (default). Separate certs keep www working even if apex DNS still
    points at old hosting and LE cannot validate the apex yet.
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
        "# Do not edit by hand; regenerated when Domain settings are saved.",
        "# www and apex use separate routers/certs so apex DNS lag cannot break www TLS.",
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
        www_host = f"www.{domain}"
        www_rid = _router_id("www-" + domain)
        lines.extend(
            [
                f"    {www_rid}:",
                f"      rule: Host(`{www_host}`)",
                "      entryPoints:",
                "        - websecure",
                "      service: tenant-custom-frontend",
                "      priority: 40",
                "      tls:",
                "        certResolver: letsencrypt",
                "        domains:",
                f'          - main: "{www_host}"',
                "      middlewares:",
                "        - security-headers@file",
                "",
            ]
        )

        use_apex = should_include_apex(domain) if include_apex is None else include_apex
        if use_apex:
            apex_rid = _router_id("apex-" + domain)
            lines.extend(
                [
                    f"    {apex_rid}:",
                    f"      rule: Host(`{domain}`)",
                    "      entryPoints:",
                    "        - websecure",
                    "      service: tenant-custom-frontend",
                    "      priority: 40",
                    "      tls:",
                    "        certResolver: letsencrypt",
                    "        domains:",
                    f'          - main: "{domain}"',
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
