"""Platform tenant must prefer custom_domain office over obsolete seed slug."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from travel_platform.operations import master_qr_bridge as bridge


class ResolvePlatformTenantTests(unittest.IsolatedAsyncioTestCase):
    async def test_prefers_custom_domain_over_slug(self):
        office = SimpleNamespace(
            id="81ce186d-40fd-4f51-8e62-1353a9e68f33",
            slug="admin-achillio-gr",
        )

        class _Result:
            def __init__(self, value):
                self._value = value

            def scalar_one_or_none(self):
                return self._value

        session = MagicMock()
        session.execute = AsyncMock(return_value=_Result(office))
        session.__aenter__ = AsyncMock(return_value=session)
        session.__aexit__ = AsyncMock(return_value=None)

        bridge._PLATFORM_TENANT_CACHE = None
        with patch.dict(
            "os.environ",
            {"SAAS_DEFAULT_TENANT_ID": "", "DEFAULT_TENANT_ID": ""},
            clear=False,
        ):
            with patch("app.core.database.AsyncSessionLocal", return_value=session):
                tid = await bridge.resolve_platform_tenant_id()

        self.assertEqual(tid, str(office.id))
        self.assertEqual(session.execute.await_count, 1)
        bridge._PLATFORM_TENANT_CACHE = None

    async def test_falls_back_to_slug_when_no_custom_domain(self):
        seed = SimpleNamespace(
            id="c8208a59-bb2b-4299-a4d5-6fbadbb9b089",
            slug="achillio",
        )

        class _Result:
            def __init__(self, value):
                self._value = value

            def scalar_one_or_none(self):
                return self._value

        calls = {"n": 0}

        async def execute(_stmt):
            calls["n"] += 1
            # custom_domain query misses, then slug hits
            if calls["n"] == 1:
                return _Result(None)
            return _Result(seed)

        session = MagicMock()
        session.execute = AsyncMock(side_effect=execute)
        session.__aenter__ = AsyncMock(return_value=session)
        session.__aexit__ = AsyncMock(return_value=None)

        bridge._PLATFORM_TENANT_CACHE = None
        with patch.dict(
            "os.environ",
            {
                "SAAS_DEFAULT_TENANT_ID": "",
                "DEFAULT_TENANT_ID": "",
                "PLATFORM_CUSTOM_DOMAINS": "achilliotravel.com",
                "DEFAULT_TENANT_SLUG": "achillio",
            },
            clear=False,
        ):
            with patch("app.core.database.AsyncSessionLocal", return_value=session):
                tid = await bridge.resolve_platform_tenant_id()

        self.assertEqual(tid, str(seed.id))
        self.assertEqual(calls["n"], 2)
        bridge._PLATFORM_TENANT_CACHE = None


if __name__ == "__main__":
    unittest.main()
