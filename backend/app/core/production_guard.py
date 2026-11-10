"""Refuse weak / misconfigured production boots.

Call ``assert_production_safe_or_raise`` from API lifespan.
When ``REQUIRE_PRODUCTION=1`` (compose prod), refuse unless ENVIRONMENT is production.
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
    "aerostride-dev-email",
)


def is_production_env(env: str | None = None) -> bool:
    value = (env if env is not None else os.getenv("ENVIRONMENT", "development")).strip().lower()
    return value in ("production", "prod")


def require_production_flag(environ: dict[str, str] | None = None) -> bool:
    env = environ if environ is not None else os.environ
    return (env.get("REQUIRE_PRODUCTION") or "").strip().lower() in ("1", "true", "yes", "on")


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
    errors: list[str] = []

    raw_env = (env.get("ENVIRONMENT") or "").strip()
    if require_production_flag(env):
        if not raw_env:
            errors.append("ENVIRONMENT is required (set ENVIRONMENT=production)")
        elif not is_production_env(raw_env):
            errors.append(
                f"ENVIRONMENT={raw_env!r} but REQUIRE_PRODUCTION=1 — must be production/prod"
            )

    if not is_production_env(env.get("ENVIRONMENT", "development")):
        return errors

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

    email_key = (env.get("EMAIL_ENCRYPTION_KEY") or "").strip()
    if (
        not email_key
        or len(email_key) < 24
        or _is_weak_secret(email_key)
        or email_key == "aerostride-dev-email-key-change-in-production"
    ):
        errors.append("EMAIL_ENCRYPTION_KEY missing/weak (min 24 chars) for mailbox secrets")

    if (env.get("BILLING_DEMO_MODE") or "true").strip().lower() in ("1", "true", "yes", "on"):
        errors.append("BILLING_DEMO_MODE must be false in production")

    return errors


def collect_production_boot_warnings(
    *,
    environ: dict[str, str] | None = None,
) -> list[str]:
    env = environ if environ is not None else os.environ
    if not is_production_env(env.get("ENVIRONMENT", "development")):
        return []
    warnings: list[str] = []
    if not (env.get("BACKUP_S3_BUCKET") or "").strip():
        warnings.append("BACKUP_S3_BUCKET unset — ensure local/S3 postgres backup cron is installed")
    if (env.get("AADE_MODE") or "stub").strip().lower() == "stub":
        warnings.append("AADE_MODE=stub — native AADE is demo-only until live credentials")
    if (env.get("METRICS_PUBLIC") or "true").strip().lower() in ("1", "true", "yes", "on"):
        warnings.append("METRICS_PUBLIC=true — prefer restricting /metrics scrape (METRICS_TOKEN or private net)")
    if not (env.get("STRIPE_SECRET_KEY") or "").strip():
        warnings.append("STRIPE_SECRET_KEY unset — rent card checkout stays disabled (bank/cash only)")
    return warnings


def assert_production_safe_or_raise(*, environ: dict[str, str] | None = None) -> None:
    errors = collect_production_boot_errors(environ=environ)
    if not errors:
        return
    detail = "\n".join(f"  - {msg}" for msg in errors)
    raise RuntimeError(f"Production boot refused:\n{detail}")


def merge_env_for_checks(base: Iterable[tuple[str, str]] | None = None) -> dict[str, str]:
    merged = dict(os.environ)
    if base:
        merged.update(dict(base))
    return merged
