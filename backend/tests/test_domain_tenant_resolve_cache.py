"""Host→tenant resolve must be cached; Bearer JWT skips DB lookup."""

from __future__ import annotations

from uuid import UUID, uuid4

import jwt
import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

import middleware.domain_tenant as mod
from middleware.domain_tenant import DomainTenantMiddleware, clear_host_resolve_cache
from olympus.tenant.domain_resolver import ResolvedTenant


TENANT_ID = UUID("11111111-1111-1111-1111-111111111111")


def _resolved() -> ResolvedTenant:
    return ResolvedTenant(
        tenant_id=TENANT_ID,
        slug="achillio",
        subdomain="achillio",
        custom_domain="achilliotravel.com",
        theme={"primary": "#005d90"},
        is_active=True,
    )


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_host_resolve_cache()
    yield
    clear_host_resolve_cache()


def _app_with_echo() -> FastAPI:
    app = FastAPI()

    @app.get("/api/admin/platform/drivers/{driver_id}")
    async def driver_detail(request: Request, driver_id: str):
        tid = getattr(request.state, "tenant_id", None)
        return {"driver_id": driver_id, "tenant_id": str(tid) if tid else None}

    @app.get("/storefront-only")
    async def storefront(request: Request):
        tid = getattr(request.state, "tenant_id", None)
        return {"tenant_id": str(tid) if tid else None}

    app.add_middleware(DomainTenantMiddleware)
    return app


def test_jwt_scoped_bearer_skips_domain_db(monkeypatch):
    calls = {"n": 0}
    secret = "test-secret-32chars-minimum!!xx"

    class _BoomResolver:
        def __init__(self, session):
            pass

        async def resolve(self, host):
            calls["n"] += 1
            raise AssertionError("Host resolve must be skipped when Bearer sets tenant")

    class _FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    import middleware.tenant as tenant_mod

    monkeypatch.setattr(tenant_mod, "_jwt_settings", lambda: (secret, "HS256", False))
    monkeypatch.setattr(mod, "DomainResolver", _BoomResolver)
    monkeypatch.setattr(mod, "AsyncSessionLocal", lambda: _FakeSession())

    token = jwt.encode(
        {"sub": "admin-1", "tenant_id": str(TENANT_ID), "roles": ["tenant_admin"]},
        secret,
        algorithm="HS256",
    )

    client = TestClient(_app_with_echo())
    response = client.get(
        f"/api/admin/platform/drivers/{uuid4()}",
        headers={
            "Host": "www.achilliotravel.com",
            "Authorization": f"Bearer {token}",
        },
    )
    assert response.status_code == 200
    assert response.json()["tenant_id"] == str(TENANT_ID)
    assert calls["n"] == 0


def test_host_resolve_cached_on_jwt_scoped_without_bearer(monkeypatch):
    calls = {"n": 0}

    class _CountingResolver:
        def __init__(self, session):
            pass

        async def resolve(self, host):
            calls["n"] += 1
            return _resolved()

    class _FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    monkeypatch.setattr(mod, "DomainResolver", _CountingResolver)
    monkeypatch.setattr(mod, "AsyncSessionLocal", lambda: _FakeSession())

    client = TestClient(_app_with_echo())
    headers = {"Host": "www.achilliotravel.com"}
    r1 = client.get(f"/api/admin/platform/drivers/{uuid4()}", headers=headers)
    r2 = client.get(f"/api/admin/platform/drivers/{uuid4()}", headers=headers)
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["tenant_id"] == str(TENANT_ID)
    assert r2.json()["tenant_id"] == str(TENANT_ID)
    assert calls["n"] == 1


def test_storefront_host_resolve_uses_cache(monkeypatch):
    calls = {"n": 0}

    class _CountingResolver:
        def __init__(self, session):
            pass

        async def resolve(self, host):
            calls["n"] += 1
            return _resolved()

    class _FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    monkeypatch.setattr(mod, "DomainResolver", _CountingResolver)
    monkeypatch.setattr(mod, "AsyncSessionLocal", lambda: _FakeSession())

    client = TestClient(_app_with_echo())
    headers = {"Host": "www.achilliotravel.com"}
    assert client.get("/storefront-only", headers=headers).status_code == 200
    assert client.get("/storefront-only", headers=headers).status_code == 200
    assert calls["n"] == 1
