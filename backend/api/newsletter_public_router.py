"""Public newsletter subscribe — storefront / rent CTA banners."""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from email_client import store as email_store

router = APIRouter(prefix="/api/newsletter", tags=["newsletter-public"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_ALLOWED_SOURCES = frozenset({"trips", "rent"})


class NewsletterSubscribeBody(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    preferred_city: str = Field(default="", max_length=120)
    consent: bool = False
    source: str = Field(default="trips", max_length=32)


class NewsletterSubscribeOut(BaseModel):
    ok: bool
    email: str


@router.post("/subscribe", response_model=NewsletterSubscribeOut)
async def subscribe_newsletter(body: NewsletterSubscribeBody):
    email = (body.email or "").strip().lower()
    if not email or not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Μη έγκυρο email")
    if not body.consent:
        raise HTTPException(
            status_code=400,
            detail="Απαιτείται συναίνεση για ενημερωτικά μηνύματα",
        )

    source = (body.source or "trips").strip().lower()
    if source not in _ALLOWED_SOURCES:
        source = "trips"

    city = (body.preferred_city or "").strip()
    # Prefer city as display name so office can target by departure / pickup.
    name = city[:120] if city else ""

    try:
        from email_client.store import init_email_client_tables

        await init_email_client_tables()
    except Exception:
        pass

    sub = await email_store.ensure_subscriber(
        email=email,
        name=name,
        customer_id=f"nl-{source}",
        is_subscribed=True,
    )
    if not sub:
        raise HTTPException(status_code=400, detail="Αποτυχία εγγραφής")

    return NewsletterSubscribeOut(ok=True, email=email)
