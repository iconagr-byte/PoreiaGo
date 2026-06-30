#!/usr/bin/env python3
"""
Fiscal pipeline smoke check — Redis, env, DB invoice counts, optional API.

Examples:
  cd backend && python -m scripts.fiscal_pipeline_smoke
  cd backend && python -m scripts.fiscal_pipeline_smoke --tenant-slug achillio
  cd backend && python -m scripts.fiscal_pipeline_smoke --api-base http://127.0.0.1:8010 --token "$SAAS_TOKEN"
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BACKEND_ROOT = Path(__file__).resolve().parents[1]


class SmokeResult:
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
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def check_redis(result: SmokeResult) -> None:
    broker = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0").strip()
    if not broker.startswith("redis://"):
        result.warn(f"CELERY_BROKER_URL is not redis: {broker}")
        return
    try:
        import redis

        client = redis.from_url(broker, socket_connect_timeout=3)
        client.ping()
        result.pass_(f"Redis reachable ({broker})")
    except ImportError:
        result.warn("redis package not installed — skipping broker ping")
    except Exception as exc:
        result.fail(f"Redis unreachable ({broker}): {exc}")


def check_fiscal_env(result: SmokeResult) -> None:
    from app.services.fiscal_auto_retry_service import fiscal_auto_retry_settings
    from app.services.fiscal_stuck_recovery_service import fiscal_stuck_recovery_settings

    auto = fiscal_auto_retry_settings()
    stuck = fiscal_stuck_recovery_settings()
    result.pass_(
        "Auto-retry: "
        f"enabled={auto['enabled']} max={auto['max_retries']} cooldown={auto['cooldown_minutes']}m",
    )
    result.pass_(
        "Stuck recovery: "
        f"enabled={stuck['enabled']} after={stuck['stuck_minutes']}m batch={stuck['batch_limit']}",
    )

    aade_mode = os.getenv("AADE_MODE", "stub")
    if aade_mode in ("stub", "dev"):
        result.warn(f"AADE_MODE={aade_mode} — production receipts will not hit live myDATA")
    else:
        result.pass_(f"AADE_MODE={aade_mode}")

    if not os.getenv("FISCAL_ENCRYPTION_KEY", "").strip():
        result.warn("FISCAL_ENCRYPTION_KEY not set — tenant provider secrets may not persist encrypted")

    stripe = os.getenv("STRIPE_CHECKOUT_WEBHOOK_SECRET") or os.getenv("STRIPE_WEBHOOK_SECRET")
    if stripe:
        result.pass_("Stripe webhook secret configured")
    else:
        result.warn("No STRIPE_CHECKOUT_WEBHOOK_SECRET — card capture webhook may fail")


async def check_database(result: SmokeResult, *, tenant_slug: str | None) -> None:
    db_url = os.getenv("DATABASE_URL", "").strip()
    if not db_url:
        result.warn("DATABASE_URL not set — skipping DB fiscal counts")
        return

    try:
        from sqlalchemy import func, select

        from app.core.database import AsyncSessionLocal
        from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceStatus
        from app.models.tenant import Tenant
        from app.services.fiscal_stats_service import FiscalStatsService
    except Exception as exc:
        result.warn(f"DB imports failed: {exc}")
        return

    try:
        async with AsyncSessionLocal() as session:
            tenant_id = None
            if tenant_slug:
                row = await session.execute(select(Tenant).where(Tenant.slug == tenant_slug))
                tenant = row.scalar_one_or_none()
                if not tenant:
                    result.fail(f"Tenant slug not found: {tenant_slug}")
                    return
                tenant_id = tenant.id
                result.pass_(f"Tenant: {tenant_slug} ({tenant_id})")

            filters = [FiscalInvoice.tenant_id == tenant_id] if tenant_id else []

            async def _count(status: FiscalInvoiceStatus) -> int:
                q = select(func.count()).select_from(FiscalInvoice).where(
                    FiscalInvoice.status == status,
                    *filters,
                )
                return int((await session.execute(q)).scalar() or 0)

            issued = await _count(FiscalInvoiceStatus.ISSUED)
            failed = await _count(FiscalInvoiceStatus.FAILED)
            pending = await _count(FiscalInvoiceStatus.PENDING)
            queued = await _count(FiscalInvoiceStatus.QUEUED)
            result.pass_(
                f"Fiscal invoices — issued={issued} failed={failed} pending={pending} queued={queued}",
            )

            if failed > 0:
                result.warn(f"{failed} FAILED invoice(s) — check reconciliation or auto-retry")
            if pending + queued > 0:
                result.warn(f"{pending + queued} open invoice(s) — ensure celery-worker is running")

            if tenant_id:
                stats = await FiscalStatsService(session).get_summary(tenant_id, days=30)
                health = stats.get("health", "unknown")
                stuck = int(stats.get("stuck_candidates") or 0)
                result.pass_(f"Pipeline health: {health}")
                if stuck > 0:
                    result.warn(f"Stuck candidates: {stuck}")
    except Exception as exc:
        result.fail(f"Database check failed: {exc}")


def check_api(result: SmokeResult, *, api_base: str, token: str | None) -> None:
    base = api_base.rstrip("/")
    health_paths = ("/health", "/api/v1/health")
    health_body: dict | None = None
    for path in health_paths:
        try:
            with urlopen(f"{base}{path}", timeout=5) as resp:
                if resp.status not in (200, 503):
                    continue
                import json

                health_body = json.loads(resp.read().decode("utf-8"))
                overall = health_body.get("status", "unknown")
                result.pass_(f"API health {path} -> {overall}")
                redis = (health_body.get("redis") or {}).get("status")
                if redis == "fail":
                    result.warn(f"Health reports Redis fail ({path})")
                fiscal = health_body.get("fiscal")
                if isinstance(fiscal, dict):
                    result.pass_(
                        f"Fiscal health: {fiscal.get('health')} "
                        f"(failed={fiscal.get('failed')} stuck={fiscal.get('stuck_candidates')})",
                    )
                    if fiscal.get("health") == "degraded":
                        result.warn("Fiscal pipeline degraded per /health")
                break
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
            continue
    else:
        result.fail(f"API health failed at {base}")
        return

    try:
        with urlopen(f"{base}/metrics", timeout=5) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            if resp.status == 200 and "fiscal_invoices" in body:
                result.pass_("Prometheus /metrics exposes fiscal_* metrics")
            elif resp.status == 404:
                result.warn("Metrics disabled (METRICS_ENABLED=false)")
            else:
                result.warn(f"/metrics returned {resp.status}")
    except (HTTPError, URLError, TimeoutError):
        result.warn("/metrics not reachable (optional)")

    if not token:
        if not isinstance(health_body, dict) or "fiscal" not in health_body:
            result.warn("No --token — fiscal-stats API check skipped (use /health fiscal block)")
        return

    try:
        req = Request(
            f"{base}/api/admin/platform/fiscal-stats?days=7",
            headers={"Authorization": f"Bearer {token}"},
        )
        with urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        result.pass_(
            f"fiscal-stats API: health={data.get('health')} issued={data.get('issued')} failed={data.get('failed')}",
        )
    except HTTPError as exc:
        result.fail(f"fiscal-stats API HTTP {exc.code}")
    except (URLError, TimeoutError) as exc:
        result.fail(f"fiscal-stats API unreachable: {exc}")


def print_report(result: SmokeResult) -> None:
    print("=== Fiscal pipeline smoke ===\n")
    for line in result.ok:
        print(f"  OK   {line}")
    for line in result.warnings:
        print(f"  WARN {line}")
    for line in result.errors:
        print(f"  FAIL {line}")
    print()
    if result.success:
        print("Result: PASS")
    else:
        print("Result: FAIL")


def main() -> int:
    parser = argparse.ArgumentParser(description="Fiscal pipeline smoke check")
    parser.add_argument("--env-file", type=Path, default=BACKEND_ROOT / ".env")
    parser.add_argument("--tenant-slug", default=os.getenv("DEFAULT_TENANT_SLUG", "achillio"))
    parser.add_argument("--api-base", default="")
    parser.add_argument("--token", default=os.getenv("SAAS_TOKEN", ""))
    parser.add_argument("--no-db", action="store_true")
    args = parser.parse_args()

    if str(BACKEND_ROOT) not in sys.path:
        sys.path.insert(0, str(BACKEND_ROOT))

    load_env_file(args.env_file)
    result = SmokeResult()

    check_redis(result)
    check_fiscal_env(result)

    if not args.no_db:
        asyncio.run(check_database(result, tenant_slug=args.tenant_slug or None))

    if args.api_base:
        check_api(result, api_base=args.api_base, token=args.token or None)

    print_report(result)
    return 0 if result.success else 1


if __name__ == "__main__":
    raise SystemExit(main())
