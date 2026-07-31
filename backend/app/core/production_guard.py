"""Refuse weak / misconfigured production boots.

Call ``assert_production_safe_or_raise`` from API lifespan when
ENVIRONMENT is production. Also used by predeploy_check.
"""

from __future__ import annotations

import os
from typing import Iterable

WEAK_EXACT = frozenset(
    {
        "",
        "change-me",
        "change-me-in-production",
        "change-me-olympus-dev",
        "change-me-min-32-chars-auth",
        "change-me-min-32-chars-ticket",
        "dev-jwt",
        "dev-jwt-secret-change-in-prod",
        "dev-jwt-secret-change-in-prod-32bytes!!",
        "dev-gps-key",
        "securepassword",
        "olympus_dev_pass",
    }
)

WEAK_SUBSTRINGS = (
    "change-me",
    "dev-jwt",
    "dev-gps",
    "securepassword",
    "olympus_dev",
)


def is_production_env(env: str | None = None) -> bool:
    value = (env if env is not None else os.getenv("ENVIRONMENT", "development")).strip().lower()
    return value in ("production", "prod")


def _is_weak_secret(value: str | None) -> bool:
    raw = (value or "").strip()
    if raw in WEAK_EXACT:
        return True
    lowered = raw.lower()
    return any(token in lowered for token in WEAK_SUBSTRINGS)


def _csv_keys(raw: str) -> list[str]:
    return [part.strip() for part in (raw or "").split(",") if part.strip()]


def collect_production_boot_errors(
    *,
    environ: dict[str, str] | None = None,
) -> list[str]:
    """Return human-readable errors that must block a production boot."""
    env = environ if environ is not None else os.environ
    if not is_production_env(env.get("ENVIRONMENT", "development")):
        return []

    errors: list[str] = []

    jwt_private = (env.get("AUTH_JWT_PRIVATE_KEY") or "").strip()
    jwt_public = (env.get("AUTH_JWT_PUBLIC_KEY") or "").strip()
    jwt_secret = (env.get("AUTH_JWT_SECRET") or "").strip()
    if jwt_private and jwt_public:
        pass
    elif not jwt_secret or _is_weak_secret(jwt_secret) or len(jwt_secret) < 32:
        errors.append(
            "AUTH_JWT_SECRET missing/weak (min 32 chars) or set AUTH_JWT_PRIVATE_KEY+AUTH_JWT_PUBLIC_KEY"
        )

    ticket = (env.get("TICKET_JWT_SECRET") or "").strip()
    if not ticket or _is_weak_secret(ticket) or len(ticket) < 32:
        errors.append("TICKET_JWT_SECRET missing/weak (min 32 chars)")

    if (env.get("ADMIN_AUTH_DISABLED") or "").strip().lower() in ("1", "true", "yes", "on"):
        errors.append("ADMIN_AUTH_DISABLED must be off in production")

    telemetry_keys = _csv_keys(env.get("TELEMETRY_DEVICE_KEYS") or "")
    if not telemetry_keys:
        errors.append("TELEMETRY_DEVICE_KEYS must be set in production (no empty/default)")
    elif any(_is_weak_secret(k) or k == "dev-gps-key" for k in telemetry_keys):
        errors.append("TELEMETRY_DEVICE_KEYS must not include weak/dev keys in production")

    db_url = env.get("DATABASE_URL") or ""
    if not db_url.strip():
        errors.append("DATABASE_URL is required in production")
    elif any(token in db_url for token in ("securepassword", "olympus_dev_pass", "CHANGE_ME")):
        errors.append("DATABASE_URL appears to use a default/dev password")

    if (env.get("RENT_DEMO_FLEET") or "").strip().lower() in ("1", "true", "yes", "on"):
        errors.append("RENT_DEMO_FLEET must be false/off in production")

    return errors


def collect_production_boot_warnings(
    *,
    environ: dict[str, str] | None = None,
) -> list[str]:
    env = environ if environ is not None else os.environ
    if not is_production_env(env.get("ENVIRONMENT", "development")):
        return []
    warnings: list[str] = []
    if (env.get("BILLING_DEMO_MODE") or "true").strip().lower() in ("1", "true", "yes", "on"):
        warnings.append("BILLING_DEMO_MODE=true — prefer false for live Stripe billing")
    if not (env.get("BACKUP_S3_BUCKET") or "").strip():
        warnings.append("BACKUP_S3_BUCKET unset — ensure local/S3 postgres backup cron is installed")
    return warnings


def assert_production_safe_or_raise(*, environ: dict[str, str] | None = None) -> None:
    errors = collect_production_boot_errors(environ=environ)
    if not errors:
        return
    detail = "\n".join(f"  - {msg}" for msg in errors)
    raise RuntimeError(f"Production boot refused (ENVIRONMENT=production):\n{detail}")


def merge_env_for_checks(base: Iterable[tuple[str, str]] | None = None) -> dict[str, str]:
    merged = dict(os.environ)
    if base:
        merged.update(dict(base))
    return merged
