"""Generate nginx map: apex custom domain → www (Achillio-style for any office)."""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path

logger = logging.getLogger(__name__)

_SAFE = re.compile(r"[^a-z0-9.-]+")


def _normalize_domain(value: str) -> str:
    host = value.strip().lower().removeprefix("https://").removeprefix("http://")
    host = host.split("/")[0].split(":")[0].removeprefix("www.")
    return host


def _escape_nginx_regex_host(domain: str) -> str:
    # domain labels are [a-z0-9.-]; escape dots for nginx ~* regex.
    return re.escape(domain)


def default_seed_domains() -> list[str]:
    """Always include Achillio Travel so Contabo SERP redirect never regresses."""
    return ["achilliotravel.com"]


def nginx_map_path() -> Path:
    raw = (os.getenv("NGINX_APEX_WWW_MAP") or "").strip()
    if raw:
        return Path(raw)
    return Path(__file__).resolve().parents[3] / "deploy" / "nginx" / "apex-www-redirect.map"


def render_apex_www_redirect_map(domains: list[str]) -> str:
    """
    Build nginx map assigning $apex_to_www to the www host when request is apex.

    Used as:
      include .../apex-www-redirect.map;
      if ($apex_to_www != "") { return 301 https://$apex_to_www$request_uri; }
    """
    unique: list[str] = []
    seen: set[str] = set()
    for raw in list(default_seed_domains()) + list(domains or []):
        domain = _normalize_domain(raw or "")
        if not domain or domain in seen:
            continue
        if domain in {"poreiago.com", "olympus-saas.com"} or domain.endswith(".poreiago.com"):
            continue
        if _SAFE.search(domain):
            continue
        seen.add(domain)
        unique.append(domain)

    lines = [
        "# AUTO-GENERATED — apex → www redirect for tenant custom domains",
        "# Regenerated when Domain settings are saved / API boots / deploy sync.",
        "# Do not edit by hand.",
        "",
        'map "$host|$http_x_forwarded_host" $apex_to_www {',
        '    default "";',
    ]
    for domain in unique:
        esc = _escape_nginx_regex_host(domain)
        www = f"www.{domain}"
        # Host is exactly apex, or XFH contains apex (NPM may pass 127.0.0.1 as Host).
        lines.append(f"    ~*^{esc}\\| {www};")
        lines.append(f"    ~*\\|{esc}(?::[0-9]+)?(?:,|$) {www};")

    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def write_apex_www_redirect_map(
    domains: list[str],
    *,
    path: Path | None = None,
) -> Path | None:
    out = path or nginx_map_path()
    try:
        out.parent.mkdir(parents=True, exist_ok=True)
        content = render_apex_www_redirect_map(domains)
        tmp = out.with_suffix(".map.tmp")
        tmp.write_text(content, encoding="utf-8")
        tmp.replace(out)
        logger.info("Wrote nginx apex→www map (%s domains): %s", len(domains), out)
        _maybe_reload_frontend_nginx()
        return out
    except OSError as exc:
        logger.warning("Failed to write nginx apex→www map: %s", exc)
        return None


def _maybe_reload_frontend_nginx() -> None:
    """Best-effort: copy map into frontend container + nginx -s reload (Contabo)."""
    import shutil
    import subprocess

    # Off by default — Contabo deploy/repair scripts reload nginx explicitly.
    # Avoid tenant-triggered docker reload storms from provision-edge.
    marker = (os.getenv("NGINX_RELOAD_AFTER_MAP") or "0").strip().lower()
    if marker not in {"1", "true", "yes", "on"}:
        return
    fe_name = (os.getenv("FRONTEND_CONTAINER") or "").strip()
    map_src = nginx_map_path()
    if not map_src.is_file():
        return
    # Prefer explicit container; else common Contabo / compose names.
    candidates = [fe_name] if fe_name else [
        "poreiago-frontend",
        "aerostride-prod-frontend-1",
        "frontend",
    ]
    docker = shutil.which("docker")
    if not docker:
        return
    for name in candidates:
        if not name:
            continue
        try:
            probe = subprocess.run(
                [docker, "inspect", "-f", "{{.State.Running}}", name],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            if probe.returncode != 0 or "true" not in (probe.stdout or "").lower():
                continue
            cp = subprocess.run(
                [docker, "cp", str(map_src), f"{name}:/etc/nginx/conf.d/apex-www-redirect.map"],
                capture_output=True,
                text=True,
                timeout=15,
                check=False,
            )
            if cp.returncode != 0:
                logger.debug("docker cp apex map to %s failed: %s", name, cp.stderr)
                continue
            test = subprocess.run(
                [docker, "exec", name, "nginx", "-t"],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            if test.returncode != 0:
                logger.warning("nginx -t failed in %s after apex map update", name)
                continue
            subprocess.run(
                [docker, "exec", name, "nginx", "-s", "reload"],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            logger.info("Reloaded frontend nginx %s with updated apex→www map", name)
            return
        except Exception:
            logger.debug("frontend nginx reload skipped for %s", name, exc_info=True)
