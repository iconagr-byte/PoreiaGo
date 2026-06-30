"""Αντικατάσταση δυναμικών μεταβλητών σε HTML email templates."""

from __future__ import annotations

import html
import re
from typing import Any

from .store import list_active_products

_VAR_PATTERN = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


def build_product_list_html(products: list[dict] | None = None) -> str:
    items = products if products is not None else []
    if not items:
        return "<p><em>Δεν υπάρχουν διαθέσιμα προϊόντα αυτή τη στιγμή.</em></p>"

    blocks = ['<table cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">']
    for p in items:
        title = html.escape(str(p.get("title") or "Προϊόν"))
        price = float(p.get("price") or 0)
        img = p.get("image_url") or ""
        desc = html.escape(str(p.get("description") or ""))
        img_block = (
            f'<img src="{html.escape(img)}" alt="{title}" width="120" '
            f'style="border-radius:12px;display:block;margin-bottom:8px;" />'
            if img
            else ""
        )
        desc_block = (
            f'<br/><span style="font-size:13px;color:#64748b;">{desc}</span>' if desc else ""
        )
        blocks.append(
            f'<tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">'
            f"{img_block}"
            f'<strong style="font-size:16px;color:#0f172a;">{title}</strong><br/>'
            f'<span style="color:#059669;font-weight:bold;">€{price:.2f}</span>'
            f"{desc_block}"
            f"</td></tr>"
        )
    blocks.append("</table>")
    return "".join(blocks)


async def build_default_context(
    *,
    client_name: str = "",
    client_email: str = "",
    company_name: str = "AeroStride Travel",
    include_products: bool = True,
) -> dict[str, str]:
    products = await list_active_products() if include_products else []
    return {
        "client_name": client_name or "Πελάτη",
        "client_email": client_email,
        "company_name": company_name,
        "product_list": build_product_list_html(products),
    }


def render_template(body: str, context: dict[str, Any]) -> str:
    """Αντικαθιστά {{variable}} με τιμές από context."""

    def repl(match: re.Match) -> str:
        key = match.group(1)
        val = context.get(key, "")
        return str(val) if val is not None else ""

    return _VAR_PATTERN.sub(repl, body or "")


def extract_variables_from_text(text: str) -> list[str]:
    return list(dict.fromkeys(_VAR_PATTERN.findall(text or "")))
