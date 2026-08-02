"""Achillio Travel sessions must not run on poreiago.com Host."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from travel_platform.settings.office_host_guard import (
    host_looks_like_achillio_travel,
    office_host_mismatch_detail,
)


class OfficeHostGuardTests(unittest.IsolatedAsyncioTestCase):
    def test_host_detect(self):
        self.assertTrue(host_looks_like_achillio_travel("www.achilliotravel.com"))
        self.assertTrue(host_looks_like_achillio_travel("achilliotravel.com"))
        self.assertFalse(host_looks_like_achillio_travel("www.poreiago.com"))
        self.assertFalse(host_looks_like_achillio_travel("api.poreiago.com"))

    async def test_achillio_jwt_blocked_on_poreiago_platform_host(self):
        tid = str(uuid4())
        with patch(
            "travel_platform.settings.office_host_guard.AsyncSessionLocal",
            create=True,
        ):
            pass
        with patch(
            "app.core.database.AsyncSessionLocal"
        ) as session_local, patch(
            "app.services.tenant_modules.is_achillio_travel_office",
            return_value=True,
        ):
            cm = AsyncMock()
            db = AsyncMock()
            result = AsyncMock()
            result.scalar_one_or_none = lambda: object()
            db.execute = AsyncMock(return_value=result)
            cm.__aenter__.return_value = db
            cm.__aexit__.return_value = None
            session_local.return_value = cm

            detail = await office_host_mismatch_detail(
                host="www.poreiago.com",
                tenant_id=tid,
                roles=["tenant_admin"],
                is_platform_host=True,
            )
        self.assertIsNotNone(detail)
        self.assertIn("achilliotravel.com", detail.lower())

    async def test_superadmin_may_cross_host(self):
        detail = await office_host_mismatch_detail(
            host="www.poreiago.com",
            tenant_id=str(uuid4()),
            roles=["superadmin"],
            is_platform_host=True,
        )
        self.assertIsNone(detail)


if __name__ == "__main__":
    unittest.main()
