"""Public office contact form — guest → office mailbox (Host-scoped)."""

from __future__ import annotations

import html
import logging
import re
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(tags=["site-contact"])

_EMAIL_RE = re.compile(r"^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$", re.I)
_MAX_NAME = 120
_MAX_MESSAGE = 4000
_MAX_PHONE = 40
_MAX_SUBJECT = 160


class ContactFormRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=_MAX_NAME)
    email: str = Field(..., min_length=5, max_length=200)
    phone: str = Field(default="", max_length=_MAX_PHONE)
    subject: str = Field(default="", max_length=_MAX_SUBJECT)
    message: str = Field(..., min_length=10, max_length=_MAX_MESSAGE)
    host: str | None = None
    website: str = Field(default="", max_length=200)  # honeypot — must stay empty


class ContactFormResponse(BaseModel):
    ok: bool = True
    detail: str = "Το μήνυμά σας στάλθηκε στο γραφείο."


def _effective_host(request: Request, host: str | None) -> str:
    raw = (host or "").strip() or (
        request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    ).split(",")[0].strip()
    return raw.split(":")[0].strip().lower()


def _apex(host: str) -> str:
    h = (host or "").strip().lower()
    if not h or h == "localhost":
        return ""
    parts = h.split(".")
    if len(parts) >= 3 and parts[0] == "www":
        return ".".join(parts[1:])
    return h


async def _resolve_office(request: Request, host: str | None) -> tuple[str, str, str]:
    """Return (tenant_id, office_email, office_name)."""
    effective = _effective_host(request, host)
    tenant_id = ""
    office_email = ""
    office_name = ""

    if effective:
        try:
            from app.core.database import AsyncSessionLocal
            from app.services.tenant_site_appearance_service import TenantSiteAppearanceService
            from olympus.tenant.domain_resolver import DomainResolver

            async with AsyncSessionLocal() as session:
                resolved = await DomainResolver(session).resolve(effective)
                if resolved:
                    tenant_id = str(resolved.tenant_id)
                    appearance = await TenantSiteAppearanceService(session).get_appearance(
                        resolved.tenant_id
                    )
                    office_email = str(appearance.get("footer_contact_email") or "").strip()
                    office_name = str(
                        appearance.get("footer_brand_name")
                        or appearance.get("display_name")
                        or ""
                    ).strip()
        except Exception:
            logger.debug("contact resolve host=%s failed", effective, exc_info=True)

    if not office_email:
        apex = _apex(effective)
        if apex and not apex.endswith("poreiago.com"):
            office_email = f"info@{apex}"

    if not office_email or "@" not in office_email:
        raise HTTPException(
            status_code=404,
            detail="Δεν βρέθηκε email επικοινωνίας για αυτό το γραφείο.",
        )

    return tenant_id, office_email, office_name or "Γραφείο"


@router.post("/api/site/contact", response_model=ContactFormResponse)
async def submit_public_contact(
    request: Request,
    body: ContactFormRequest,
    host: str | None = Query(default=None),
):
    # Honeypot — bots fill hidden "website"
    if str(body.website or "").strip():
        return ContactFormResponse(ok=True, detail="Το μήνυμά σας στάλθηκε στο γραφείο.")

    name = " ".join(str(body.name or "").split()).strip()
    email = str(body.email or "").strip().lower()
    phone = str(body.phone or "").strip()
    subject_in = " ".join(str(body.subject or "").split()).strip()
    message = str(body.message or "").strip()

    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Συμπληρώστε το όνομά σας.")
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Μη έγκυρο email.")
    if len(message) < 10:
        raise HTTPException(status_code=400, detail="Το μήνυμα είναι πολύ σύντομο.")

    tenant_id, office_email, office_name = await _resolve_office(
        request, body.host or host
    )

    topic = subject_in or "Μήνυμα από τη φόρμα επικοινωνίας"
    mail_subject = f"[Επικοινωνία] {topic} — {name}"
    safe_name = html.escape(name)
    safe_email = html.escape(email)
    safe_phone = html.escape(phone) if phone else "—"
    safe_topic = html.escape(topic)
    safe_message = html.escape(message).replace("\n", "<br/>")
    safe_office = html.escape(office_name)

    body_html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;color:#0f172a">
      <p style="margin:0 0 12px;font-size:15px">Νέο μήνυμα επικοινωνίας για <strong>{safe_office}</strong>.</p>
      <table style="border-collapse:collapse;width:100%;max-width:560px;font-size:14px">
        <tr><td style="padding:6px 0;color:#64748b;width:120px">Όνομα</td><td style="padding:6px 0"><strong>{safe_name}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Email</td><td style="padding:6px 0"><a href="mailto:{safe_email}">{safe_email}</a></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Τηλέφωνο</td><td style="padding:6px 0">{safe_phone}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Θέμα</td><td style="padding:6px 0">{safe_topic}</td></tr>
      </table>
      <div style="margin-top:16px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8">Μήνυμα</p>
        <p style="margin:0;font-size:15px">{safe_message}</p>
      </div>
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Απαντήστε απευθείας στο {safe_email}</p>
    </div>
    """

    try:
        from ticketing.email_dispatch import send_email

        ref = await send_email(
            office_email,
            mail_subject,
            body_html,
            tenant_id=tenant_id or None,
        )
        logger.info(
            "Public contact form sent to=%s tenant=%s ref=%s from=%s",
            office_email,
            tenant_id or "-",
            ref,
            email,
        )
    except Exception as exc:
        logger.exception("Public contact form failed to=%s: %s", office_email, exc)
        raise HTTPException(
            status_code=502,
            detail="Αποτυχία αποστολής. Δοκιμάστε ξανά σε λίγο ή στείλτε email απευθείας.",
        ) from exc

    return ContactFormResponse()
