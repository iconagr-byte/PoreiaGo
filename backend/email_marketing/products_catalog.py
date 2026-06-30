"""Προϊόντα/υπηρεσίες — inventory HTML με σωστό aspect ratio."""

from __future__ import annotations

import html
import os

from .graphic_assets import BTN_RADIUS, BTN_SHADOW, PRODUCT_ICON_PLACEHOLDER, product_icon_html, product_image_block_html
from .store import list_active_products
from .template_renderer import build_product_list_html


async def get_products_for_template() -> list[dict]:
    return await list_active_products()


def _resolve_image(product: dict, base_url: str) -> str:
    img = product.get("image_url") or ""
    if img.startswith("/") and base_url:
        return base_url.rstrip("/") + img
    if img:
        return img
    return "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=600&fit=crop&q=80"


def product_email_block_html(
    product: dict,
    base_url: str = "",
    *,
    aspect_ratio: str = "4/3",
) -> str:
    """Πλήρες product block για editor & API — εικόνα 4:3 + icon + CTA."""
    title = html.escape(str(product.get("title") or "Προϊόν"))
    price = float(product.get("price") or 0)
    desc = html.escape(str(product.get("description") or ""))
    stock = product.get("stock")
    img = _resolve_image(product, base_url)
    buy = html.escape(str(product.get("buy_url") or f"{base_url.rstrip('/')}/trips"))
    stock_line = (
        f'<p style="margin:6px 0 0 0;font-size:12px;color:#64748b;">Διαθέσιμο: {int(stock)} τεμ.</p>'
        if stock is not None
        else ""
    )
    hero = product_image_block_html(img, alt=product.get("title") or "", width=536, aspect_ratio=aspect_ratio)
    icon = product_icon_html(PRODUCT_ICON_PLACEHOLDER, size=44)
    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border-radius:8px;overflow:hidden;box-shadow:{BTN_SHADOW};border:1px solid #e2e8f0;">
<tr><td style="padding:0;">{hero}</td></tr>
<tr><td style="padding:18px 20px;background:#ffffff;">
<table role="presentation" width="100%"><tr>
<td width="48" valign="top">{icon}</td>
<td style="padding-left:12px;">
<h3 style="margin:0;font-size:18px;color:#0f172a;">{title}</h3>
<p style="margin:6px 0 0 0;font-size:20px;color:#059669;font-weight:700;">€{price:.2f}</p>
{f'<p style="margin:6px 0 0 0;font-size:13px;color:#64748b;">{desc}</p>' if desc else ''}
{stock_line}
</td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:16px auto 4px auto;">
<tr><td style="border-radius:{BTN_RADIUS};background-color:#7c3aed;box-shadow:{BTN_SHADOW};">
<a href="{buy}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;border-radius:{BTN_RADIUS};">Αγορά</a>
</td></tr></table>
</td></tr></table>"""


def product_snippet_html(product: dict, base_url: str = "") -> str:
    return product_email_block_html(product, base_url)


async def get_inventory_product_email_html(product_id: str) -> dict | None:
    items = await get_products_for_template()
    product = next((p for p in items if p["id"] == product_id), None)
    if not product:
        return None
    base = os.getenv("PUBLIC_APP_URL", "http://localhost:5173")
    product = {**product, "buy_url": f"{base.rstrip('/')}/trips"}
    return {
        "product": product,
        "html": product_email_block_html(product, base),
        "aspect_ratio": "4/3",
    }
