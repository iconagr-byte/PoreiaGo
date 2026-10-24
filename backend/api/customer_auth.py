"""Customer wallet auth — register, login, JWT, password reset, Google."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from ticketing.email_dispatch import send_email
from ticketing.customer_accounts import (
    authenticate_account,
    change_account_email,
    change_account_password,
    create_password_reset_token,
    get_account,
    register_account,
    reset_password_with_token,
    upsert_google_account,
)
from api.customer_wallet_seal import jwt_tenant_id, resolve_login_wallet_tenant
from ticketing.customer_jwt import create_customer_token, decode_customer_token
from ticketing.wallet_magic import (
    MAGIC_TTL_MINUTES,
    consume_wallet_magic_token,
    create_wallet_magic_token,
)
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


class ChangeEmailRequest(BaseModel):
    new_email: EmailStr
    current_password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10)
    new_password: str = Field(min_length=6, max_length=128)


class GoogleTokenRequest(BaseModel):
    id_token: str = Field(min_length=10)


class WalletMagicIssueRequest(BaseModel):
    email: EmailStr
    booking_id: str = Field(min_length=1, max_length=80)
    name: str = Field(default="", max_length=120)
    phone: str = Field(default="", max_length=40)
    send_email: bool = True


class WalletMagicConsumeRequest(BaseModel):
    token: str = Field(min_length=10, max_length=200)


def _google_client_id() -> str:
    from app.services.google_oauth import google_client_id

    return google_client_id()


def _public_base_url() -> str:
    return (os.getenv("PUBLIC_APP_URL") or os.getenv("VITE_APP_URL") or "http://localhost:5173").rstrip("/")


def _profile_response(account: dict, access_token: str, *, tenant_id: str | None = None) -> dict:
    tid = (tenant_id or "").strip() or None
    if tid is None:
        try:
            tid = jwt_tenant_id(decode_customer_token(access_token))
        except Exception:
            tid = None
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
        "tenant_id": tid,
    }


async def _issue_customer_token(
    request: Request,
    email: str,
    *,
    extra: dict | None = None,
    account: dict | None = None,
    preferred_tenant_id: str | None = None,
) -> tuple[str, str, dict]:
    """Mint JWT sealed to Host / home office / preferred booking office."""
    acct = account or await get_account(email)
    tid = await resolve_login_wallet_tenant(
        request,
        account=acct,
        preferred_tenant_id=preferred_tenant_id,
    )
    payload_extra = dict(extra or {})
    payload_extra["tenant_id"] = tid
    # Refresh account after bind so profile carries home office.
    fresh = await get_account(email) or acct or {"email": email}
    cid = str((fresh or {}).get("customer_id") or "").strip()
    if cid:
        payload_extra["customer_id"] = cid
    return create_customer_token(email, extra=payload_extra), tid, fresh


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
    # Attach JWT seal for downstream wallet routers (never trust client body).
    account = dict(account)
    sealed = jwt_tenant_id(payload) or jwt_tenant_id(account)
    account["tenant_id"] = sealed
    account["_jwt_payload"] = payload
    return account


@router.post("/register")
async def register_customer(request: Request, body: RegisterRequest):
    email = body.email.strip().lower()
    if email in STAFF_EMAILS:
        raise HTTPException(status_code=403, detail="Use Admin Login for staff accounts")
    try:
        account = await register_account(email, body.password, body.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    token, tid, account = await _issue_customer_token(request, email, account=account)
    record_login_from_request(
        request,
        actor_type="customer",
        identity=email,
        success=True,
        actor_id=str(account.get("customer_id") or email),
        actor_name=account.get("name"),
        method="register",
        tenant_id=tid,
    )
    try:
        from ticketing.customer_registration_notify import notify_customer_registration

        await notify_customer_registration(account, tenant_id=tid, method="email")
    except Exception:
        pass
    return _profile_response(account, token, tenant_id=tid)


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
    token, tid, account = await _issue_customer_token(request, email, account=account)
    record_login_from_request(
        request,
        actor_type="customer",
        identity=email,
        success=True,
        actor_id=str(account.get("customer_id") or email),
        actor_name=account.get("name"),
        method="password",
        tenant_id=tid,
    )
    return _profile_response(account, token, tenant_id=tid)


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
        "tenant_id": account.get("tenant_id"),
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


@router.post("/change-email")
async def change_email(
    request: Request,
    body: ChangeEmailRequest,
    account: dict = Depends(get_current_customer),
):
    try:
        updated = await change_account_email(
            account["email"], body.new_email, body.current_password
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    token, tid, updated = await _issue_customer_token(
        request, updated["email"], account=updated
    )
    return _profile_response(updated, token, tenant_id=tid)


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
async def reset_password(request: Request, body: ResetPasswordRequest):
    try:
        account = await reset_password_with_token(body.token, body.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    token, tid, account = await _issue_customer_token(
        request, account["email"], account=account
    )
    return _profile_response(account, token, tenant_id=tid)


@router.get("/google/config")
async def google_auth_config():
    """
    Public GIS client id for My Wallet Sign-In.

    The OAuth Web Client ID is not a secret — Google embeds it in the browser.
    Frontend loads this at runtime so ops only need GOOGLE_CLIENT_ID in .env.prod
    (no Vite rebuild required when rotating the id).
    """
    client_id = _google_client_id()
    return {
        "enabled": bool(client_id),
        "client_id": client_id or None,
    }


@router.post("/google")
async def verify_google_token(request: Request, body: GoogleTokenRequest):
    """Verify Google ID token, upsert account, return JWT."""
    from app.services.google_oauth import verify_google_id_token

    try:
        data = await verify_google_id_token(body.id_token)
    except HTTPException as exc:
        record_login_from_request(
            request,
            actor_type="customer",
            identity="google",
            success=False,
            method="google",
            detail=str(exc.detail),
        )
        raise

    email = str(data.get("email", "")).strip().lower()

    if email in STAFF_EMAILS:
        raise HTTPException(status_code=403, detail="Use Admin Login for staff accounts")

    prior = await get_account(email)
    is_new = prior is None
    account = await upsert_google_account(email, data.get("name"), data.get("picture"))
    token, tid, account = await _issue_customer_token(
        request, email, extra={"provider": "google"}, account=account
    )
    record_login_from_request(
        request,
        actor_type="customer",
        identity=email,
        success=True,
        actor_id=str(account.get("customer_id") or email),
        actor_name=account.get("name") or data.get("name"),
        method="google_signup" if is_new else "google",
        tenant_id=tid,
    )
    if is_new:
        try:
            from ticketing.customer_registration_notify import notify_customer_registration

            await notify_customer_registration(account, tenant_id=tid, method="google")
        except Exception:
            pass
    return _profile_response(account, token, tenant_id=tid)


@router.post("/wallet-magic/issue")
async def issue_wallet_magic(body: WalletMagicIssueRequest):
    """
    Issue a short-lived magic link for My Wallet (phase B).

    Always returns ok when inputs look valid — avoids email enumeration.
    The raw magic URL is NEVER returned to untrusted clients (account takeover).
    Ticket confirmation emails mint tokens server-side in ticketing.ticket_email.
    """
    email = body.email.strip().lower()
    booking_id = body.booking_id.strip()
    if email in STAFF_EMAILS:
        return {"ok": True, "sent": False, "expires_minutes": MAGIC_TTL_MINUTES}

    sent = False
    try:
        token = await create_wallet_magic_token(
            email=email,
            booking_id=booking_id,
            name=body.name,
            phone=body.phone,
        )
        magic_url = f"{_public_base_url()}/wallet/magic?token={token}"
        # Public API only delivers by email — never leak the token URL in JSON.
        if body.send_email:
            subject = "My Wallet — Άνοιγμα εισιτηρίου"
            html = f"""<!DOCTYPE html><html lang="el"><body style="font-family:Arial,sans-serif;padding:24px;background:#f4f7fb;">
              <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:20px;padding:28px;border:1px solid #e2e8f0;">
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;font-weight:bold;">My Wallet</p>
                <h2 style="margin:0 0 12px;color:#0f172a;">Άνοιγμα εισιτηρίου</h2>
                <p style="margin:0 0 20px;color:#64748b;line-height:1.55;">Πατήστε για να ανοίξετε το My Wallet χωρίς κωδικό. Ο σύνδεσμος ισχύει για {MAGIC_TTL_MINUTES} λεπτά.</p>
                <p><a href="{magic_url}" style="display:inline-block;padding:14px 28px;background:#0f172a;color:#fff;text-decoration:none;border-radius:999px;font-weight:bold;">Άνοιγμα My Wallet</a></p>
                <p style="margin:20px 0 0;font-size:11px;color:#94a3b8;word-break:break-all;">{magic_url}</p>
              </div>
            </body></html>"""
            await send_email(email, subject, html)
            sent = True
    except Exception:
        sent = False

    return {
        "ok": True,
        "sent": sent,
        "expires_minutes": MAGIC_TTL_MINUTES,
    }


@router.post("/wallet-magic/consume")
async def consume_wallet_magic(request: Request, body: WalletMagicConsumeRequest):
    """Exchange a magic-link token for a customer JWT + focused booking."""
    try:
        result = await consume_wallet_magic_token(body.token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    account = result["account"]
    booking_tid = None
    try:
        from ticketing.customer_bookings import get_booking

        booking = await get_booking(result["booking_id"], tenant_id=None)
        if booking:
            booking_tid = str(
                booking.get("tenant_id") or booking.get("tenantId") or ""
            ).strip() or None
            # Email must match booking owner when present.
            be = str(booking.get("email") or "").strip().lower()
            if be and be != account["email"]:
                raise HTTPException(
                    status_code=403,
                    detail="Η κράτηση δεν ανήκει σε αυτόν τον λογαριασμό.",
                )
    except HTTPException:
        raise
    except Exception:
        booking_tid = None

    access, tid, account = await _issue_customer_token(
        request,
        account["email"],
        extra={"provider": "magic"},
        account=account,
        preferred_tenant_id=booking_tid,
    )
    profile = _profile_response(account, access, tenant_id=tid)
    profile["provider"] = "magic"
    profile["highlight_booking"] = result["booking_id"]
    return profile
