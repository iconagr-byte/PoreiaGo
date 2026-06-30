"""
Luxury HTML email templates — header images, product icons, inline CSS.

  cd backend && python -m email_marketing.seed_templates --force
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

from ticketing.db import get_db, init_ticketing_db, close_ticketing_db

from .graphic_assets import (
    BTN_RADIUS,
    BTN_SHADOW,
    HEADER_IMAGES,
    PRODUCT_ICON_PLACEHOLDER,
    header_image_html,
    product_icon_html,
    product_image_block_html,
)


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _cta_button(label: str, href: str = "{{checkout_base_url}}", *, bg: str = "#7c3aed") -> str:
    return f"""
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 8px auto;">
<tr><td align="center" style="border-radius:{BTN_RADIUS};background-color:{bg};box-shadow:{BTN_SHADOW};">
<a href="{href}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:{BTN_RADIUS};letter-spacing:0.02em;">{label}</a>
</td></tr>
</table>"""


def _shell(inner_html: str, *, header_key: str = "default", preheader: str = "") -> str:
    hero = header_image_html(HEADER_IMAGES.get(header_key, HEADER_IMAGES["default"]))
    pre = (
        f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#0f172a;line-height:1px;">{preheader}</div>'
        if preheader
        else ""
    )
    return f"""<!DOCTYPE html>
<html lang="el" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<title>AeroStride Travel</title>
</head>
<body style="margin:0;padding:0;width:100%!important;background-color:#0f172a;-webkit-text-size-adjust:100%;font-family:'Segoe UI',Inter,Helvetica,Arial,sans-serif;">
{pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f172a;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.35);">
<tr><td style="padding:0;">{hero}</td></tr>
<tr><td style="padding:32px 28px 24px 28px;">
{inner_html}
</td></tr>
<tr><td style="padding:18px 28px 24px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">{{{{company_name}}}} &middot; <a href="{{{{unsubscribe_url}}}}" style="color:#94a3b8;">Unsubscribe</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""


# --- Template bodies ---

_WELCOME_INNER = f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="56" valign="top">{product_icon_html(PRODUCT_ICON_PLACEHOLDER)}</td>
<td style="padding-left:12px;">
<p style="margin:0 0 4px 0;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Καλωσόρισμα</p>
<h1 style="margin:0;font-size:26px;line-height:1.25;color:#0f172a;font-weight:700;">Γεια σου, {{{{client_name}}}}!</h1>
</td></tr></table>
<p style="margin:20px 0;font-size:16px;line-height:1.65;color:#475569;">Χαιρόμαστε που είσαι μαζί μας. <strong style="color:#7c3aed;">10% έκπτωση</strong> στην πρώτη σου κράτηση.</p>
<table role="presentation" width="100%" style="margin:0 0 24px 0;background:linear-gradient(135deg,#f5f3ff,#ede9fe);border-radius:8px;border:1px solid #ddd6fe;">
<tr><td style="padding:22px;text-align:center;">
<p style="margin:0 0 6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#7c3aed;font-weight:700;">Κωδικός</p>
<p style="margin:0;font-size:28px;font-weight:800;color:#5b21b6;letter-spacing:0.1em;">WELCOME10</p>
</td></tr>
</table>
{_cta_button("Κλείσε την προσφορά σου")}
"""

_FLASH_PRODUCT_DEMO = f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;box-shadow:{BTN_SHADOW};border:1px solid #fecaca;">
<tr><td style="padding:0;">{product_image_block_html(HEADER_IMAGES["flash_sale"], alt="Flash offer", width=536)}</td></tr>
<tr><td style="padding:20px;text-align:center;background:#fffafa;">
<table role="presentation" align="center"><tr>
<td width="48">{product_icon_html(PRODUCT_ICON_PLACEHOLDER)}</td>
<td style="padding-left:12px;text-align:left;">
<p style="margin:0;font-size:13px;color:#94a3b8;text-decoration:line-through;">€49.00</p>
<p style="margin:4px 0 0 0;font-size:28px;font-weight:800;color:#dc2626;">€35.00</p>
<p style="margin:4px 0 0 0;font-size:15px;color:#0f172a;font-weight:600;">Premium Express Route</p>
</td></tr></table>
</td></tr>
</table>
"""

_FLASH_INNER = f"""
<table role="presentation" width="100%" style="margin:0 0 16px 0;"><tr><td align="center" style="padding:6px 14px;background:#fef2f2;border-radius:8px;">
<span style="font-size:11px;font-weight:800;color:#dc2626;letter-spacing:0.14em;text-transform:uppercase;">Flash Sale · 48h</span>
</td></tr></table>
<h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.3;color:#0f172a;font-weight:800;text-align:center;">Μην το χάσεις!</h1>
<p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#64748b;text-align:center;">Επιλεγμένη προσφορά — περιορισμένο απόθεμα.</p>
<div style="margin:0 0 8px 0;">{_FLASH_PRODUCT_DEMO}</div>
{_cta_button("Αγόρασε τώρα", bg="#dc2626")}
"""

_WINBACK_INNER = f"""
<p style="margin:0 0 6px 0;font-size:14px;color:#64748b;">Γεια σου {{{{client_name}}}},</p>
<h1 style="margin:0 0 16px 0;font-size:22px;color:#0f172a;font-weight:600;">Μας έλειψες.</h1>
<p style="margin:0 0 20px 0;font-size:16px;line-height:1.7;color:#475569;">Έχει καιρό να ταξιδέψεις μαζί μας. Έχουμε <strong>νέες διαδρομές</strong> που σε περιμένουν.</p>
<table role="presentation" width="100%" style="margin:0 0 24px 0;border-radius:8px;overflow:hidden;box-shadow:{BTN_SHADOW};">
<tr><td style="padding:0;">{product_image_block_html(HEADER_IMAGES["winback"], alt="Νέες αφίξεις", width=536)}</td></tr>
</table>
{_cta_button("Δες τις Νέες Αφίξεις", "{{checkout_base_url}}/trips")}
"""

_STOCK_INNER = f"""
<h1 style="margin:0 0 8px 0;font-size:28px;line-height:1.2;color:#0f172a;font-weight:800;text-align:center;">Το ζήτησες, το φέραμε!</h1>
<p style="margin:0 0 20px 0;font-size:15px;color:#64748b;text-align:center;">Περιορισμένο απόθεμα — κράτησε τώρα.</p>
<table role="presentation" width="100%" style="border-radius:8px;overflow:hidden;box-shadow:{BTN_SHADOW};border:1px solid #e2e8f0;">
<tr><td style="padding:0;">
<!-- placeholder: αντικαθίσταται από inventory API -->
{product_image_block_html("{{product_image}}", alt="{{product_name}}", width=536)}
</td></tr>
<tr><td style="padding:20px;text-align:center;">
<table role="presentation" align="center"><tr>
<td width="48">{product_icon_html(PRODUCT_ICON_PLACEHOLDER)}</td>
<td style="padding-left:12px;text-align:left;">
<h2 style="margin:0;font-size:20px;color:#0f172a;">{{{{product_name}}}}</h2>
<p style="margin:6px 0 0 0;font-size:13px;color:#dc2626;font-weight:700;">Λίγες θέσεις διαθέσιμες</p>
</td></tr></table>
</td></tr>
</table>
{_cta_button("Κράτησε τώρα")}
"""


PRODUCTION_EMAIL_TEMPLATES: list[dict] = [
    {
        "id": "TPL-WELCOME",
        "name": "Welcome Email",
        "subject": "Καλώς ήρθες, {{client_name}} — δώρο 10%",
        "preheader": "WELCOME10 — η έκπτωση καλωσορίσματος σε περιμένει",
        "body_html": _shell(_WELCOME_INNER, header_key="welcome", preheader="WELCOME10 — η έκπτωση καλωσορίσματος σε περιμένει"),
        "variables": ["client_name", "company_name", "checkout_base_url", "header_image", "unsubscribe_url"],
    },
    {
        "id": "TPL-FLASH-SALE",
        "name": "Flash Sale 48h",
        "subject": "⚡ Flash Sale 48h — {{client_name}}",
        "preheader": "48 ώρες — περιορισμένες θέσεις",
        "body_html": _shell(
            _FLASH_INNER.replace("{{dynamic_product_block}}", ""),
            header_key="flash_sale",
            preheader="48 ώρες — περιορισμένες θέσεις",
        ),
        "variables": ["client_name", "dynamic_product_block", "company_name", "checkout_base_url", "header_image"],
    },
    {
        "id": "TPL-WINBACK",
        "name": "Win-Back / We Missed You",
        "subject": "{{client_name}}, μας έλειψες",
        "preheader": "Νέες αφίξεις AeroStride",
        "body_html": _shell(_WINBACK_INNER, header_key="winback", preheader="Νέες αφίξεις AeroStride"),
        "variables": ["client_name", "company_name", "checkout_base_url", "header_image"],
    },
    {
        "id": "TPL-BACK-STOCK",
        "name": "Back in Stock",
        "subject": "Διαθέσιμο ξανά: {{product_name}}",
        "preheader": "Περιορισμένο απόθεμα",
        "body_html": _shell(_STOCK_INNER, header_key="back_in_stock", preheader="Περιορισμένο απόθεμα"),
        "variables": ["product_name", "product_image", "client_name", "company_name", "checkout_base_url", "header_image"],
    },
]


async def seed_production_email_templates(*, force_update: bool = False) -> dict:
    db = get_db()
    now = _now()
    inserted = updated = skipped = 0
    for tpl in PRODUCTION_EMAIL_TEMPLATES:
        cur = await db.execute("SELECT id FROM email_templates WHERE id = ?", (tpl["id"],))
        exists = await cur.fetchone()
        vars_json = json.dumps(tpl["variables"], ensure_ascii=False)
        if exists and not force_update:
            skipped += 1
            continue
        if exists:
            await db.execute(
                "UPDATE email_templates SET name=?, subject=?, body_html=?, variables_json=?, updated_at=? WHERE id=?",
                (tpl["name"], tpl["subject"], tpl["body_html"], vars_json, now, tpl["id"]),
            )
            updated += 1
        else:
            await db.execute(
                "INSERT INTO email_templates (id, name, subject, body_html, variables_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
                (tpl["id"], tpl["name"], tpl["subject"], tpl["body_html"], vars_json, now, now),
            )
            inserted += 1
    await db.commit()
    return {"inserted": inserted, "updated": updated, "skipped": skipped, "total": len(PRODUCTION_EMAIL_TEMPLATES)}


async def _run_cli() -> None:
    await init_ticketing_db()
    from .store import init_email_marketing_tables

    await init_email_marketing_tables()
    import sys

    result = await seed_production_email_templates(force_update="--force" in sys.argv)
    print("Seed email templates:", result)
    await close_ticketing_db()


if __name__ == "__main__":
    asyncio.run(_run_cli())
