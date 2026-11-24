"""DomainResolver maps slugify(legal_name) hosts to the real office subdomain."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from olympus.tenant.domain_resolver import DomainResolver
from olympus.tenant.provisioning import slugify


class _ScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def scalar_one_or_none(self):
        return self._rows[0] if len(self._rows) == 1 else None

    def scalars(self):
        return self


class _Scalars:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return list(self._rows)


class DomainResolverLegalNameTests(unittest.IsolatedAsyncioTestCase):
    async def test_legal_name_host_resolves_to_short_slug(self):
        legal = "Dodopoulos Christos & Charalampidis Achilleas O.E"
        host_label = slugify(legal)
        self.assertEqual(host_label, "dodopoulos-christos-charalampidis-achilleas-o-e")

        tenant = SimpleNamespace(
            id=uuid4(),
            slug="iconarent",
            subdomain="iconarent",
            legal_name=legal,
            custom_domain=None,
            settings_json="{}",
            theme_config=None,
            is_active=True,
            admin_ip_whitelist=None,
        )

        session = MagicMock()

        async def execute(stmt):
            # First query: subdomain/slug exact — miss
            sql = str(stmt)
            if "legal_name" in sql or True:
                # DomainResolver runs two executes: exact match then legal_name scan.
                pass
            # Use call count to distinguish.
            execute.calls += 1
            if execute.calls == 1:
                return _ScalarResult([])
            return SimpleNamespace(scalars=lambda: _Scalars([tenant]))

        execute.calls = 0
        session.execute = AsyncMock(side_effect=execute)

        resolver = DomainResolver(session)
        # Patch settings base domain.
        resolver._settings = {"base_domain": "poreiago.com"}

        resolved = await resolver.resolve(f"{host_label}.poreiago.com")
        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.slug, "iconarent")
        self.assertEqual(resolved.subdomain, "iconarent")

    async def test_ambiguous_legal_name_does_not_resolve(self):
        legal = "Same Name OE"
        t1 = SimpleNamespace(
            id=uuid4(),
            slug="a",
            subdomain="a",
            legal_name=legal,
            custom_domain=None,
            settings_json="{}",
            theme_config=None,
            is_active=True,
            admin_ip_whitelist=None,
        )
        t2 = SimpleNamespace(
            id=uuid4(),
            slug="b",
            subdomain="b",
            legal_name=legal,
            custom_domain=None,
            settings_json="{}",
            theme_config=None,
            is_active=True,
            admin_ip_whitelist=None,
        )
        session = MagicMock()

        async def execute(_stmt):
            execute.calls += 1
            if execute.calls == 1:
                return _ScalarResult([])
            return SimpleNamespace(scalars=lambda: _Scalars([t1, t2]))

        execute.calls = 0
        session.execute = AsyncMock(side_effect=execute)
        resolver = DomainResolver(session)
        resolver._settings = {"base_domain": "poreiago.com"}
        resolved = await resolver.resolve(f"{slugify(legal)}.poreiago.com")
        self.assertIsNone(resolved)


if __name__ == "__main__":
    unittest.main()
