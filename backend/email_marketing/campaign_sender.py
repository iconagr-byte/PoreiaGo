"""Μαζική αποστολή καμπανιών — batching + variable substitution."""

from __future__ import annotations

import asyncio
import logging

from ticketing.email_dispatch import send_email

from .audience_resolver import resolve_audience
from .constants import CAMPAIGN_STATUS_SENT, DEFAULT_BATCH_SIZE
from .store import get_campaign, mark_campaign_sent
from .template_renderer import build_default_context, render_template

logger = logging.getLogger(__name__)


async def send_campaign(
    campaign_id: str,
    *,
    batch_size: int = DEFAULT_BATCH_SIZE,
    delay_between_batches_sec: float = 1.0,
) -> dict:
    campaign = await get_campaign(campaign_id)
    if not campaign:
        raise ValueError("Η καμπάνια δεν βρέθηκε")
    if campaign.get("status") == CAMPAIGN_STATUS_SENT:
        raise ValueError("Η καμπάνια έχει ήδη σταλεί")

    recipients = await resolve_audience(campaign.get("audience_filter", "all"))
    if not recipients:
        raise ValueError("Δεν βρέθηκαν παραλήπτες για το επιλεγμένο φίλτρο")

    sent = 0
    failed = 0
    batches = 0
    errors: list[str] = []

    for i in range(0, len(recipients), batch_size):
        batch = recipients[i : i + batch_size]
        batches += 1
        for rec in batch:
            email = rec["email"]
            name = rec.get("name") or email.split("@")[0]
            try:
                ctx = await build_default_context(
                    client_name=name,
                    client_email=email,
                    include_products=True,
                )
                subject = render_template(campaign["subject"], ctx)
                body = render_template(campaign["body_html"], ctx)
                await send_email(email, subject, body)
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
        "batches": batches,
        "errors_sample": errors[:10],
    }
    await mark_campaign_sent(campaign_id, stats)
    return {
        "ok": True,
        "campaign_id": campaign_id,
        **stats,
    }
