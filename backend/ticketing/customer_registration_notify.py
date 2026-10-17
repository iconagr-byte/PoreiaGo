"""Notify office + customer when a My Wallet account is created."""

from __future__ import annotations

import logging
from html import escape

from ticketing.email_dispatch import send_email

logger = logging.getLogger(__name__)


def _admin_email_for_tenant(tenant_id: str | None) -> str:
    try:
        from travel_platform.settings.payment_settings_store import read_payment_settings

        security = read_payment_settings(tenant_id).get("security") or {}
        email = str(security.get("admin_notification_email") or "").strip().lower()
        if email and "@" in email:
            return email
    except Exception:
        logger.debug("admin_notification_email lookup failed", exc_info=True)
    return ""


def _office_label(tenant_id: str | None) -> str:
    tid = str(tenant_id or "").strip()
    if not tid:
        return "το γραφείο"
    try:
        from travel_platform.settings.platform_store import get_platform_config

        cfg = get_platform_config() or {}
        tenants = cfg.get("tenants") or cfg.get("offices") or []
        if isinstance(tenants, list):
            for row in tenants:
                if not isinstance(row, dict):
                    continue
                if str(row.get("id") or row.get("tenant_id") or "").strip() != tid:
                    continue
                name = str(row.get("display_name") or row.get("name") or "").strip()
                if name:
                    return name
    except Exception:
        logger.debug("office label lookup failed", exc_info=True)
    return "το γραφείο"


def _sync_office_crm(account: dict, tenant_id: str | None, *, method: str) -> None:
    tid = str(tenant_id or "").strip()
    email = str(account.get("email") or "").strip().lower()
    if not tid or not email or "@" not in email:
        return
    try:
        from travel_platform.settings.office_customers_store import upsert_customer

        upsert_customer(
            tid,
            {
                "email": email,
                "name": account.get("name") or email.split("@")[0],
                "phone": account.get("phone") or "",
                "picture": account.get("picture") or "",
                "authProvider": account.get("auth_provider") or method or "email",
                "source": "wallet_register",
                "serviceScope": "buses",
                "tags": ["wallet", "εγγραφή"],
                "notes": "Εγγραφή My Wallet",
            },
        )
    except Exception:
        logger.warning("office CRM sync failed for %s", email, exc_info=True)


async def _email_customer(account: dict, *, office_label: str, method: str) -> None:
    email = str(account.get("email") or "").strip().lower()
    if not email or "@" not in email:
        return
    name = escape(str(account.get("name") or email.split("@")[0]))
    office = escape(office_label)
    provider = "Google" if method == "google" else "email"
    subject = f"Καλώς ήρθατε στο My Wallet — {office_label}"
    html = f"""<!DOCTYPE html><html lang="el"><body style="font-family:Arial,sans-serif;padding:24px;background:#f5f5f7;color:#1d1d1f;">
      <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:20px;padding:28px;border:1px solid #e5e5ea;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#0f4c81;">My Wallet</p>
        <h1 style="margin:0 0 12px;font-size:22px;">Γεια σας, {name}</h1>
        <p style="margin:0 0 16px;line-height:1.55;color:#424245;">
          Ο λογαριασμός σας δημιουργήθηκε με επιτυχία ({provider}) και συνδέθηκε με
          <strong>{office}</strong>. Από το My Wallet βλέπετε εισιτήρια και κρατήσεις σας.
        </p>
        <p style="margin:0;font-size:12px;color:#86868b;">Αν δεν κάνατε εσείς την εγγραφή, αγνοήστε αυτό το μήνυμα.</p>
      </div>
    </body></html>"""
    await send_email(email, subject, html)


async def _email_office(account: dict, *, tenant_id: str | None, office_label: str, method: str) -> None:
    to_email = _admin_email_for_tenant(tenant_id)
    if not to_email:
        return
    email = escape(str(account.get("email") or ""))
    name = escape(str(account.get("name") or "—"))
    provider = "Google" if method == "google" else "Email & κωδικός"
    subject = f"Νέα εγγραφή πελάτη — {account.get('email') or 'My Wallet'}"
    html = f"""<!DOCTYPE html><html lang="el"><body style="font-family:Arial,sans-serif;padding:24px;">
      <h2 style="margin:0 0 12px;">Νέα εγγραφή My Wallet</h2>
      <p style="margin:0 0 8px;">Γραφείο: <strong>{escape(office_label)}</strong></p>
      <ul style="padding-left:18px;line-height:1.6;">
        <li>Ονοματεπώνυμο: {name}</li>
        <li>Email: {email}</li>
        <li>Μέθοδος: {provider}</li>
        <li>Κωδικός πελάτη: {escape(str(account.get('customer_id') or '—'))}</li>
      </ul>
      <p style="font-size:12px;color:#64748b;">Εμφανίζεται και στο μενού «Εγγραφές πελατών» του backoffice.</p>
    </body></html>"""
    await send_email(to_email, subject, html)


async def notify_customer_registration(
    account: dict | None,
    *,
    tenant_id: str | None,
    method: str = "email",
) -> None:
    """
    After a new Wallet account is created:
    1) upsert into office CRM
    2) welcome email to the customer
    3) notification email to the office (admin_notification_email)
    """
    if not account:
        return
    office_label = _office_label(tenant_id)
    _sync_office_crm(account, tenant_id, method=method)
    try:
        await _email_customer(account, office_label=office_label, method=method)
    except Exception:
        logger.warning("customer welcome email failed", exc_info=True)
    try:
        await _email_office(
            account, tenant_id=tenant_id, office_label=office_label, method=method
        )
    except Exception:
        logger.warning("office registration email failed", exc_info=True)
