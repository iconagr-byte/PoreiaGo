"""Public newsletter subscribe — storefront / rent CTA banners."""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Request
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
    office: str | None = None


async def _office_subscriber_tag(request: Request, source: str) -> tuple[str, str | None]:
    """Tag subscribers with the office Host so rent desks stay sealed."""
    office_slug: str | None = None
    try:
        from api.request_tenant import public_tenant_id
        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.models.tenant import Tenant

        tid = await public_tenant_id(request, allow_demo_fallback=False)
        if tid:
            from uuid import UUID as _UUID

            try:
                tid_uuid = tid if isinstance(tid, _UUID) else _UUID(str(tid))
            except Exception:
                tid_uuid = None
            if tid_uuid is not None:
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(Tenant).where(Tenant.id == tid_uuid).limit(1),
                    )
                    tenant = result.scalar_one_or_none()
                    if tenant:
                        office_slug = (
                            str(tenant.subdomain or tenant.slug or "").strip().lower()
                            or None
                        )
    except Exception:
        office_slug = None

    if office_slug:
        return f"nl-{source}:{office_slug}", office_slug
    return f"nl-{source}", None


@router.post("/subscribe", response_model=NewsletterSubscribeOut)
async def subscribe_newsletter(request: Request, body: NewsletterSubscribeBody):
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
    customer_id, office_slug = await _office_subscriber_tag(request, source)

    try:
        from email_client.store import init_email_client_tables

        await init_email_client_tables()
    except Exception:
        pass

    sub = await email_store.ensure_subscriber(
        email=email,
        name=name,
        customer_id=customer_id,
        is_subscribed=True,
    )
    if not sub:
        raise HTTPException(status_code=400, detail="Αποτυχία εγγραφής")

    return NewsletterSubscribeOut(ok=True, email=email, office=office_slug)
