"""Fleet daily digest — KPI snapshot ανά tenant."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from travel_platform.telemetry.fleet_kpis_service import fetch_fleet_kpis

logger = logging.getLogger(__name__)


def fleet_digest_settings() -> dict[str, Any]:
    return {
        "enabled": os.getenv("FLEET_DIGEST_ENABLED", "true").lower() not in ("0", "false", "no"),
        "digest_hour": int(os.getenv("FLEET_DIGEST_HOUR", "19")),
        "lookback_days": int(os.getenv("FLEET_DIGEST_LOOKBACK_DAYS", "1")),
        "sms_to": os.getenv("FLEET_DIGEST_SMS_TO", "").strip(),
    }


def _read_notification_flags() -> dict[str, bool]:
    try:
        from travel_platform.settings.payment_settings_store import read_payment_settings

        security = read_payment_settings().get("security") or {}
    except Exception:
        security = {}
    return {
        "notify_email": security.get("notify_admin_fleet_digest", True) is not False,
        "notify_sms": security.get("notify_sms_fleet_digest", False) is True,
        "admin_email": str(security.get("admin_notification_email") or "").strip().lower(),
        "admin_phone": str(security.get("admin_notification_phone") or "").strip(),
    }


async def list_tenants_with_recent_gps(session: AsyncSession, *, since: datetime) -> list[str]:
    result = await session.execute(
        text(
            """
            SELECT DISTINCT tenant_id::text AS tid
            FROM trip_coordinates
            WHERE recorded_at >= :since
            ORDER BY 1
            """,
        ),
        {"since": since},
    )
    return [str(row[0]) for row in result.fetchall()]


async def collect_fleet_digest(
    session: AsyncSession,
    *,
    tenant_id: UUID,
    lookback_days: int = 1,
) -> dict[str, Any]:
    days = max(1, int(lookback_days))
    from_time = datetime.now(timezone.utc) - timedelta(days=days)
    kpis = await fetch_fleet_kpis(session, tenant_id=tenant_id, from_time=from_time, days=0)
    kpis["digest_period_days"] = days
    return kpis


async def collect_all_fleet_digests(
    session: AsyncSession,
    *,
    lookback_days: int | None = None,
) -> list[dict[str, Any]]:
    cfg = fleet_digest_settings()
    days = lookback_days if lookback_days is not None else int(cfg["lookback_days"])
    since = datetime.now(timezone.utc) - timedelta(days=max(1, days))
    tenant_ids = await list_tenants_with_recent_gps(session, since=since)
    digests: list[dict[str, Any]] = []
    for tid in tenant_ids:
        try:
            digests.append(await collect_fleet_digest(session, tenant_id=UUID(tid), lookback_days=days))
        except Exception:
            logger.exception("Fleet digest collect failed tenant=%s", tid)
    return digests


def admin_recipients() -> dict[str, str]:
    flags = _read_notification_flags()
    cfg = fleet_digest_settings()
    phone = flags["admin_phone"] or cfg["sms_to"]
    return {
        "email": flags["admin_email"] if flags["notify_email"] else "",
        "phone": phone if flags["notify_sms"] else "",
    }
