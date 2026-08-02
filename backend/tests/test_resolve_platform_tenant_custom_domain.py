"""Platform tenant must resolve to PoreiaGo — never Achillio Travel office."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from travel_platform.operations import master_qr_bridge as bridge


class ResolvePlatformTenantTests(unittest.IsolatedAsyncioTestCase):
    async def test_prefers_poreiago_classifier_over_achillio_domain(self):
        """achilliotravel.com must not win — that is Achillio Travel, not platform."""
        poreiago = SimpleNamespace(
            id="c8208a59-bb2b-4299-a4d5-6fbadbb9b089",
            slug="achillio",
            subdomain="achillio",
            custom_domain="",
            legal_name="PoreiaGo",
        )

        bridge._PLATFORM_TENANT_CACHE = None
        with patch.dict(
            "os.environ",
            {
                "SAAS_DEFAULT_TENANT_ID": "",
                "DEFAULT_TENANT_ID": "",
                "PLATFORM_CUSTOM_DOMAINS": "achilliotravel.com",
            },
            clear=False,
        ):
            with patch(
                "travel_platform.settings.office_host_guard.resolve_poreiago_platform_tenant_id",
                new=AsyncMock(return_value=str(poreiago.id)),
            ):
                tid = await bridge.resolve_platform_tenant_id()

        self.assertEqual(tid, str(poreiago.id))
        bridge._PLATFORM_TENANT_CACHE = None

    async def test_strips_achilliotravel_from_platform_domains_env(self):
        """PLATFORM_CUSTOM_DOMAINS=achilliotravel.com must not query that office."""
        seed = SimpleNamespace(
            id="c8208a59-bb2b-4299-a4d5-6fbadbb9b089",
            slug="achillio",
            subdomain="achillio",
            custom_domain="",
            legal_name="PoreiaGo",
        )

        class _Result:
            def __init__(self, value):
                self._value = value

            def scalar_one_or_none(self):
                return self._value

        session = MagicMock()
        # Only slug lookup — achilliotravel.com was stripped from preferred_domains.
        session.execute = AsyncMock(return_value=_Result(seed))
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
            with patch(
                "travel_platform.settings.office_host_guard.resolve_poreiago_platform_tenant_id",
                new=AsyncMock(return_value=None),
            ):
                with patch("app.core.database.AsyncSessionLocal", return_value=session):
                    tid = await bridge.resolve_platform_tenant_id()

        self.assertEqual(tid, str(seed.id))
        self.assertEqual(session.execute.await_count, 1)
        bridge._PLATFORM_TENANT_CACHE = None

    async def test_falls_back_to_slug_when_no_classifier(self):
        seed = SimpleNamespace(
            id="c8208a59-bb2b-4299-a4d5-6fbadbb9b089",
            slug="achillio",
            subdomain="achillio",
            custom_domain="",
            legal_name="PoreiaGo",
        )

        class _Result:
            def __init__(self, value):
                self._value = value

            def scalar_one_or_none(self):
                return self._value

        calls = {"n": 0}

        async def execute(_stmt):
            calls["n"] += 1
            # custom_domain (poreiago.com) miss, then slug hit
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
                "PLATFORM_CUSTOM_DOMAINS": "poreiago.com",
                "DEFAULT_TENANT_SLUG": "achillio",
            },
            clear=False,
        ):
            with patch(
                "travel_platform.settings.office_host_guard.resolve_poreiago_platform_tenant_id",
                new=AsyncMock(return_value=None),
            ):
                with patch("app.core.database.AsyncSessionLocal", return_value=session):
                    tid = await bridge.resolve_platform_tenant_id()

        self.assertEqual(tid, str(seed.id))
        self.assertEqual(calls["n"], 2)
        bridge._PLATFORM_TENANT_CACHE = None


if __name__ == "__main__":
    unittest.main()
