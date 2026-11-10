"""Email επιβεβαίωσης κράτησης ενοικίασης — πελάτης (και προαιρετικά admin)."""

from __future__ import annotations

import logging
from typing import Any

from ticketing.bank_transfer_details import resolve_bank_transfer_details
from ticketing.email_dispatch import send_email

logger = logging.getLogger(__name__)


def _money(value: Any) -> str:
    try:
        return f"€{float(value):.2f}"
    except (TypeError, ValueError):
        return "—"


def _fmt_when(iso: Any) -> str:
    raw = str(iso or "").strip()
    if not raw:
        return "—"
    try:
        from datetime import datetime

        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return raw


def _read_notification_settings() -> dict[str, Any]:
    try:
        from travel_platform.settings.payment_settings_store import read_payment_settings

        security = read_payment_settings().get("security") or {}
    except Exception:
        security = {}
    return {
        "notify_customer": security.get("notify_customer_on_payment", True) is not False,
        "notify_admin": security.get("notify_admin_on_payment", True) is not False,
        "admin_email": str(security.get("admin_notification_email") or "").strip(),
    }


def _admin_recipient() -> str | None:
    cfg = _read_notification_settings()
    if cfg["admin_email"] and "@" in cfg["admin_email"]:
        return cfg["admin_email"].lower()
    try:
        from travel_platform.settings.platform_store import get_platform_config

        email = str(get_platform_config().support_email or "").strip().lower()
        if email and "@" in email:
            return email
    except Exception:
        pass
    import os

    env = os.getenv("ADMIN_NOTIFICATION_EMAIL", "").strip().lower()
    return env if env and "@" in env else None


def _wrap_html(title: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="el">
<head><meta charset="utf-8"><title>{title}</title></head>
<body style="margin:0;padding:0;background:#f0f7f6;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 28px rgba(11,61,74,.10);">
        <tr>
          <td style="background:linear-gradient(135deg,#0a7a6c,#0b3d4a);padding:24px 28px;color:#fff;">
            <div style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;opacity:.85;">Rent · PoreiaGo</div>
            <h1 style="margin:10px 0 0;font-size:20px;font-family:system-ui,-apple-system,sans-serif;">{title}</h1>
          </td>
        </tr>
        <tr><td style="padding:28px;color:#334155;font-size:14px;line-height:1.65;font-family:system-ui,-apple-system,sans-serif;">{body}</td></tr>
        <tr>
          <td style="padding:16px 28px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8;font-family:system-ui,-apple-system,sans-serif;">
            Rent · Μην απαντάτε αυτό το email
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _payment_block(booking: dict[str, Any]) -> str:
    status = str(booking.get("payment_status") or "").lower()
    label = booking.get("payment_label") or status or "—"
    total = _money(booking.get("total_cost"))
    paid = _money(booking.get("amount_paid"))
    balance = _money(booking.get("balance_due"))
    due_now = _money(booking.get("amount_due_now"))
    plan = str(booking.get("payment_plan") or "full")
    plan_label = (
        f"Προκαταβολή {booking.get('deposit_percent') or 30}%"
        if plan == "deposit"
        else "Πλήρης πληρωμή"
    )
    color = "#047857" if status == "paid" else ("#b45309" if status == "partial" else "#1d4ed8")
    bg = "#ecfdf5" if status == "paid" else ("#fffbeb" if status == "partial" else "#eff6ff")
    border = "#6ee7b7" if status == "paid" else ("#fcd34d" if status == "partial" else "#93c5fd")

    bank_html = ""
    if str(booking.get("payment_method") or "") == "bank_transfer" and status == "pending":
        bank = resolve_bank_transfer_details(
            {
                "id": booking.get("id"),
                "pnr": booking.get("id"),
                "customerName": booking.get("client_name"),
                "amountPaid": booking.get("amount_due_now") or booking.get("total_cost"),
            }
        )
        if bank.get("iban"):
            bank_html = f"""
            <div style="margin-top:14px;padding:14px 16px;background:#f8fafc;border-radius:12px;font-size:13px;color:#475569;">
              <p style="margin:0 0 8px;font-weight:600;color:#0f172a;">Οδηγίες τραπεζικής κατάθεσης</p>
              <p style="margin:0;">Τράπεζα: {bank.get('bank_name') or '—'}</p>
              <p style="margin:4px 0 0;">Δικαιούχος: {bank.get('beneficiary') or '—'}</p>
              <p style="margin:4px 0 0;">IBAN: <strong style="font-family:monospace;">{bank.get('iban_display')}</strong></p>
              {f"<p style='margin:4px 0 0;'>BIC: {bank.get('bic')}</p>" if bank.get('bic') else ""}
              <p style="margin:4px 0 0;">Αιτιολογία: <strong>{bank.get('reference')}</strong></p>
              {f"<p style='margin:8px 0 0;font-size:12px;color:#64748b;'>{bank.get('instructions')}</p>" if bank.get('instructions') else ""}
            </div>
            """

    return f"""
    <div style="margin:20px 0;padding:18px 20px;background:{bg};border:2px solid {border};border-radius:14px;">
      <p style="margin:0 0 10px;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;color:{color};">
        Πληρωμή · {label}
      </p>
      <table width="100%" style="font-size:14px;color:#0f172a;">
        <tr><td style="padding:4px 0;">Πλάνο</td><td style="padding:4px 0;text-align:right;">{plan_label}</td></tr>
        <tr><td style="padding:4px 0;">Σύνολο κράτησης</td><td style="padding:4px 0;text-align:right;"><strong>{total}</strong></td></tr>
        <tr><td style="padding:4px 0;">Πληρωμή τώρα</td><td style="padding:4px 0;text-align:right;">{due_now}</td></tr>
        <tr><td style="padding:4px 0;">Καταβληθέν</td><td style="padding:4px 0;text-align:right;">{paid}</td></tr>
        <tr><td style="padding:4px 0;">Υπόλοιπο στην παραλαβή</td><td style="padding:4px 0;text-align:right;">{balance}</td></tr>
      </table>
      {bank_html}
    </div>
    """


def _booking_body(booking: dict[str, Any], *, for_admin: bool = False) -> str:
    vehicle = f"{booking.get('vehicle_model') or 'Όχημα'}"
    if booking.get("vehicle_plate"):
        vehicle = f"{vehicle} ({booking['vehicle_plate']})"
    pickup = booking.get("pickup_location") or "—"
    dropoff = booking.get("dropoff_location") or pickup
    mode = "Με οδηγό" if booking.get("driver_mode") == "WITH_DRIVER" else "Self-drive"
    extras = ""
    pricing = booking.get("pricing") or {}
    lines = pricing.get("extras_lines") or []
    if lines:
        extras = f"<tr><td style='padding:4px 0;'><strong>Extras:</strong> {', '.join(lines)}</td></tr>"

    if for_admin:
        greet = (
            f"<p>Νέα κράτηση ενοικίασης από "
            f"<strong>{booking.get('client_name') or '—'}</strong>.</p>"
        )
    else:
        name = f" {booking['client_name']}" if booking.get("client_name") else ""
        greet = (
            f"<p>Γεια σας{name},</p>"
            "<p>Η κράτηση ενοικίασής σας καταχωρήθηκε επιτυχώς. "
            "Κρατήστε αυτό το email ή δείξτε το QR στο Rent Wallet κατά την παραλαβή.</p>"
        )

    return f"""
    {greet}
    <table width="100%" style="background:#f8fafc;border-radius:12px;padding:16px;font-size:13px;color:#475569;margin-top:16px;">
      <tr><td style="padding:4px 0;"><strong>Κωδικός:</strong> {booking.get('id') or '—'}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Όχημα:</strong> {vehicle}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Παραλαβή:</strong> {_fmt_when(booking.get('start_time'))} · {pickup}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Επιστροφή:</strong> {_fmt_when(booking.get('end_time'))} · {dropoff}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Λειτουργία:</strong> {mode}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Πελάτης:</strong> {booking.get('client_name') or '—'}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Email:</strong> {booking.get('client_email') or '—'}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Τηλέφωνο:</strong> {booking.get('client_phone') or '—'}</td></tr>
      {extras}
    </table>
    {_payment_block(booking)}
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">
      Δωρεάν ακύρωση έως 24 ώρες πριν την παραλαβή (μέσω της εφαρμογής Rent).
    </p>
    """


async def send_rental_confirmation_email(booking: dict[str, Any]) -> dict[str, Any]:
    """Send customer (+ optional admin) confirmation for a rental booking."""
    cfg = _read_notification_settings()
    results: dict[str, Any] = {"customer": None, "admin": None}

    email = str(booking.get("client_email") or "").strip().lower()
    if cfg["notify_customer"] and email and "@" in email:
        title = "Επιβεβαίωση κράτησης ενοικίασης"
        try:
            results["customer"] = await send_email(
                email,
                f"{title} · {booking.get('vehicle_model') or 'Όχημα'}",
                _wrap_html(title, _booking_body(booking, for_admin=False)),
            )
        except Exception:
            logger.exception("Failed rental confirmation email to customer=%s", email)
            results["customer"] = "error"

    if cfg["notify_admin"]:
        admin = _admin_recipient()
        if admin and admin != email:
            title = "Νέα κράτηση ενοικίασης"
            try:
                results["admin"] = await send_email(
                    admin,
                    f"{title} · {booking.get('client_name') or booking.get('id')}",
                    _wrap_html(title, _booking_body(booking, for_admin=True)),
                )
            except Exception:
                logger.exception("Failed rental confirmation email to admin=%s", admin)
                results["admin"] = "error"

    return results
