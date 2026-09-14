"""REST API — Marketing Automation & Campaigns."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from email_marketing import store
from email_marketing.campaign_compiler import compile_blocks_to_html
from email_marketing.segments import list_segments_with_counts
from email_marketing.subject_ai import generate_subject_lines
from email_marketing.auto_responder import test_rule_against_text
from email_client.dynamic_mailer import send_email_smtp
from email_client.marketing_send import send_marketing_campaign
from email_client.settings_store import get_settings_for_send
from email_client.store import get_campaign_metrics
from email_marketing.imap_service import poll_inbox_and_auto_reply
from email_marketing.products_catalog import (
    get_inventory_product_email_html,
    get_products_for_template,
    product_snippet_html,
)
from email_client.tracking import public_api_base
from email_marketing.schemas import (
    AutoResponderRuleCreate,
    AutoResponderRuleOut,
    AutoResponderRuleUpdate,
    CampaignSendRequest,
    CampaignSendResult,
    CampaignTestSendRequest,
    CampaignTestSendResult,
    EmailCampaignCreate,
    EmailCampaignOut,
    EmailCampaignUpdate,
    EmailTemplateCreate,
    EmailTemplateOut,
    EmailTemplateUpdate,
    GenerateSubjectRequest,
    GenerateSubjectResponse,
    ImapPollResult,
    InventoryProductOut,
    ProductForTemplate,
    SegmentOut,
)

router = APIRouter(tags=["Email Marketing"])
logger = logging.getLogger(__name__)

_PLATFORM_BRAND_RE = re.compile(r"^(aerostride|poreiago)$", re.I)
_PLATFORM_LOGO_RE = re.compile(r"poreiago|aerostride", re.I)


def _absolute_asset_url(url: str, *, base: str) -> str:
    value = (url or "").strip()
    if not value:
        return ""
    if value.startswith(("data:", "http://", "https://")):
        return value
    if value.startswith("/") and base:
        return f"{base.rstrip('/')}{value}"
    return value


def _brand_from_appearance(appearance: dict, *, base: str) -> dict:
    raw_logo = str(appearance.get("logo_url") or "").strip()
    logo_url = ""
    if raw_logo:
        is_tenant_upload = (
            raw_logo.startswith("data:image/")
            or raw_logo.startswith("/api/site/assets/")
            or raw_logo.startswith("/api/site/office-assets/")
        )
        if is_tenant_upload or not _PLATFORM_LOGO_RE.search(raw_logo):
            logo_url = _absolute_asset_url(raw_logo, base=base)

    raw_name = (
        appearance.get("footer_brand_name")
        or appearance.get("rent_office_name")
        or appearance.get("display_name")
        or ""
    )
    name = str(raw_name).strip()
    if not name or _PLATFORM_BRAND_RE.match(name):
        name = "Γραφείο"
    return {"logo_url": logo_url, "name": name}


async def _office_email_brand(request: Request | None = None) -> dict:
    """Resolve office logo/name for campaign HTML (never AeroStride placeholders)."""
    base = os.getenv("PUBLIC_APP_URL", "http://localhost:5173")
    try:
        if request is not None:
            from api.request_tenant import admin_tenant_id
            from app.core.database import AsyncSessionLocal
            from app.services.tenant_site_appearance_service import TenantSiteAppearanceService

            tid = admin_tenant_id(request)
            async with AsyncSessionLocal() as session:
                data = await TenantSiteAppearanceService(session).get_appearance(UUID(str(tid)))
                if isinstance(data, dict):
                    return _brand_from_appearance(data, base=base)
    except Exception:
        logger.debug("office email brand resolve skipped", exc_info=True)

    try:
        from api.site_appearance_router import _read_appearance

        return _brand_from_appearance(_read_appearance() or {}, base=base)
    except Exception:
        return {"logo_url": "", "name": "Γραφείο"}


async def _background_send_campaign(
    campaign_id: str,
    *,
    audience: str | None,
    subscriber_list: str | None,
    email_settings_id: str | None,
) -> None:
    try:
        await send_marketing_campaign(
            campaign_id,
            audience=audience,
            subscriber_list=subscriber_list,
            email_settings_id=email_settings_id,
        )
        logger.info("Background campaign send completed: %s", campaign_id)
    except Exception:
        logger.exception("Background campaign send failed: %s", campaign_id)


# --- Templates ---

@router.get("/api/email/templates", response_model=list[EmailTemplateOut])
async def list_templates():
    return await store.list_templates()


@router.post("/api/email/templates", response_model=EmailTemplateOut)
async def create_template(body: EmailTemplateCreate):
    return await store.create_template(body.model_dump())


@router.patch("/api/email/templates/{template_id}", response_model=EmailTemplateOut)
async def update_template(template_id: str, body: EmailTemplateUpdate):
    updated = await store.update_template(template_id, body.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Template not found")
    return updated


# --- Campaigns ---

@router.get("/api/campaigns", response_model=list[EmailCampaignOut])
async def list_campaigns():
    return await store.list_campaigns()


@router.get("/api/campaigns/segments", response_model=list[SegmentOut])
async def campaign_segments():
    """Μέτρηση πελατών ανά audience filter."""
    return await list_segments_with_counts()


@router.get("/api/campaigns/tracking-pixel")
async def tracking_pixel_info():
    """Πληροφορίες για 1x1 open tracking pixel (διαφανές GIF)."""
    base = public_api_base()
    return {
        "format": "image/gif",
        "size": "1x1",
        "transparent": True,
        "url_pattern": f"{base}/api/track/open/{{tracking_token}}.gif",
        "description": "Ενσωματώνεται αυτόματα κατά την αποστολή καμπάνιας.",
    }


@router.get("/api/campaigns/inventory/{product_id}/email-block")
async def inventory_product_email_block(product_id: str):
    """HTML block προϊόντος με aspect ratio 4:3 για τον editor."""
    data = await get_inventory_product_email_html(product_id)
    if not data:
        raise HTTPException(status_code=404, detail="Product not found")
    return data


@router.get("/api/campaigns/inventory", response_model=list[InventoryProductOut])
async def campaign_inventory():
    """Προϊόντα για block «Προσφορά» — inventory / marketing catalog."""
    items = await get_products_for_template()
    base = os.getenv("PUBLIC_APP_URL", "http://localhost:5173")
    out = []
    for p in items:
        row = {**p, "buy_url": f"{base.rstrip('/')}/trips"}
        out.append(InventoryProductOut(**row))
    return out


@router.post("/api/campaigns/test-send", response_model=CampaignTestSendResult)
async def test_send_campaign(request: Request, body: CampaignTestSendRequest):
    """Αποστολή δοκιμαστικού email σε έναν παραλήπτη (χωρίς μαζική καμπάνια)."""
    to = body.to_email.strip()
    if "@" not in to or "." not in to.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Μη έγκυρο email δοκιμής")

    base = os.getenv("PUBLIC_APP_URL", "http://localhost:5173")
    html = body.body_html or ""
    if body.blocks:
        brand = await _office_email_brand(request)
        html = compile_blocks_to_html(
            body.blocks,
            preheader=body.preheader or "",
            checkout_base=base,
            brand=brand,
        )
    if not html.strip():
        raise HTTPException(status_code=400, detail="Κενό περιεχόμενο email")

    subject = body.subject.strip()
    if not subject.upper().startswith("[TEST]"):
        subject = f"[TEST] {subject}"

    try:
        account = await get_settings_for_send(body.email_settings_id)
        await send_email_smtp(account, to=to, subject=subject, body_html=html)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Αποτυχία αποστολής test: {exc}") from exc

    return CampaignTestSendResult(
        ok=True,
        to=to,
        from_address=account.get("email_address") or "",
        subject=subject,
    )


@router.post("/api/campaigns/generate-subject", response_model=GenerateSubjectResponse)
async def generate_subject_lines_endpoint(body: GenerateSubjectRequest):
    result = await generate_subject_lines(
        body_html=body.body_html,
        campaign_name=body.campaign_name,
        preheader=body.preheader,
    )
    return GenerateSubjectResponse(**result)


@router.get("/api/campaigns/products-for-template", response_model=list[ProductForTemplate])
async def products_for_template():
    items = await get_products_for_template()
    return [ProductForTemplate(**p) for p in items]


@router.get("/api/campaigns/products-for-template/{product_id}/snippet")
async def product_snippet(product_id: str):
    items = await get_products_for_template()
    product = next((p for p in items if p["id"] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    base = os.getenv("PUBLIC_APP_URL", "http://localhost:5173")
    return {"html": product_snippet_html(product, base)}


@router.post("/api/campaigns", response_model=EmailCampaignOut)
async def create_campaign(request: Request, body: EmailCampaignCreate):
    data = body.model_dump()
    blocks = data.pop("blocks", None)
    send_now = data.pop("send_now", False)
    subscriber_list = data.pop("subscriber_list", "subscribed_only")
    base = os.getenv("PUBLIC_APP_URL", "http://localhost:5173")

    if blocks:
        brand = await _office_email_brand(request)
        data["body_html"] = compile_blocks_to_html(
            blocks,
            preheader=data.get("preheader") or "",
            checkout_base=base,
            brand=brand,
        )
        data["blocks_json"] = json.dumps(blocks, ensure_ascii=False)

    campaign = await store.create_campaign(data)

    if send_now:
        asyncio.create_task(
            _background_send_campaign(
                campaign["id"],
                audience=campaign.get("audience_filter"),
                subscriber_list=subscriber_list,
                email_settings_id=campaign.get("email_settings_id"),
            )
        )

    return campaign


@router.get("/api/campaigns/{campaign_id}", response_model=EmailCampaignOut)
async def get_campaign(campaign_id: str):
    c = await store.get_campaign(campaign_id)
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return c


@router.patch("/api/campaigns/{campaign_id}", response_model=EmailCampaignOut)
async def update_campaign(campaign_id: str, request: Request, body: EmailCampaignUpdate):
    data = body.model_dump(exclude_unset=True)
    blocks = data.pop("blocks", None)
    base = os.getenv("PUBLIC_APP_URL", "http://localhost:5173")

    if blocks is not None:
        existing = await store.get_campaign(campaign_id)
        preheader = data.get("preheader")
        if preheader is None and existing:
            preheader = existing.get("preheader") or ""
        brand = await _office_email_brand(request)
        data["body_html"] = compile_blocks_to_html(
            blocks,
            preheader=preheader or "",
            checkout_base=base,
            brand=brand,
        )
        data["blocks_json"] = json.dumps(blocks, ensure_ascii=False)

    updated = await store.update_campaign(campaign_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return updated


@router.delete("/api/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str):
    ok = await store.delete_campaign(campaign_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"ok": True}


@router.post("/api/campaigns/send", response_model=CampaignSendResult)
async def send_campaign_bulk(body: CampaignSendRequest):
    """Μαζική αποστολή με tracking pixel + unsubscribe (GDPR)."""
    try:
        result = await send_marketing_campaign(
            body.campaign_id,
            batch_size=body.batch_size,
            audience=body.audience,
            subscriber_list=body.subscriber_list,
            email_settings_id=body.email_settings_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Send failed: {exc}") from exc
    batches = max(1, (result["total_recipients"] + body.batch_size - 1) // body.batch_size)
    return CampaignSendResult(
        ok=result["ok"],
        campaign_id=result["campaign_id"],
        total_recipients=result["total_recipients"],
        sent=result["sent"],
        failed=result["failed"],
        batches=batches,
    )


@router.get("/api/campaigns/{campaign_id}/metrics")
async def campaign_metrics(campaign_id: str):
    c = await store.get_campaign(campaign_id)
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    metrics = await get_campaign_metrics(campaign_id)
    return {**c, **metrics}


@router.post("/api/campaigns/{campaign_id}/send", response_model=CampaignSendResult)
async def send_campaign_endpoint(campaign_id: str, batch_size: int = 50):
    try:
        result = await send_marketing_campaign(campaign_id, batch_size=batch_size)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Send failed: {exc}") from exc
    batches = max(1, (result["total_recipients"] + batch_size - 1) // batch_size)
    return CampaignSendResult(
        ok=result["ok"],
        campaign_id=result["campaign_id"],
        total_recipients=result["total_recipients"],
        sent=result["sent"],
        failed=result["failed"],
        batches=batches,
    )


# --- Auto-responder rules ---

@router.get("/api/email/auto-responders", response_model=list[AutoResponderRuleOut])
async def list_auto_responders(active_only: bool = False):
    return await store.list_auto_responder_rules(active_only=active_only)


@router.post("/api/email/auto-responders", response_model=AutoResponderRuleOut)
async def create_auto_responder(body: AutoResponderRuleCreate):
    return await store.create_auto_responder_rule(body.model_dump())


@router.patch("/api/email/auto-responders/{rule_id}", response_model=AutoResponderRuleOut)
async def update_auto_responder(rule_id: str, body: AutoResponderRuleUpdate):
    updated = await store.update_auto_responder_rule(
        rule_id, body.model_dump(exclude_unset=True)
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Rule not found")
    return updated


@router.delete("/api/email/auto-responders/{rule_id}")
async def delete_auto_responder(rule_id: str):
    if not await store.delete_auto_responder_rule(rule_id):
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"ok": True}


@router.post("/api/email/auto-responders/{rule_id}/test")
async def test_auto_responder(rule_id: str, subject: str = "", body: str = ""):
    return await test_rule_against_text(rule_id, subject, body)


@router.post("/api/email/imap/poll", response_model=ImapPollResult)
async def poll_imap_inbox():
    """Χειροκίνητο pull εισερχόμενων + auto-reply (για cron ή admin κουμπί)."""
    result = await poll_inbox_and_auto_reply()
    return ImapPollResult(
        fetched=result["fetched"],
        auto_replied=result["auto_replied"],
        skipped=result["skipped"],
        errors=result.get("errors", []),
    )
