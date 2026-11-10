"""Customer wallet APIs must not 404 with «Domain not registered»."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from middleware.domain_tenant import DomainTenantMiddleware


def _app() -> FastAPI:
    app = FastAPI()

    @app.post("/api/auth/login")
    async def login():
        return {"ok": True, "email": "a@b.com"}

    @app.get("/api/customer/bookings")
    async def bookings():
        return []

    app.add_middleware(DomainTenantMiddleware)
    return app


def test_customer_auth_login_allowed_on_custom_domain_host():
    client = TestClient(_app())
    response = client.post(
        "/api/auth/login",
        json={"email": "a@b.com", "password": "x"},
        headers={"Host": "www.achilliotravel.com"},
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_customer_bookings_allowed_on_platform_www():
    client = TestClient(_app())
    response = client.get(
        "/api/customer/bookings",
        headers={"Host": "www.poreiago.com"},
    )
    assert response.status_code == 200


def test_unknown_storefront_path_still_404(monkeypatch):
    import middleware.domain_tenant as mod

    class _FakeResolver:
        def __init__(self, session):
            pass

        async def resolve(self, host):
            return None

    class _FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    monkeypatch.setattr(mod, "DomainResolver", _FakeResolver)
    monkeypatch.setattr(mod, "AsyncSessionLocal", lambda: _FakeSession())

    app = FastAPI()

    @app.get("/storefront-only")
    async def storefront():
        return {"ok": True}

    app.add_middleware(DomainTenantMiddleware)
    client = TestClient(app)
    response = client.get(
        "/storefront-only",
        headers={"Host": "totally-unknown-office.example"},
    )
    assert response.status_code == 404
    assert "Domain not registered" in response.json().get("detail", "")
