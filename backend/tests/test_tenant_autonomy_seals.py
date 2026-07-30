"""Cross-office autonomy seals — branding default, host resolution, public tenant."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from travel_platform.growth.branding_store import resolve_by_host


def test_resolve_by_host_does_not_return_poisoned_default_for_unknown():
    assert resolve_by_host("unknown-office.example.com") is None


def test_public_tenant_id_ignores_origin_referer(monkeypatch):
    import asyncio
    from api import request_tenant as rt

    called_hosts: list[str] = []

    async def fake_resolve(host: str):
        called_hosts.append(host)
        return None

    monkeypatch.setattr(
        "middleware.domain_tenant._is_platform_host",
        lambda h: h in {"www.poreiago.com", "poreiago.com", "api.poreiago.com"},
    )
    monkeypatch.setattr("middleware.domain_tenant._resolve_host_cached", fake_resolve)

    req = SimpleNamespace(
        state=SimpleNamespace(tenant_id=None),
        headers={
            "host": "api.poreiago.com",
            "origin": "https://www.achilliotravel.com",
            "referer": "https://www.achilliotravel.com/admin",
        },
    )
    out = asyncio.get_event_loop().run_until_complete(
        rt.public_tenant_id(req, allow_demo_fallback=False)
    )
    assert out is None
    assert "www.achilliotravel.com" not in called_hosts
    assert "achilliotravel.com" not in called_hosts


def test_sync_file_branding_skips_default_for_customer_office(monkeypatch):
    from app.services.tenant_branding_service import TenantBrandingService

    writes: list[str] = []

    def fake_update(key, payload):
        writes.append(key)
        return MagicMock()

    monkeypatch.setattr(
        "travel_platform.growth.branding_store.update_branding",
        fake_update,
    )

    tenant = SimpleNamespace(
        slug="sunny-rentals",
        subdomain="sunny",
        legal_name="Sunny",
        custom_domain="sunny.example",
        settings_json=None,
    )
    # Not platform
    monkeypatch.setattr(
        "app.services.tenant_modules.is_poreiago_platform_office",
        lambda t: False,
    )
    svc = TenantBrandingService(MagicMock())
    svc._olympus = {"base_domain": "poreiago.com"}
    svc._sync_file_branding("sunny-rentals", tenant, {}, {"primary": "#123"})
    assert "default" not in writes
    assert "sunny-rentals" in writes
