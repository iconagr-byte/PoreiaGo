"""Google Sign-In public config endpoint."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.customer_auth import router as customer_auth_router


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(customer_auth_router)
    return TestClient(app)


POREIAGO_WEB = (
    "967076454927-c5goejio1jlqr2vki24j7g8133knnqlp.apps.googleusercontent.com"
)
LEGACY_ACHILLIO_WEB = (
    "838114974488-8q36brogbldig001k9n88qrnciqle1j1.apps.googleusercontent.com"
)


def test_google_config_falls_back_to_poreiago_when_env_empty(monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("VITE_GOOGLE_CLIENT_ID", raising=False)
    res = _client().get("/api/auth/google/config")
    assert res.status_code == 200
    data = res.json()
    assert data["enabled"] is True
    assert data["client_id"] == POREIAGO_WEB


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


def test_google_login_rejects_invalid_token_with_wallet_fallback(monkeypatch):
    """Empty env still accepts PoreiaGo Wallet Web audience; bad token → 401."""
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("VITE_GOOGLE_CLIENT_ID", raising=False)
    res = _client().post(
        "/api/auth/google",
        json={"id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.e30.x"},
    )
    assert res.status_code == 401
    assert "Invalid Google token" in res.json()["detail"]


def test_google_config_placeholder_env_uses_poreiago(monkeypatch):
    monkeypatch.setenv(
        "GOOGLE_CLIENT_ID",
        "123456789-xxxx.apps.googleusercontent.com",
    )
    monkeypatch.delenv("VITE_GOOGLE_CLIENT_ID", raising=False)
    res = _client().get("/api/auth/google/config")
    assert res.status_code == 200
    data = res.json()
    assert data["enabled"] is True
    assert data["client_id"] == POREIAGO_WEB


def test_google_login_rejects_invalid_token_when_placeholder_env(monkeypatch):
    """Placeholder env is ignored; Wallet PoreiaGo fallback still verifies via Google."""
    monkeypatch.setenv(
        "GOOGLE_CLIENT_ID",
        "123456789-xxxx.apps.googleusercontent.com",
    )
    monkeypatch.delenv("VITE_GOOGLE_CLIENT_ID", raising=False)
    res = _client().post(
        "/api/auth/google",
        json={"id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.e30.x"},
    )
    assert res.status_code == 401
