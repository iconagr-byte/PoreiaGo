"""Verify Google Sign-In ID tokens (GIS) for customer + admin auth."""

from __future__ import annotations

import os

import httpx
from fastapi import HTTPException


def is_placeholder_google_client_id(client_id: str) -> bool:
    """True for empty / docs-example Client IDs that must not enable Sign-In."""
    value = (client_id or "").strip().lower()
    if not value:
        return True
    if not value.endswith(".apps.googleusercontent.com"):
        return True
    if "xxxx" in value or "example" in value or "your-client" in value:
        return True
    if value.startswith("123456789-xxxx") or value.startswith("1234567890-xxxx"):
        return True
    return False


# Wallet native Capgo webClientId (same GCP project as Android OAuth).
# Kept as a fallback audience so ID tokens verify even before .env.prod is updated.
_POREIAGO_WALLET_WEB_CLIENT_ID = (
    "967076454927-c5goejio1jlqr2vki24j7g8133knnqlp.apps.googleusercontent.com"
)


def google_client_id() -> str:
    raw = (os.getenv("GOOGLE_CLIENT_ID") or os.getenv("VITE_GOOGLE_CLIENT_ID") or "").strip()
    if is_placeholder_google_client_id(raw):
        return ""
    # First id if comma-separated
    return raw.split(",")[0].strip()


def google_client_ids() -> list[str]:
    """Accepted ID-token audiences (primary env + Wallet PoreiaGo Web client)."""
    ids: list[str] = []
    raw = (os.getenv("GOOGLE_CLIENT_ID") or os.getenv("VITE_GOOGLE_CLIENT_ID") or "").strip()
    if raw:
        for part in raw.split(","):
            cid = part.strip()
            if cid and not is_placeholder_google_client_id(cid) and cid not in ids:
                ids.append(cid)
    if (
        _POREIAGO_WALLET_WEB_CLIENT_ID not in ids
        and not is_placeholder_google_client_id(_POREIAGO_WALLET_WEB_CLIENT_ID)
    ):
        ids.append(_POREIAGO_WALLET_WEB_CLIENT_ID)
    return ids


async def verify_google_id_token(id_token: str) -> dict:
    """Validate token with Google tokeninfo and return claims."""
    accepted = google_client_ids()
    if not accepted:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth not configured (set GOOGLE_CLIENT_ID)",
        )

    async with httpx.AsyncClient() as http:
        response = await http.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
            timeout=10.0,
        )

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    data = response.json()
    if data.get("aud") not in accepted:
        raise HTTPException(status_code=401, detail="Google token audience mismatch")

    email_verified = str(data.get("email_verified", "")).lower()
    if email_verified not in ("true", "1"):
        raise HTTPException(status_code=401, detail="Google email not verified")

    email = str(data.get("email", "")).strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Google account has no email")

    return data
