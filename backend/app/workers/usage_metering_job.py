"""
Scheduled usage metering — snapshots + Stripe metered reporting.

Run once manually:
    python -m app.workers.usage_metering_job

Celery beat (via workers/celery_app.py):
    workers.tasks.report_stripe_usage_all_tenants
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


async def run_usage_metering(*, stripe_only: bool = True) -> dict:
    from app.core.config import get_settings
    from app.core.database import AsyncSessionLocal
    from app.services.billing_service import BillingService

    settings = get_settings()
    if not settings.usage_metering_enabled:
        logger.info("Usage metering disabled (USAGE_METERING_ENABLED=0)")
        return {"skipped": True, "reason": "disabled"}

    async with AsyncSessionLocal() as session:
        stats = await BillingService(session).report_usage_for_all_tenants(stripe_only=stripe_only)
        await session.commit()
    logger.info("Usage metering complete: %s", stats)
    return stats


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    stripe_only = os.getenv("USAGE_METERING_STRIPE_ONLY", "1").lower() not in ("0", "false", "no")
    result = asyncio.run(run_usage_metering(stripe_only=stripe_only))
    print(result)


if __name__ == "__main__":
    main()
