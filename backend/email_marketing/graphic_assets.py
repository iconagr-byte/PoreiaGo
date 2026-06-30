"""Unsplash placeholders & HTML helpers για email graphics."""

from __future__ import annotations

import html

# Stable Unsplash URLs (w=1200, q=80) — travel / luxury mood
HEADER_IMAGES = {
    "welcome": "https://images.unsplash.com/photo-1469854523086-cc02afe5c88c?w=1200&h=400&fit=crop&q=80",
    "flash_sale": "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&h=400&fit=crop&q=80",
    "winback": "https://images.unsplash.com/photo-1488085068339-322f12c09edb?w=1200&h=400&fit=crop&q=80",
    "back_in_stock": "https://images.unsplash.com/photo-1544620537-6a68c34182b2?w=1200&h=400&fit=crop&q=80",
    "default": "https://images.unsplash.com/photo-1436491865339-7a61a109cc05?w=1200&h=400&fit=crop&q=80",
}

PRODUCT_ICON_PLACEHOLDER = (
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=96&h=96&fit=crop&q=80"
)

BTN_RADIUS = "8px"
BTN_SHADOW = "0 4px 14px rgba(15,23,42,0.18)"


def header_image_html(
    url: str,
    *,
    alt: str = "AeroStride Travel",
    height: int = 220,
) -> str:
    """Full-width header hero — placeholder {{header_image}}."""
    safe_url = html.escape(url)
    safe_alt = html.escape(alt)
    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:0;line-height:0;font-size:0;">
<img src="{safe_url}" alt="{safe_alt}" width="600" height="{height}"
  style="display:block;width:100%;max-width:600px;height:auto;min-height:{height}px;object-fit:cover;border-radius:8px 8px 0 0;" />
</td></tr>
<tr><td style="padding:16px 20px;background:linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%);border-bottom:1px solid #e2e8f0;">
<table role="presentation" width="100%"><tr>
<td style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#4f46e5;font-weight:700;">AeroStride Travel</td>
<td align="right" style="font-size:11px;color:#64748b;">Luxury Coach</td>
</tr></table>
</td></tr>
</table>"""


def product_icon_html(icon_url: str, *, size: int = 48) -> str:
    safe = html.escape(icon_url or PRODUCT_ICON_PLACEHOLDER)
    return (
        f'<img src="{safe}" alt="" width="{size}" height="{size}" '
        f'style="width:{size}px;height:{size}px;border-radius:8px;object-fit:cover;display:inline-block;vertical-align:middle;" />'
    )


def product_image_block_html(
    image_url: str,
    *,
    alt: str = "",
    width: int = 536,
    aspect_ratio: str = "4/3",
) -> str:
    """
    Product image με σταθερό aspect ratio (4:3) — χρήση σε templates & inventory API.
    """
    safe_url = html.escape(image_url or HEADER_IMAGES["default"])
    safe_alt = html.escape(alt or "Προϊόν")
    # Padding-bottom trick for email clients that support it; fixed height fallback
    pad_pct = "75%" if aspect_ratio == "4/3" else "56.25%"
    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
<tr><td align="center" style="padding:0;">
<table role="presentation" width="{width}" cellpadding="0" cellspacing="0" style="max-width:100%;width:100%;border-radius:8px;overflow:hidden;box-shadow:{BTN_SHADOW};">
<tr><td style="background-color:#e2e8f0;line-height:0;font-size:0;">
<!--[if mso]>
<img src="{safe_url}" alt="{safe_alt}" width="{width}" style="display:block;width:{width}px;" />
<![endif]-->
<!--[if !mso]><!-->
<div style="max-height:0;max-width:0;overflow:hidden;display:none;">&nbsp;</div>
<img src="{safe_url}" alt="{safe_alt}" width="{width}"
  style="display:block;width:100%;max-width:{width}px;height:auto;aspect-ratio:{aspect_ratio};object-fit:cover;border-radius:8px;" />
<!--<![endif]-->
</td></tr>
</table>
</td></tr>
</table>"""
