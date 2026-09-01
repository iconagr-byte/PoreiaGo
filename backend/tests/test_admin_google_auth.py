"""Admin Google Sign-In endpoint."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.auth import router as saas_auth_router
from app.models.user import UserRole


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(saas_auth_router, prefix="/api/v1")
    return TestClient(app)


def test_admin_google_503_without_client_id(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("VITE_GOOGLE_CLIENT_ID", raising=False)
    res = client.post("/api/v1/auth/google", json={"id_token": "fake-token"})
    assert res.status_code == 503


def test_admin_google_rejects_unknown_user(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")

    claims = {
        "aud": "test-client.apps.googleusercontent.com",
        "email_verified": "true",
        "email": "unknown@example.com",
        "name": "Unknown",
    }

    with patch(
        "app.services.google_oauth.verify_google_id_token",
        new=AsyncMock(return_value=claims),
    ):
        with patch("app.api.auth.AsyncSessionLocal") as mock_session:
            mock_db = AsyncMock()
            mock_session.return_value.__aenter__.return_value = mock_db
            with patch("app.api.auth.AuthService") as mock_auth:
                service = mock_auth.return_value
                service.login_with_google = AsyncMock(
                    side_effect=ValueError("Δεν βρέθηκε λογαριασμός"),
                )
                res = client.post("/api/v1/auth/google", json={"id_token": "ok-token"})

    assert res.status_code == 401


def test_admin_google_returns_token(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")

    tenant_id = uuid4()
    user_id = uuid4()
    claims = {
        "aud": "test-client.apps.googleusercontent.com",
        "email_verified": "true",
        "email": "admin@achillio.gr",
        "name": "Admin",
    }

    fake_user = type(
        "User",
        (),
        {
            "id": user_id,
            "email": "admin@achillio.gr",
            "full_name": "Admin",
            "roles": [UserRole.TENANT_ADMIN.value],
        },
    )()
    fake_tenant = type("Tenant", (), {"id": tenant_id, "slug": "admin-achillio-gr"})()

    with patch(
        "app.services.google_oauth.verify_google_id_token",
        new=AsyncMock(return_value=claims),
    ):
        with patch("app.api.auth.AsyncSessionLocal") as mock_session:
            mock_db = AsyncMock()
            mock_session.return_value.__aenter__.return_value = mock_db
            with patch("app.api.auth.AuthService") as mock_auth:
                service = mock_auth.return_value
                service.login_with_google = AsyncMock(
                    return_value=("access-token", "refresh-token", fake_user, fake_tenant),
                )
                res = client.post("/api/v1/auth/google", json={"id_token": "ok-token"})

    assert res.status_code == 200
    data = res.json()
    assert data["access_token"] == "access-token"
    assert data["tenant_slug"] == "admin-achillio-gr"
    assert UserRole.TENANT_ADMIN.value in data["roles"]
