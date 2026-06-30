"""Collect fiscal pipeline issues for admin email alerts."""

from __future__ import annotations

import logging
import os
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_deps import apply_tenant_rls
from app.models.tenant import Tenant
from app.services.fiscal_reconciliation_service import FiscalReconciliationService
from app.services.fiscal_stats_service import FiscalStatsService

logger = logging.getLogger(__name__)


def fiscal_alert_settings() -> dict[str, bool | int]:
    def _env_int(name: str, default: int) -> int:
        raw = os.getenv(name, "").strip()
        if not raw:
            return default
        try:
            return int(raw)
        except ValueError:
            return default

    return {
        "enabled": os.getenv("FISCAL_ALERT_ENABLED", "true").lower() not in ("0", "false", "no"),
        "digest_hour": _env_int("FISCAL_ALERT_DIGEST_HOUR", 8),
        "immediate_cooldown_minutes": _env_int("FISCAL_ALERT_IMMEDIATE_COOLDOWN_MINUTES", 60),
        "reconciliation_days": _env_int("FISCAL_ALERT_RECONCILIATION_DAYS", 7),
    }


def snapshot_has_issues(snapshot: dict[str, Any]) -> bool:
    totals = snapshot.get("totals") or {}
    return any(
        int(totals.get(key, 0) or 0) > 0
        for key in ("failed", "open", "stuck_candidates", "reconciliation_gaps")
    )


class FiscalAlertService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def collect_snapshot(self) -> dict[str, Any]:
        active = await self._session.execute(
            select(Tenant.id).where(Tenant.is_active.is_(True)),
        )
        tenant_ids = [row[0] for row in active.all() if row[0]]

        recon_days = int(fiscal_alert_settings()["reconciliation_days"])
        items: list[dict[str, Any]] = []

        for tenant_id in tenant_ids:
            row = await self._tenant_row(tenant_id, recon_days=recon_days)
            if row:
                items.append(row)

        totals = {
            "failed": sum(int(r.get("failed", 0)) for r in items),
            "open": sum(int(r.get("open", 0)) for r in items),
            "stuck_candidates": sum(int(r.get("stuck_candidates", 0)) for r in items),
            "reconciliation_gaps": sum(int(r.get("reconciliation_gaps", 0)) for r in items),
        }
        return {
            "tenants": items,
            "totals": totals,
            "has_issues": snapshot_has_issues({"totals": totals}),
        }

    async def _tenant_row(self, tenant_id: UUID, *, recon_days: int) -> dict[str, Any] | None:
        await apply_tenant_rls(self._session, tenant_id)
        tenant_result = await self._session.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            return None

        stats = await FiscalStatsService(self._session).get_summary(tenant_id, days=30)
        recon = await FiscalReconciliationService(self._session).run(
            tenant_id,
            days=recon_days,
            only_gaps=True,
            limit=500,
        )

        failed = int(stats.get("failed", 0) or 0)
        open_count = int(stats.get("open", 0) or 0)
        stuck = int(stats.get("stuck_candidates", 0) or 0)
        gaps = int(recon.get("with_gaps", 0) or 0) + int(recon.get("failed", 0) or 0)

        if failed == 0 and open_count == 0 and stuck == 0 and gaps == 0:
            return None

        return {
            "tenant_id": str(tenant_id),
            "slug": tenant.slug,
            "name": tenant.legal_name,
            "health": stats.get("health", "unknown"),
            "failed": failed,
            "pending": int(stats.get("pending", 0) or 0),
            "queued": int(stats.get("queued", 0) or 0),
            "open": open_count,
            "stuck_candidates": stuck,
            "reconciliation_gaps": gaps,
            "oldest_open_minutes": stats.get("oldest_open_minutes"),
        }
