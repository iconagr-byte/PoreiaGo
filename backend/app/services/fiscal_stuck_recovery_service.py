"""Re-dispatch fiscal pipeline for invoices stuck in pending/queued."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import distinct, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_deps import apply_tenant_rls
from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceStatus
from app.services.payment_dispatch import dispatch_fiscal_receipt

logger = logging.getLogger(__name__)


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def fiscal_stuck_recovery_settings() -> dict[str, int | bool]:
    return {
        "enabled": os.getenv("FISCAL_STUCK_RECOVERY_ENABLED", "true").lower() not in ("0", "false", "no"),
        "stuck_minutes": _env_int("FISCAL_STUCK_MINUTES", 45),
        "batch_limit": _env_int("FISCAL_STUCK_BATCH_LIMIT", 30),
    }


class FiscalStuckRecoveryService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        stuck_minutes: int = 45,
        batch_limit: int = 30,
    ) -> None:
        self._session = session
        self._stuck_minutes = max(10, stuck_minutes)
        self._batch_limit = max(1, min(batch_limit, 100))

    async def run_all_tenants(self) -> dict[str, Any]:
        tenant_rows = await self._session.execute(
            select(distinct(FiscalInvoice.tenant_id)).where(
                FiscalInvoice.status.in_(
                    (FiscalInvoiceStatus.PENDING, FiscalInvoiceStatus.QUEUED),
                ),
            ),
        )
        tenant_ids = [row[0] for row in tenant_rows.all() if row[0]]

        totals = {"tenants": len(tenant_ids), "candidates": 0, "redispatched": 0}
        for tenant_id in tenant_ids:
            partial = await self.run_for_tenant(tenant_id)
            totals["candidates"] += int(partial.get("candidates", 0))
            totals["redispatched"] += int(partial.get("redispatched", 0))

        logger.info("Fiscal stuck recovery complete: %s", totals)
        return totals

    async def run_for_tenant(self, tenant_id: UUID) -> dict[str, int]:
        await apply_tenant_rls(self._session, tenant_id)
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=self._stuck_minutes)

        result = await self._session.execute(
            select(FiscalInvoice)
            .where(
                FiscalInvoice.tenant_id == tenant_id,
                FiscalInvoice.status.in_(
                    (FiscalInvoiceStatus.PENDING, FiscalInvoiceStatus.QUEUED),
                ),
                FiscalInvoice.updated_at <= cutoff,
            )
            .order_by(FiscalInvoice.updated_at)
            .limit(self._batch_limit),
        )
        invoices = list(result.scalars().all())
        stats = {"candidates": len(invoices), "redispatched": 0}

        for invoice in invoices:
            meta = dict(invoice.metadata_json or {})
            invoice.metadata_json = {
                **meta,
                "stuck_recovery_at": datetime.now(timezone.utc).isoformat(),
            }
            await self._session.flush()
            dispatch_fiscal_receipt(str(invoice.id))
            stats["redispatched"] += 1

        return stats
