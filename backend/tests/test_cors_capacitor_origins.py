"""Capacitor Wallet WebView origins must be allowed for CORS."""

from __future__ import annotations

from main import _cors_origins


def test_capacitor_localhost_origins_in_default_cors():
    origins = set(_cors_origins())
    assert "https://localhost" in origins
    assert "capacitor://localhost" in origins
    assert "https://www.achilliotravel.com" in origins
