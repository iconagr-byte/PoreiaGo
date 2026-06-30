#!/usr/bin/env python3
"""
OLYMPUS pre-deploy gate — env validation, migrations, tests, smoke HTTP.

Examples:
  cd backend && python -m scripts.predeploy_check
  cd backend && python -m scripts.predeploy_check --env-file ../deploy/.env.olympus.prod --migrate
  cd backend && python -m scripts.predeploy_check --api-base https://api.olympus-saas.com --strict
"""

from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent

WEAK_SECRETS = frozenset({
    "",
    "change-me-in-production",
    "change-me-olympus-dev",
    "dev-jwt-secret-change-in-prod",
    "securepassword",
    "olympus_dev_pass",
})

REQUIRED_PROD = (
    "ENVIRONMENT",
    "DATABASE_URL",
    "REDIS_URL",
    "CELERY_BROKER_URL",
)

RECOMMENDED_PROD = (
    "AUTH_JWT_PRIVATE_KEY",
    "AUTH_JWT_PUBLIC_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "BACKUP_S3_BUCKET",
    "ACME_EMAIL",
    "OLYMPUS_BASE_DOMAIN",
)


class CheckResult:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.ok: list[str] = []

    def fail(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def pass_(self, msg: str) -> None:
        self.ok.append(msg)

    @property
    def success(self) -> bool:
        return not self.errors


def load_env_file(path: Path) -> None:
    if not path.is_file():
        raise FileNotFoundError(f"Env file not found: {path}")
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def validate_environment(result: CheckResult, *, strict: bool) -> None:
    env = os.getenv("ENVIRONMENT", "development").lower()
    is_prod = env in ("production", "prod")

    if is_prod:
        for key in REQUIRED_PROD:
            val = os.getenv(key, "").strip()
            if not val:
                result.fail(f"Missing required env: {key}")
            else:
                result.pass_(f"{key} is set")

        if os.getenv("TENANT_DEDICATED_DB_AUTO_PROVISION", "0").lower() in ("1", "true", "yes"):
            result.fail("TENANT_DEDICATED_DB_AUTO_PROVISION must be 0 in production")

        jwt_private = os.getenv("AUTH_JWT_PRIVATE_KEY", "").strip()
        jwt_public = os.getenv("AUTH_JWT_PUBLIC_KEY", "").strip()
        jwt_secret = os.getenv("AUTH_JWT_SECRET", "").strip()

        if jwt_private and jwt_public:
            result.pass_("JWT RS256 keys configured")
        elif jwt_secret and jwt_secret not in WEAK_SECRETS:
            result.warn("Using HS256 AUTH_JWT_SECRET — prefer RS256 in production")
            if strict:
                result.fail("Strict mode: RS256 keys required")
        else:
            msg = "Configure AUTH_JWT_PRIVATE_KEY + AUTH_JWT_PUBLIC_KEY (or strong AUTH_JWT_SECRET)"
            if strict:
                result.fail(msg)
            else:
                result.warn(msg)

        db_url = os.getenv("DATABASE_URL", "")
        if "securepassword" in db_url or "olympus_dev_pass" in db_url:
            result.fail("DATABASE_URL appears to use a default dev password")

        for key in RECOMMENDED_PROD:
            if not os.getenv(key, "").strip():
                msg = f"Recommended env missing: {key}"
                if strict:
                    result.fail(msg)
                else:
                    result.warn(msg)
    else:
        result.pass_(f"ENVIRONMENT={env} (skipping strict production checks)")


async def check_postgres(result: CheckResult) -> None:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url or "sqlite" in url.lower():
        result.warn("DATABASE_URL not Postgres — skipping DB ping")
        return
    try:
        from sqlalchemy import text
        from sqlalchemy.ext.asyncio import create_async_engine

        engine = create_async_engine(url, pool_pre_ping=True)
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        await engine.dispose()
        result.pass_("Postgres connectivity OK")
    except Exception as exc:
        result.fail(f"Postgres connectivity failed: {exc}")


async def check_redis(result: CheckResult) -> None:
    url = os.getenv("REDIS_URL", "").strip()
    if not url:
        result.warn("REDIS_URL not set — skipping Redis ping")
        return
    try:
        import redis.asyncio as aioredis

        client = aioredis.from_url(url, decode_responses=True)
        pong = await client.ping()
        await client.aclose()
        if pong:
            result.pass_("Redis connectivity OK")
        else:
            result.fail("Redis PING failed")
    except Exception as exc:
        result.fail(f"Redis connectivity failed: {exc}")


def _alembic_command(*args: str) -> list[str]:
    import shutil

    exe = shutil.which("alembic")
    if exe:
        return [exe, *args]
    scripts = Path(sys.executable).resolve().parent / "Scripts" / "alembic.exe"
    if scripts.is_file():
        return [str(scripts), *args]
    return [sys.executable, "-m", "alembic", *args]


def run_migrations(result: CheckResult) -> None:
    proc = subprocess.run(
        _alembic_command("upgrade", "head"),
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        result.fail(f"alembic upgrade head failed:\n{proc.stderr or proc.stdout}")
    else:
        result.pass_("Alembic migrations at head")


def run_unit_tests(result: CheckResult) -> None:
    modules = [
        "tests.test_olympus_isolation",
        "tests.test_olympus_phase3",
        "tests.test_signup_provisioning",
    ]
    proc = subprocess.run(
        [sys.executable, "-m", "unittest", *modules, "-v"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        detail = proc.stderr or proc.stdout
        result.fail(f"OLYMPUS unit tests failed:\n{detail[-2000:]}")
    else:
        result.pass_("OLYMPUS unit tests OK")


def smoke_http(result: CheckResult, api_base: str) -> None:
    base = api_base.rstrip("/")
    paths = ("/api/v1/health", "/health")
    any_ok = False
    for path in paths:
        url = f"{base}{path}"
        try:
            req = Request(url, headers={"Accept": "application/json"})
            with urlopen(req, timeout=15) as resp:
                body = resp.read(512).decode("utf-8", errors="replace")
            if resp.status != 200:
                result.warn(f"Smoke GET {path} -> HTTP {resp.status}")
                continue
            lowered = body.lower()
            if "ok" in lowered or "healthy" in lowered:
                result.pass_(f"Smoke GET {path} OK")
                any_ok = True
            else:
                result.warn(f"Smoke GET {path} -> 200 but unexpected body: {body[:120]}")
        except HTTPError as exc:
            if exc.code == 404 and path == "/health":
                result.warn(f"Smoke GET {path} -> HTTP 404 (optional legacy route)")
            else:
                result.fail(f"Smoke GET {path} -> HTTP {exc.code}")
        except URLError as exc:
            result.fail(f"Smoke GET {path} failed: {exc.reason}")
    if not any_ok:
        result.fail("No successful health endpoint (/api/v1/health or /health)")


def print_report(result: CheckResult) -> None:
    print("\n=== OLYMPUS pre-deploy report ===\n")
    for line in result.ok:
        print(f"  [OK]   {line}")
    for line in result.warnings:
        print(f"  [WARN] {line}")
    for line in result.errors:
        print(f"  [FAIL] {line}")
    print()
    if result.success:
        print("Result: PASS")
    else:
        print(f"Result: FAIL ({len(result.errors)} error(s))")


async def main_async(args: argparse.Namespace) -> int:
    result = CheckResult()

    if args.env_file:
        load_env_file(Path(args.env_file))
        result.pass_(f"Loaded env file: {args.env_file}")

    validate_environment(result, strict=args.strict)

    if args.migrate:
        run_migrations(result)

    if not args.skip_tests:
        run_unit_tests(result)

    if not args.skip_connectivity:
        await check_postgres(result)
        await check_redis(result)

    if args.api_base:
        smoke_http(result, args.api_base)

    print_report(result)
    return 0 if result.success else 1


def main() -> None:
    parser = argparse.ArgumentParser(description="OLYMPUS pre-deploy validation gate")
    parser.add_argument(
        "--env-file",
        help="Path to .env (e.g. deploy/.env.olympus.prod)",
    )
    parser.add_argument(
        "--migrate",
        action="store_true",
        help="Run alembic upgrade head before checks",
    )
    parser.add_argument(
        "--api-base",
        help="Smoke-test API base URL (e.g. https://api.olympus-saas.com)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat missing recommended prod vars as errors",
    )
    parser.add_argument(
        "--skip-tests",
        action="store_true",
        help="Skip unittest discovery",
    )
    parser.add_argument(
        "--skip-connectivity",
        action="store_true",
        help="Skip Postgres/Redis ping",
    )
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()
