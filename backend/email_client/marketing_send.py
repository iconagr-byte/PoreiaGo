"""Μαζική αποστολή με tracking pixel + GDPR unsubscribe."""

from __future__ import annotations

import asyncio
import logging

from email_marketing.audience_resolver import resolve_audience
from email_marketing.constants import CAMPAIGN_STATUS_SENT
from email_marketing.store import get_campaign, mark_campaign_sent
from email_marketing.template_renderer import build_default_context, render_template
from .constants import CAMPAIGN_BATCH_SIZE
from .dynamic_mailer import send_email_smtp
from .settings_store import get_settings_for_send
from .store import create_send_log, get_subscriber_by_email, list_subscribers
from .tracking import inject_campaign_tracking

logger = logging.getLogger(__name__)


async def _resolve_recipients(
    campaign: dict,
    *,
    audience: str | None = None,
    subscriber_list: str | None = None,
) -> list[dict]:
    filt = audience or campaign.get("audience_filter", "all")
    if subscriber_list == "subscribed_only":
        subs = await list_subscribers(subscribed_only=True)
        return [{"email": s["email"], "name": s.get("name") or s["email"].split("@")[0]} for s in subs]
    recipients = await resolve_audience(filt)
    out = []
    for rec in recipients:
        email = rec["email"].strip().lower()
        sub = await get_subscriber_by_email(email)
        if sub and not sub["is_subscribed"]:
            continue
        out.append(rec)
    return out


async def send_marketing_campaign(
    campaign_id: str,
    *,
    batch_size: int = CAMPAIGN_BATCH_SIZE,
    audience: str | None = None,
    subscriber_list: str | None = None,
    email_settings_id: str | None = None,
    delay_between_batches_sec: float = 1.0,
) -> dict:
    campaign = await get_campaign(campaign_id)
    if not campaign:
        raise ValueError("Η καμπάνια δεν βρέθηκε")
    if campaign.get("status") == CAMPAIGN_STATUS_SENT:
        raise ValueError("Η καμπάνια έχει ήδη σταλεί")

    smtp_account = await get_settings_for_send(
        email_settings_id or campaign.get("email_settings_id")
    )

    recipients = await _resolve_recipients(
        campaign, audience=audience, subscriber_list=subscriber_list
    )
    if not recipients:
        raise ValueError("Δεν βρέθηκαν εγγεγραμμένοι παραλήπτες")

    sent = 0
    failed = 0
    errors: list[str] = []

    for i in range(0, len(recipients), batch_size):
        batch = recipients[i : i + batch_size]
        for rec in batch:
            email = rec["email"]
            name = rec.get("name") or email.split("@")[0]
            try:
                log = await create_send_log(campaign_id, email)
                ctx = await build_default_context(
                    client_name=name,
                    client_email=email,
                    include_products=True,
                )
                subject = render_template(campaign["subject"], ctx)
                body = render_template(campaign["body_html"], ctx)
                body = inject_campaign_tracking(body, tracking_token=log["tracking_token"])
                await send_email_smtp(smtp_account, to=email, subject=subject, body_html=body)
                sent += 1
            except Exception as exc:
                failed += 1
                errors.append(f"{email}: {exc}")
                logger.warning("Campaign send failed %s: %s", email, exc)

        if i + batch_size < len(recipients) and delay_between_batches_sec > 0:
            await asyncio.sleep(delay_between_batches_sec)

    stats = {
        "total_recipients": len(recipients),
        "sent": sent,
        "failed": failed,
        "errors_sample": errors[:10],
    }
    await mark_campaign_sent(campaign_id, stats)
    return {"ok": True, "campaign_id": campaign_id, **stats}
