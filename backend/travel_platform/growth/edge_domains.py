"""Unified custom-domain edge sync (Traefik and/or NPM + nginx apex→www)."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


async def load_active_custom_domains(session) -> list[str]:
    from sqlalchemy import select

    from app.models.tenant import Tenant

    result = await session.execute(
        select(Tenant.custom_domain).where(
            Tenant.is_active.is_(True),
            Tenant.custom_domain.is_not(None),
            Tenant.custom_domain != "",
        )
    )
    return [row[0] for row in result.all() if row[0]]


async def sync_edge_custom_domains_from_db(
    session,
    *,
    provision_npm: bool = True,
) -> dict[str, Any]:
    """
    After a custom_domain save (or API boot):

    1. Refresh Traefik custom-domains.yml (no-op when TRAEFIK_DYNAMIC_DIR unset / NPM edge)
    2. Rewrite nginx apex→www map (generic Achillio-style redirect for every office)
    3. Optionally upsert NPM proxy + redirection hosts when EDGE_PROXY=npm + credentials
    """
    domains = await load_active_custom_domains(session)
    out: dict[str, Any] = {
        "domains": domains,
        "traefik": None,
        "nginx_map": None,
        "npm": [],
    }

    try:
        from travel_platform.growth.traefik_domains import write_custom_domains_file

        if domains:
            path = write_custom_domains_file(domains, include_apex=None)
            out["traefik"] = str(path) if path else None
        else:
            out["traefik"] = "skipped_empty"
    except Exception:
        logger.debug("Traefik custom-domain sync skipped", exc_info=True)

    try:
        from travel_platform.growth.nginx_apex_redirect import write_apex_www_redirect_map

        path = write_apex_www_redirect_map(domains)
        out["nginx_map"] = str(path) if path else None
    except Exception:
        logger.debug("nginx apex→www map sync skipped", exc_info=True)

    if provision_npm and domains:
        try:
            from travel_platform.growth.npm_domains import sync_npm_custom_domains

            out["npm"] = await sync_npm_custom_domains(domains)
        except Exception:
            logger.debug("NPM custom-domain sync skipped", exc_info=True)

    return out
