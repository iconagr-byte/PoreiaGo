"""Scheduled automatic retry for failed fiscal receipts."""

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
from app.services.fiscal_retry_service import FiscalRetryService

logger = logging.getLogger(__name__)


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def fiscal_auto_retry_settings() -> dict[str, int | bool]:
    return {
        "enabled": os.getenv("FISCAL_AUTO_RETRY_ENABLED", "true").lower() not in ("0", "false", "no"),
        "max_retries": _env_int("FISCAL_AUTO_RETRY_MAX", 3),
        "cooldown_minutes": _env_int("FISCAL_AUTO_RETRY_COOLDOWN_MINUTES", 30),
        "batch_limit": _env_int("FISCAL_AUTO_RETRY_BATCH_LIMIT", 25),
    }


class FiscalAutoRetryService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        max_retries: int = 3,
        cooldown_minutes: int = 30,
        batch_limit: int = 25,
    ) -> None:
        self._session = session
        self._max_retries = max(1, max_retries)
        self._cooldown_minutes = max(5, cooldown_minutes)
        self._batch_limit = max(1, min(batch_limit, 100))

    async def run_all_tenants(self) -> dict[str, Any]:
        tenant_rows = await self._session.execute(
            select(distinct(FiscalInvoice.tenant_id)).where(
                FiscalInvoice.status == FiscalInvoiceStatus.FAILED,
            ),
        )
        tenant_ids = [row[0] for row in tenant_rows.all() if row[0]]

        totals = {
            "tenants": len(tenant_ids),
            "candidates": 0,
            "retried": 0,
            "skipped": 0,
            "errors": 0,
        }
        for tenant_id in tenant_ids:
            partial = await self.run_for_tenant(tenant_id)
            for key in ("candidates", "retried", "skipped", "errors"):
                totals[key] += int(partial.get(key, 0))

        logger.info("Fiscal auto-retry complete: %s", totals)
        return totals

    async def run_for_tenant(self, tenant_id: UUID) -> dict[str, int]:
        await apply_tenant_rls(self._session, tenant_id)
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=self._cooldown_minutes)

        result = await self._session.execute(
            select(FiscalInvoice)
            .where(
                FiscalInvoice.tenant_id == tenant_id,
                FiscalInvoice.status == FiscalInvoiceStatus.FAILED,
                FiscalInvoice.updated_at <= cutoff,
            )
            .order_by(FiscalInvoice.updated_at)
            .limit(self._batch_limit),
        )
        invoices = list(result.scalars().all())

        stats = {"candidates": len(invoices), "retried": 0, "skipped": 0, "errors": 0}
        if not invoices:
            return stats

        retry_svc = FiscalRetryService(self._session)
        now_iso = datetime.now(timezone.utc).isoformat()

        for invoice in invoices:
            meta = dict(invoice.metadata_json or {})
            auto_retries = int(meta.get("auto_retry_count") or 0)
            if auto_retries >= self._max_retries:
                stats["skipped"] += 1
                continue

            invoice.metadata_json = {
                **meta,
                "auto_retry_count": auto_retries + 1,
                "last_auto_retry_at": now_iso,
            }
            await self._session.flush()

            try:
                await retry_svc.retry_invoice(
                    tenant_id=tenant_id,
                    invoice_id=invoice.id,
                    trigger="auto",
                )
                stats["retried"] += 1
            except Exception:
                stats["errors"] += 1
                logger.exception(
                    "Fiscal auto-retry failed tenant=%s invoice=%s",
                    tenant_id,
                    invoice.id,
                )

        return stats
