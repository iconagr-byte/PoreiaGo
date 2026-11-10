"""Live DNS checks for tenant custom domains (Achillio-style CNAME + apex A)."""

from __future__ import annotations

import logging
import os
import socket
from typing import Any

from travel_platform.growth.traefik_domains import (
    _normalize_domain,
    apex_points_to_platform,
    platform_ingress_ips,
)

logger = logging.getLogger(__name__)

# Public CNAME target offices should point www → (Contabo / poreiago edge).
DEFAULT_INGRESS_CNAME = "www.poreiago.com"


def platform_ingress_cname() -> str:
    raw = (
        os.getenv("OLYMPUS_INGRESS_CNAME")
        or os.getenv("PLATFORM_INGRESS_CNAME")
        or DEFAULT_INGRESS_CNAME
    ).strip().lower()
    return raw.removeprefix("https://").removeprefix("http://").split("/")[0] or DEFAULT_INGRESS_CNAME


def platform_ingress_ip() -> str:
    raw = (os.getenv("PLATFORM_INGRESS_IP") or "169.58.199.186").strip()
    return raw.split(",")[0].strip() or "169.58.199.186"


def _resolve_addrs(host: str) -> list[str]:
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for info in infos:
        if not info or not info[4]:
            continue
        addr = str(info[4][0])
        if addr not in seen:
            seen.add(addr)
            out.append(addr)
    return out


def _cname_chain(host: str, *, max_hops: int = 8) -> list[str]:
    """Follow CNAME aliases when dnspython is available; else return []."""
    chain: list[str] = []
    current = host.rstrip(".").lower()
    try:
        import dns.resolver  # type: ignore
    except Exception:
        return chain

    resolver = dns.resolver.Resolver()
    resolver.lifetime = 3.0
    for _ in range(max_hops):
        try:
            answers = resolver.resolve(current, "CNAME")
        except Exception:
            break
        nxt = None
        for rdata in answers:
            target = str(getattr(rdata, "target", rdata)).rstrip(".").lower()
            if target:
                nxt = target
                break
        if not nxt or nxt in chain:
            break
        chain.append(nxt)
        current = nxt
    return chain


def www_points_to_platform(domain: str, *, ingress_cname: str | None = None) -> dict[str, Any]:
    """
    True when www.{apex} ultimately reaches the platform ingress CNAME or IP set.

    Accepts:
    - CNAME chain ending at www.poreiago.com (or OLYMPUS_INGRESS_CNAME)
    - A/AAAA that intersects platform_ingress_ips()
    """
    apex = _normalize_domain(domain)
    www = f"www.{apex}" if apex else ""
    target = (ingress_cname or platform_ingress_cname()).lower().rstrip(".")
    allowed_ips = platform_ingress_ips()
    chain = _cname_chain(www) if www else []
    addrs = _resolve_addrs(www) if www else []
    target_norm = target.rstrip(".")

    def _hits_ingress(host: str) -> bool:
        h = host.rstrip(".").lower()
        if h == target_norm:
            return True
        # Accept any poreiago.com host (www / apex / ingress alias).
        if h == "poreiago.com" or h.endswith(".poreiago.com"):
            return True
        return False

    cname_ok = any(_hits_ingress(h) for h in chain)
    # Also accept if the final alias host resolves to platform IPs.
    if not cname_ok and chain:
        final_addrs = _resolve_addrs(chain[-1])
        cname_ok = bool(set(final_addrs) & allowed_ips)

    a_ok = bool(set(addrs) & allowed_ips)
    ok = cname_ok or a_ok
    return {
        "host": www,
        "ok": ok,
        "cname_chain": chain,
        "addresses": addrs,
        "expected_cname": target,
        "matched_via": "cname" if cname_ok else ("a" if a_ok else None),
    }


def check_custom_domain_dns(domain: str) -> dict[str, Any]:
    """
    Live DNS status for an office custom domain (apex stored without www).

    Returns a JSON-ready dict for BrandingPanel / SuperAdmin.
    """
    apex = _normalize_domain(domain or "")
    ingress_cname = platform_ingress_cname()
    ingress_ip = platform_ingress_ip()
    if not apex:
        return {
            "domain": "",
            "www_ok": False,
            "apex_ok": False,
            "ready_for_tls": False,
            "ingress_cname": ingress_cname,
            "ingress_ip": ingress_ip,
            "www": None,
            "apex": None,
            "message": "Δώσε custom domain (χωρίς www).",
        }

    www = www_points_to_platform(apex, ingress_cname=ingress_cname)
    apex_ok = apex_points_to_platform(apex)
    apex_addrs = _resolve_addrs(apex)
    ready = bool(www["ok"])  # www is enough for TLS; apex is optional redirect
    if www["ok"] and apex_ok:
        message = "DNS έτοιμο — www και apex δείχνουν στο PoreiaGo."
    elif www["ok"]:
        message = (
            "Το www δείχνει σωστά. Προαιρετικά βάλε A record στο apex (@) → "
            f"{ingress_ip} για redirect χωρίς www."
        )
    elif apex_ok:
        message = (
            f"Το apex δείχνει στο VPS, αλλά λείπει CNAME: www.{apex} → {ingress_cname}."
        )
    else:
        message = (
            f"Βάλε CNAME: www.{apex} → {ingress_cname}. "
            f"Για HTTPS χωρίς www: A @ → {ingress_ip}."
        )

    return {
        "domain": apex,
        "www_ok": bool(www["ok"]),
        "apex_ok": bool(apex_ok),
        "ready_for_tls": ready,
        "ingress_cname": ingress_cname,
        "ingress_ip": ingress_ip,
        "www": www,
        "apex": {
            "host": apex,
            "ok": apex_ok,
            "addresses": apex_addrs,
            "expected_a": ingress_ip,
        },
        "message": message,
    }
