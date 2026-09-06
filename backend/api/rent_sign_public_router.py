"""Public contactless rental signature — token-gated, no admin JWT."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from travel_platform.rental import rental_store as store

router = APIRouter(prefix="/api/site/rent-sign", tags=["rent-sign-public"])


class RemoteSignSubmitBody(BaseModel):
    signature_url: str | None = Field(default=None, max_length=500)
    signature_base64: str | None = None
    signer_name: str | None = Field(default=None, max_length=160)
    accepted_terms: list[str] = Field(default_factory=list)
    fuel_level: float | None = Field(default=None, ge=0, le=100)
    insurance_label: str | None = Field(default=None, max_length=80)
    deposit_eur: float | None = Field(default=None, ge=0)
    summary: dict | None = None


@router.get("/{token}")
async def get_rent_sign_session(token: str):
    try:
        return store.get_signing_session(token)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{token}/submit")
async def submit_rent_sign(token: str, body: RemoteSignSubmitBody):
    try:
        result = store.submit_signature_by_token(token, body.model_dump())
    except ValueError as exc:
        msg = str(exc)
        code = 404 if "ληγμένος" in msg or "έγκυρος" in msg or "λήξει" in msg else 400
        if "ήδη" in msg:
            code = 409
        raise HTTPException(status_code=code, detail=msg) from exc

    booking = result.get("booking") or {}
    try:
        from travel_platform.notifications.dispatcher import send_email

        email = str(booking.get("client_email") or "").strip()
        if email:
            await send_email(
                email,
                "Η σύμβαση ενοικίασης υπογράφηκε",
                (
                    f"Γεια σας {booking.get('client_name') or ''},\n\n"
                    f"Η ψηφιακή υπογραφή ολοκληρώθηκε. Η σύμβαση είναι ACTIVE.\n\n"
                    f"PoreiaGo Rent"
                ),
            )
    except Exception:
        pass
    return {
        "ok": True,
        "contract_status": result.get("contract_status"),
        "contract_pdf_url": result.get("contract_pdf_url"),
        "signing_method": result.get("signing_method"),
    }
