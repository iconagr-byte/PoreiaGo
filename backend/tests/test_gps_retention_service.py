"""Tests for GPS retention policy."""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4


class GpsRetentionServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_purge_skipped_when_retention_zero(self) -> None:
        from travel_platform.telemetry.gps_retention_service import purge_tenant_gps

        session = AsyncMock()
        deleted = await purge_tenant_gps(session, tenant_id=str(uuid4()), retention_days=0)
        self.assertEqual(deleted, 0)
        session.execute.assert_not_called()

    async def test_purge_executes_delete(self) -> None:
        from travel_platform.telemetry.gps_retention_service import purge_tenant_gps

        tid = str(uuid4())
        session = AsyncMock()
        result = MagicMock()
        result.rowcount = 42
        session.execute = AsyncMock(return_value=result)

        deleted = await purge_tenant_gps(session, tenant_id=tid, retention_days=30)
        self.assertEqual(deleted, 42)
        session.execute.assert_awaited_once()
        params = session.execute.await_args.args[1]
        self.assertEqual(params["tenant_id"], tid)
        cutoff = params["cutoff"]
        self.assertIsInstance(cutoff, datetime)
        self.assertLess(cutoff, datetime.now(timezone.utc))

    async def test_purge_uses_tenant_settings_when_days_omitted(self) -> None:
        from travel_platform.telemetry.gps_retention_service import purge_tenant_gps
        from travel_platform.telemetry.settings_store import update_telemetry_settings

        tid = str(uuid4())
        update_telemetry_settings({"gps_retention_days": 14}, tenant_id=tid)

        session = AsyncMock()
        result = MagicMock()
        result.rowcount = 3
        session.execute = AsyncMock(return_value=result)

        deleted = await purge_tenant_gps(session, tenant_id=tid)
        self.assertEqual(deleted, 3)
        cutoff = session.execute.await_args.args[1]["cutoff"]
        expected = datetime.now(timezone.utc) - timedelta(days=14)
        self.assertAlmostEqual(cutoff.timestamp(), expected.timestamp(), delta=5)

    async def test_list_tenants_with_coordinates(self) -> None:
        from travel_platform.telemetry.gps_retention_service import list_tenants_with_coordinates

        session = AsyncMock()
        result = MagicMock()
        result.fetchall.return_value = [(str(uuid4()),), (str(uuid4()),)]
        session.execute = AsyncMock(return_value=result)

        tenants = await list_tenants_with_coordinates(session)
        self.assertEqual(len(tenants), 2)


class GpsRetentionSettingsTests(unittest.TestCase):
    def test_gps_retention_days_in_defaults(self) -> None:
        from travel_platform.telemetry.settings_store import get_telemetry_settings

        settings = get_telemetry_settings()
        self.assertEqual(settings.gps_retention_days, 90)


if __name__ == "__main__":
    unittest.main()
