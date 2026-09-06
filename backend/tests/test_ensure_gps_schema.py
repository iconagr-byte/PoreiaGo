"""ensure_trip_coordinates_schema — idempotent GPS table bootstrap."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, MagicMock

from travel_platform.telemetry.ensure_gps_schema import ensure_trip_coordinates_schema


class EnsureGpsSchemaTests(unittest.IsolatedAsyncioTestCase):
    async def test_success_commits(self):
        session = AsyncMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        ok = await ensure_trip_coordinates_schema(session)
        self.assertTrue(ok)
        session.execute.assert_awaited()
        session.commit.assert_awaited()
        session.rollback.assert_not_awaited()

    async def test_fk_failure_falls_back(self):
        session = AsyncMock()
        session.execute = AsyncMock(side_effect=[RuntimeError("fk"), None])
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        ok = await ensure_trip_coordinates_schema(session)
        self.assertTrue(ok)
        self.assertEqual(session.execute.await_count, 2)
        self.assertEqual(session.rollback.await_count, 1)
        self.assertEqual(session.commit.await_count, 1)

    async def test_total_failure_returns_false(self):
        session = AsyncMock()
        session.execute = AsyncMock(side_effect=RuntimeError("db down"))
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        ok = await ensure_trip_coordinates_schema(session)
        self.assertFalse(ok)
        self.assertEqual(session.rollback.await_count, 2)


if __name__ == "__main__":
    unittest.main()
