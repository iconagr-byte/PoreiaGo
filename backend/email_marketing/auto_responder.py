"""Auto-Responder — αντιστοίχιση λέξεων-κλειδιών και αυτόματη απάντηση."""

from __future__ import annotations

import logging
import re
import unicodedata

from .store import (
    get_auto_responder_rule,
    get_template,
    list_auto_responder_rules,
    log_inbound_processed,
)
from .template_renderer import build_default_context, render_template
from ticketing.email_dispatch import send_email

logger = logging.getLogger(__name__)


def parse_trigger_keywords(raw: str) -> list[str]:
    """Διαχωρισμός λέξεων-κλειδιών (κόμμα, ελληνικό κόμμα, newline)."""
    if not raw:
        return []
    parts = re.split(r"[,;\n]+", raw)
    return [normalize_keyword(p) for p in parts if normalize_keyword(p)]


def normalize_keyword(word: str) -> str:
    w = (word or "").strip().lower()
    w = unicodedata.normalize("NFD", w)
    return "".join(c for c in w if unicodedata.category(c) != "Mn")


def normalize_text_for_match(text: str) -> str:
    return normalize_keyword(text)


def find_matching_rule(
    subject: str,
    body: str,
    rules: list[dict] | None = None,
) -> dict | None:
    """
    Επιστρέφει τον πρώτο ενεργό κανόνα (χαμηλότερο priority number = υψηλότερη προτεραιότητα)
    που ταιριάζει σε subject ή body.
    """
    haystack = normalize_text_for_match(f"{subject or ''} {body or ''}")
    if not haystack:
        return None

    active_rules = rules if rules is not None else []
    sorted_rules = sorted(active_rules, key=lambda r: (r.get("priority", 100), r.get("name", "")))

    for rule in sorted_rules:
        if not rule.get("is_active"):
            continue
        keywords = parse_trigger_keywords(rule.get("trigger_keywords", ""))
        for kw in keywords:
            if kw and kw in haystack:
                return rule
    return None


async def build_response_html(rule: dict, sender_email: str, sender_name: str = "") -> str:
    """HTML απάντησης από rule ή linked template."""
    template_html = rule.get("response_template") or ""
    if rule.get("template_id"):
        tpl = await get_template(rule["template_id"])
        if tpl:
            template_html = tpl.get("body_html") or template_html

    ctx = await build_default_context(
        client_name=sender_name or sender_email.split("@")[0],
        client_email=sender_email,
        include_products=True,
    )
    return render_template(template_html, ctx)


async def process_inbound_message(
    *,
    from_addr: str,
    subject: str,
    body: str,
    message_id: str | None = None,
    sender_name: str = "",
) -> dict:
    """
    Ελέγχει κανόνες και στέλνει auto-reply αν ταιριάζει.
    Επιστρέφει {matched, rule_id, sent, reason}.
    """
    from_addr = (from_addr or "").strip().lower()
    if not from_addr or "@" not in from_addr:
        await log_inbound_processed(
            message_id=message_id,
            from_addr=from_addr or "unknown",
            subject=subject,
            body_preview=(body or "")[:500],
            matched_rule_id=None,
            auto_replied=False,
        )
        return {"matched": False, "sent": False, "reason": "invalid_sender"}

    rules = await list_auto_responder_rules(active_only=True)
    rule = find_matching_rule(subject, body, rules)

    if not rule:
        await log_inbound_processed(
            message_id=message_id,
            from_addr=from_addr,
            subject=subject,
            body_preview=(body or "")[:500],
            matched_rule_id=None,
            auto_replied=False,
        )
        return {"matched": False, "sent": False, "reason": "no_keyword_match"}

    reply_subject = f"Re: {subject}" if subject else f"AeroStride — {rule.get('name', 'Απάντηση')}"
    reply_html = await build_response_html(rule, from_addr, sender_name)

    try:
        ref = await send_email(from_addr, reply_subject, reply_html)
        await log_inbound_processed(
            message_id=message_id,
            from_addr=from_addr,
            subject=subject,
            body_preview=(body or "")[:500],
            matched_rule_id=rule["id"],
            auto_replied=True,
        )
        logger.info("Auto-reply sent to %s rule=%s ref=%s", from_addr, rule["id"], ref)
        return {
            "matched": True,
            "rule_id": rule["id"],
            "rule_name": rule.get("name"),
            "sent": True,
            "reference": ref,
        }
    except Exception as exc:
        logger.exception("Auto-reply failed to %s", from_addr)
        await log_inbound_processed(
            message_id=message_id,
            from_addr=from_addr,
            subject=subject,
            body_preview=(body or "")[:500],
            matched_rule_id=rule["id"],
            auto_replied=False,
        )
        return {"matched": True, "rule_id": rule["id"], "sent": False, "reason": str(exc)}


async def test_rule_against_text(rule_id: str, subject: str, body: str) -> dict:
    """Dry-run για admin UI."""
    rule = await get_auto_responder_rule(rule_id)
    if not rule:
        return {"matches": False, "reason": "rule_not_found"}
    match = find_matching_rule(subject, body, [rule])
    if not match:
        keywords = parse_trigger_keywords(rule.get("trigger_keywords", ""))
        return {"matches": False, "keywords_checked": keywords}
    preview = await build_response_html(rule, "test@example.com", "Test User")
    return {"matches": True, "rule_id": rule_id, "preview_html": preview}
