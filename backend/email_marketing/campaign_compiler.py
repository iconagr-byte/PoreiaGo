"""Μετατροπή content blocks → HTML email (με preheader)."""

from __future__ import annotations

import html
import json
from typing import Any

from .graphic_assets import BTN_RADIUS, BTN_SHADOW, HEADER_IMAGES, header_image_html
from .products_catalog import product_email_block_html


def product_block_html(product: dict, *, checkout_base: str = "http://localhost:5173") -> str:
    p = dict(product)
    if not p.get("buy_url"):
        p["buy_url"] = f"{checkout_base.rstrip('/')}/trips"
    return product_email_block_html(p, checkout_base)


def compile_block(block: dict, *, checkout_base: str = "http://localhost:5173") -> str:
    btype = block.get("type") or "text"
    if btype == "header":
        url = str(block.get("url") or HEADER_IMAGES.get("default", ""))
        alt = str(block.get("alt") or "AeroStride Travel")
        return header_image_html(url, alt=alt)
    if btype == "text":
        content = block.get("content") or "<p></p>"
        return f'<div style="margin:12px 0;line-height:1.6;color:#334155;">{content}</div>'
    if btype == "image":
        url = html.escape(str(block.get("url") or ""))
        alt = html.escape(str(block.get("alt") or ""))
        if not url:
            return ""
        return (
            f'<div style="margin:16px 0;text-align:center;border-radius:{BTN_RADIUS};overflow:hidden;">'
            f'<img src="{url}" alt="{alt}" style="max-width:100%;border-radius:{BTN_RADIUS};display:block;" /></div>'
        )
    if btype == "cta":
        label = html.escape(str(block.get("label") or "Μάθετε περισσότερα"))
        href = html.escape(str(block.get("href") or checkout_base))
        return f"""
<div style="margin:20px 0;text-align:center;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr><td style="border-radius:{BTN_RADIUS};background-color:#7c3aed;box-shadow:{BTN_SHADOW};">
<a href="{href}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;border-radius:{BTN_RADIUS};">{label}</a>
</td></tr></table>
</div>"""
    if btype == "product":
        return product_block_html(block.get("product") or block, checkout_base=checkout_base)
    return ""


def compile_blocks_to_html(
    blocks: list[dict],
    *,
    preheader: str = "",
    checkout_base: str = "http://localhost:5173",
) -> str:
    inner = "".join(compile_block(b, checkout_base=checkout_base) for b in blocks)
    pre = html.escape(preheader) if preheader else ""
    pre_span = (
        f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{pre}</div>'
        if pre
        else ""
    )
    return f"""<!DOCTYPE html>
<html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Segoe UI,Arial,sans-serif;">
{pre_span}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08);">
<tr><td style="padding:28px 24px;">{inner}</td></tr>
<tr><td style="padding:16px 24px;background:#f8fafc;text-align:center;font-size:11px;color:#94a3b8;">AeroStride Travel</td></tr>
</table></td></tr></table></body></html>"""


def blocks_from_json(raw: str | None) -> list[dict]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []
