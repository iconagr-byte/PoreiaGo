"""Google Sign-In public config endpoint."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.customer_auth import router as customer_auth_router


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(customer_auth_router)
    return TestClient(app)


def test_google_config_disabled_when_env_empty(monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("VITE_GOOGLE_CLIENT_ID", raising=False)
    res = _client().get("/api/auth/google/config")
    assert res.status_code == 200
    data = res.json()
    assert data["enabled"] is False
    assert data["client_id"] is None


def test_google_config_enabled_with_google_client_id(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "123-abc.apps.googleusercontent.com")
    monkeypatch.delenv("VITE_GOOGLE_CLIENT_ID", raising=False)
    res = _client().get("/api/auth/google/config")
    assert res.status_code == 200
    data = res.json()
    assert data["enabled"] is True
    assert data["client_id"] == "123-abc.apps.googleusercontent.com"


def test_google_config_falls_back_to_vite_env(monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.setenv("VITE_GOOGLE_CLIENT_ID", "vite-only.apps.googleusercontent.com")
    res = _client().get("/api/auth/google/config")
    assert res.status_code == 200
    data = res.json()
    assert data["enabled"] is True
    assert data["client_id"] == "vite-only.apps.googleusercontent.com"


def test_google_login_503_when_not_configured(monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("VITE_GOOGLE_CLIENT_ID", raising=False)
    res = _client().post(
        "/api/auth/google",
        json={"id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.e30.x"},
    )
    assert res.status_code == 503
    assert "GOOGLE_CLIENT_ID" in res.json()["detail"]
