"""ensure_bookings_schema — idempotent Contabo drift repair for cash capture."""

from __future__ import annotations

import unittest
from unittest import mock
from unittest.mock import AsyncMock, MagicMock

from app.services.ensure_bookings_schema import (
    ensure_bookings_schema,
    is_bookings_schema_drift_error,
    reset_bookings_schema_heal_flag,
)


class EnsureBookingsSchemaTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        reset_bookings_schema_heal_flag()

    async def test_success_commits_and_memoizes(self):
        session = AsyncMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        ok = await ensure_bookings_schema(session)
        self.assertTrue(ok)
        session.execute.assert_awaited()
        session.commit.assert_awaited()
        # Second call skips DDL.
        session.execute.reset_mock()
        ok2 = await ensure_bookings_schema(session)
        self.assertTrue(ok2)
        session.execute.assert_not_awaited()

    async def test_force_reruns_after_memoize(self):
        session = AsyncMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        await ensure_bookings_schema(session)
        session.execute.reset_mock()
        ok = await ensure_bookings_schema(session, force=True)
        self.assertTrue(ok)
        session.execute.assert_awaited()

    async def test_failure_rolls_back(self):
        session = AsyncMock()
        session.execute = AsyncMock(side_effect=RuntimeError("db down"))
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        ok = await ensure_bookings_schema(session)
        self.assertFalse(ok)
        session.rollback.assert_awaited()
        session.commit.assert_not_awaited()

    def test_detects_customer_user_id_drift(self):
        exc = Exception(
            "ProgrammingError: column bookings.customer_user_id does not exist"
        )
        self.assertTrue(is_bookings_schema_drift_error(exc))

    def test_detects_updated_at_drift(self):
        exc = Exception(
            "UndefinedColumnError: column bookings.updated_at does not exist "
            'HINT: Perhaps you meant to reference the column "bookings.created_at".'
        )
        self.assertTrue(is_bookings_schema_drift_error(exc))

    def test_heal_sql_includes_updated_at(self):
        from app.services.ensure_bookings_schema import _HEAL_STATEMENTS

        blob = "\n".join(_HEAL_STATEMENTS)
        self.assertIn("updated_at", blob)
        self.assertIn("created_at", blob)

    def test_ignores_unrelated_errors(self):
        self.assertFalse(is_bookings_schema_drift_error(RuntimeError("timeout")))


class FindBookingHealTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        reset_bookings_schema_heal_flag()

    async def test_find_booking_heals_and_retries(self):
        from uuid import uuid4

        from api.admin_bookings_router import _find_booking

        tenant_id = uuid4()
        booking = MagicMock()
        session = AsyncMock()
        drift = Exception(
            "<class 'asyncpg.exceptions.UndefinedColumnError'>: "
            "column bookings.customer_user_id does not exist"
        )
        ok_result = MagicMock()
        ok_result.scalar_one_or_none.return_value = booking
        calls = {"n": 0}

        async def _execute(*_a, **_k):
            calls["n"] += 1
            if calls["n"] == 1:
                raise drift
            # Heal DDL statements + retried SELECT all succeed.
            return ok_result

        session.execute = AsyncMock(side_effect=_execute)
        session.rollback = AsyncMock()
        session.commit = AsyncMock()

        with mock.patch(
            "app.core.auth_deps.apply_tenant_rls",
            new_callable=AsyncMock,
        ) as rls:
            found = await _find_booking(session, tenant_id, "BK-1789055171012")

        self.assertIs(found, booking)
        self.assertEqual(session.rollback.await_count, 1)
        # 1 failed SELECT + N heal statements + 1 retry SELECT
        self.assertGreaterEqual(session.execute.await_count, 3)
        rls.assert_awaited()


if __name__ == "__main__":
    unittest.main()
