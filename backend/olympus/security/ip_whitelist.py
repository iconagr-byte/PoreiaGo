"""Optional admin-panel IP safelist per tenant."""

from __future__ import annotations

import ipaddress
from typing import Iterable


def ip_in_whitelist(client_ip: str | None, whitelist: Iterable[str] | None) -> bool:
    if not whitelist:
        return True
    if not client_ip:
        return False
    try:
        addr = ipaddress.ip_address(client_ip.strip())
    except ValueError:
        return False
    for entry in whitelist:
        entry = str(entry).strip()
        if not entry:
            continue
        try:
            if "/" in entry:
                if addr in ipaddress.ip_network(entry, strict=False):
                    return True
            elif addr == ipaddress.ip_address(entry):
                return True
        except ValueError:
            continue
    return False


def enforce_admin_ip_whitelist(
    client_ip: str | None,
    whitelist: list[str] | None,
    *,
    path: str,
) -> tuple[bool, str]:
    if not path.startswith("/api/v1") and not path.startswith("/api/admin"):
        return True, ""
    if not whitelist:
        return True, ""
    if ip_in_whitelist(client_ip, whitelist):
        return True, ""
    return False, "Admin access denied — IP not in tenant safelist"
