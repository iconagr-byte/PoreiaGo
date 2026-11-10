"""Seal My Wallet customer sessions to one office (tenant).

Customer JWTs carry tenant_id from the Host at first office login/register,
persisted as account.wallet_tenant_id for native re-login.
Wallet APIs then require that seal — Host cannot silently switch offices.
On Capacitor / platform Host (no office domain), the JWT / home office is truth.
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any

from fastapi import HTTPException

if TYPE_CHECKING:
    from fastapi import Request


def jwt_tenant_id(payload_or_account: dict[str, Any] | None) -> str | None:
    if not payload_or_account:
        return None
    raw = (
        payload_or_account.get("tenant_id")
        or payload_or_account.get("wallet_tenant_id")
    )
    tid = str(raw or "").strip()
    return tid or None


async def stamp_tenant_for_request(request: "Request") -> str | None:
    """Resolve office from Host at auth time (no demo bleed in production)."""
    from api.request_tenant import public_tenant_id

    env = os.getenv("ENVIRONMENT", "development").lower()
    allow_demo = env in ("development", "dev", "local", "test")
    return await public_tenant_id(request, allow_demo_fallback=allow_demo)


async def resolve_login_wallet_tenant(
    request: "Request",
    *,
    account: dict[str, Any] | None,
    preferred_tenant_id: str | None = None,
) -> str:
    """
    Office seal at login/register/magic.

    Priority: Host office → preferred (e.g. booking) → account home office.
    Host and home must never disagree. First Host login binds home office.
    """
    from ticketing.customer_accounts import bind_wallet_tenant

    host_tid = await stamp_tenant_for_request(request)
    home = jwt_tenant_id(account) if account else None
    preferred = str(preferred_tenant_id or "").strip() or None

    if host_tid and home and host_tid != home:
        raise HTTPException(
            status_code=403,
            detail="Ο λογαριασμός ανήκει σε άλλο γραφείο. Συνδεθείτε από το σωστό site / app.",
        )
    if preferred and home and preferred != home:
        raise HTTPException(
            status_code=403,
            detail="Η κράτηση ανήκει σε άλλο γραφείο από τον λογαριασμό σας.",
        )
    if host_tid and preferred and host_tid != preferred:
        raise HTTPException(
            status_code=403,
            detail="Η κράτηση δεν ανήκει σε αυτό το γραφείο.",
        )

    chosen = host_tid or preferred or home
    if not chosen:
        raise HTTPException(
            status_code=400,
            detail="Συνδεθείτε πρώτη φορά από το site του γραφείου για να δεθεί το Wallet.",
        )

    email = str((account or {}).get("email") or "").strip().lower()
    if email and (not home or home != chosen):
        try:
            await bind_wallet_tenant(email, chosen)
        except ValueError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc

    return chosen


async def resolve_sealed_wallet_tenant(
    request: "Request",
    *,
    jwt_tid: str | None,
) -> str:
    """
    Office scope for wallet bookings/rentals.

    - JWT tenant + Host tenant must match when both are real offices.
    - JWT-only (native app / localhost) uses the account seal.
    - Host-only (legacy token without tenant) uses Host until re-login.
    """
    from api.request_tenant import public_tenant_id

    env = os.getenv("ENVIRONMENT", "development").lower()
    allow_demo = env in ("development", "dev", "local", "test")
    host_tid = await public_tenant_id(request, allow_demo_fallback=allow_demo)
    sealed = (jwt_tid or "").strip() or None
    host = str(host_tid).strip() if host_tid else None

    if sealed and host and sealed != host:
        raise HTTPException(
            status_code=403,
            detail="Ο λογαριασμός ανήκει σε άλλο γραφείο. Συνδεθείτε από το σωστό site / app.",
        )

    chosen = sealed or host
    if not chosen:
        raise HTTPException(
            status_code=404,
            detail="Δεν βρέθηκε γραφείο για αυτό το Wallet. Ανοίξτε από το site του γραφείου.",
        )
    return chosen
