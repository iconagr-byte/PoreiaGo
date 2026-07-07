"""OLYMPUS platform configuration."""

from __future__ import annotations

import os
from functools import lru_cache


@lru_cache
def get_olympus_settings() -> dict:
    return {
        "base_domain": os.getenv("OLYMPUS_BASE_DOMAIN", "poreiago.com"),
        "default_isolation": os.getenv("TENANT_ISOLATION_DEFAULT", "shared_rls"),
        "ingress_cname": os.getenv("OLYMPUS_INGRESS_CNAME", "www.poreiago.com"),
        "on_demand_tls_ask_url": os.getenv(
            "OLYMPUS_TLS_ASK_URL",
            "http://web:8000/api/v1/platform/tls/validate-domain",
        ),
        "idle_alert_minutes": int(os.getenv("OLYMPUS_IDLE_MINUTES", "5")),
        "corridor_buffer_meters": float(os.getenv("OLYMPUS_CORRIDOR_BUFFER_M", "50")),
        "impersonation_ttl_minutes": int(os.getenv("OLYMPUS_IMPERSONATION_TTL", "30")),
    }
