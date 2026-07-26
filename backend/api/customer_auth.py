"""Customer wallet auth — register, login, JWT, password reset, Google."""

from __future__ import annotations

import os

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from ticketing.email_dispatch import send_email
from ticketing.customer_accounts import (
    authenticate_account,
    change_account_password,
    create_password_reset_token,
    get_account,
    register_account,
    reset_password_with_token,
    upsert_google_account,
)
from ticketing.customer_jwt import create_customer_token, decode_customer_token
from travel_platform.settings.login_audit_store import record_login_from_request

router = APIRouter(prefix="/api/auth", tags=["Customer Auth"])

STAFF_EMAILS = {"admin@aerostride.com", "driver@aerostride.com"}


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(default="", max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(default="", max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10)
    new_password: str = Field(min_length=6, max_length=128)


class GoogleTokenRequest(BaseModel):
    id_token: str = Field(min_length=10)


def _google_client_id() -> str:
    return (os.getenv("GOOGLE_CLIENT_ID") or os.getenv("VITE_GOOGLE_CLIENT_ID") or "").strip()


def _public_base_url() -> str:
    return (os.getenv("PUBLIC_APP_URL") or os.getenv("VITE_APP_URL") or "http://localhost:5173").rstrip("/")


def _profile_response(account: dict, access_token: str) -> dict:
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "email": account["email"],
        "name": account["name"],
        "phone": account.get("phone") or "",
        "picture": account.get("picture") or "",
        "provider": account.get("auth_provider") or "email",
        "customer_id": account.get("customer_id"),
        "has_password": account.get("has_password", False),
    }


async def get_current_customer(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Απαιτείται σύνδεση")
    token = authorization[7:].strip()
    try:
        payload = decode_customer_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    account = await get_account(payload["sub"])
    if not account:
        raise HTTPException(status_code=401, detail="Ο λογαριασμός δεν βρέθηκε")
    return account


@router.post("/register")
async def register_customer(body: RegisterRequest):
    email = body.email.strip().lower()
    if email in STAFF_EMAILS:
        raise HTTPException(status_code=403, detail="Use Admin Login for staff accounts")
    try:
        account = await register_account(email, body.password, body.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    token = create_customer_token(email)
    return _profile_response(account, token)


@router.post("/login")
async def login_customer(request: Request, body: LoginRequest):
    email = body.email.strip().lower()
    if email in STAFF_EMAILS:
        raise HTTPException(status_code=403, detail="Use Admin Login for staff accounts")

    account = await authenticate_account(email, body.password)
    if not account:
        record_login_from_request(
            request,
            actor_type="customer",
            identity=email,
            success=False,
            method="password",
            detail="Λάθος email ή κωδικός",
        )
        raise HTTPException(status_code=401, detail="Λάθος email ή κωδικός")
    token = create_customer_token(email)
    record_login_from_request(
        request,
        actor_type="customer",
        identity=email,
        success=True,
        actor_id=str(account.get("customer_id") or email),
        actor_name=account.get("name"),
        method="password",
    )
    return _profile_response(account, token)


@router.get("/me")
async def customer_me(account: dict = Depends(get_current_customer)):
    return {
        "email": account["email"],
        "name": account["name"],
        "phone": account.get("phone") or "",
        "picture": account.get("picture") or "",
        "provider": account.get("auth_provider") or "email",
        "customer_id": account.get("customer_id"),
        "has_password": account.get("has_password", False),
    }


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    account: dict = Depends(get_current_customer),
):
    try:
        await change_account_password(account["email"], body.current_password, body.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "message": "Ο κωδικός ενημερώθηκε"}


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    """Αποστολή συνδέσμου επαναφοράς — πάντα επιστρέφει ok (αποφυγή enumeration)."""
    email = body.email.strip().lower()
    token = await create_password_reset_token(email)
    if token:
        reset_url = f"{_public_base_url()}/reset-password?token={token}"
        subject = "AeroStride — Επαναφορά κωδικού My Wallet"
        html = f"""<!DOCTYPE html><html lang="el"><body style="font-family:Arial,sans-serif;padding:24px;">
          <h2>Επαναφορά κωδικού</h2>
          <p>Λάβατε αυτό το email επειδή ζητήθηκε επαναφορά κωδικού για το My Wallet.</p>
          <p><a href="{reset_url}" style="display:inline-block;padding:12px 24px;background:#0040df;color:#fff;text-decoration:none;border-radius:999px;font-weight:bold;">Ορισμός νέου κωδικού</a></p>
          <p style="font-size:12px;color:#64748b;">Ο σύνδεσμος λήγει σε 1 ώρα. Αν δεν το ζητήσατε εσείς, αγνοήστε το email.</p>
          <p style="font-size:11px;color:#94a3b8;">{reset_url}</p>
        </body></html>"""
        await send_email(email, subject, html)
    return {
        "ok": True,
        "message": "Αν υπάρχει λογαριασμός, στάλθηκε email με οδηγίες επαναφοράς.",
    }


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    try:
        account = await reset_password_with_token(body.token, body.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    token = create_customer_token(account["email"])
    return _profile_response(account, token)


@router.post("/google")
async def verify_google_token(request: Request, body: GoogleTokenRequest):
    """Verify Google ID token, upsert account, return JWT."""
    client_id = _google_client_id()
    if not client_id:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth not configured (set GOOGLE_CLIENT_ID)",
        )

    async with httpx.AsyncClient() as http:
        response = await http.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": body.id_token},
            timeout=10.0,
        )

    if response.status_code != 200:
        record_login_from_request(
            request,
            actor_type="customer",
            identity="google",
            success=False,
            method="google",
            detail="Invalid Google token",
        )
        raise HTTPException(status_code=401, detail="Invalid Google token")

    data = response.json()
    if data.get("aud") != client_id:
        raise HTTPException(status_code=401, detail="Google token audience mismatch")

    email_verified = str(data.get("email_verified", "")).lower()
    if email_verified not in ("true", "1"):
        raise HTTPException(status_code=401, detail="Google email not verified")

    email = str(data.get("email", "")).strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Google account has no email")

    if email in STAFF_EMAILS:
        raise HTTPException(status_code=403, detail="Use Admin Login for staff accounts")

    account = await upsert_google_account(email, data.get("name"), data.get("picture"))
    token = create_customer_token(email, extra={"provider": "google"})
    record_login_from_request(
        request,
        actor_type="customer",
        identity=email,
        success=True,
        actor_id=str(account.get("customer_id") or email),
        actor_name=account.get("name") or data.get("name"),
        method="google",
    )
    return _profile_response(account, token)
