"""CORS preflight must succeed before JWT middleware (admin live map poll)."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from middleware.domain_tenant import DomainTenantMiddleware
from middleware.tenant import TenantContextMiddleware


def _app_with_cors_outermost() -> FastAPI:
    app = FastAPI()

    @app.get("/api/v1/telemetry/fleet/live")
    async def live_fleet():
        return {"vehicles": []}

    # Same order as backend/main.py: auth first, CORS last (= outermost).
    app.add_middleware(TenantContextMiddleware)
    app.add_middleware(DomainTenantMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["https://www.poreiago.com"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return app


def test_options_preflight_fleet_live_returns_200_with_cors_headers():
    client = TestClient(_app_with_cors_outermost())
    response = client.options(
        "/api/v1/telemetry/fleet/live",
        headers={
            "Origin": "https://www.poreiago.com",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "https://www.poreiago.com"
    assert "authorization" in (response.headers.get("access-control-allow-headers") or "").lower()
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_get_without_token_still_401_but_includes_cors_headers():
    client = TestClient(_app_with_cors_outermost())
    response = client.get(
        "/api/v1/telemetry/fleet/live",
        headers={"Origin": "https://www.poreiago.com"},
    )
    assert response.status_code == 401
    assert response.headers.get("access-control-allow-origin") == "https://www.poreiago.com"
