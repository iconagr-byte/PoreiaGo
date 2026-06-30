"""Email επιβεβαίωσης πληρωμής — πελάτης & διαχειριστής."""

from __future__ import annotations

import logging
from typing import Any

from ticketing.bank_transfer_details import resolve_bank_transfer_details
from ticketing.email_dispatch import send_email
from ticketing.ticket_email import send_ticket_confirmation_email
from travel_platform.telemetry.passenger_track_links import (
    enrich_booking_passenger_track,
    track_link_email_block,
)

logger = logging.getLogger(__name__)

EVENT_ONLINE_FULL = "online_paid_full"
EVENT_ONLINE_DEPOSIT = "online_paid_deposit"
EVENT_BANK_PENDING = "bank_pending"
EVENT_BANK_CONFIRMED = "bank_confirmed"
EVENT_CASH_PAYMENT = "cash_payment"
EVENT_FISCAL_RECEIPT = "fiscal_receipt_issued"

INVOICE_KIND_LABELS = {
    "down_payment": "Προκαταβολή",
    "final_settlement": "Εξόφληση υπολοίπου",
    "full_payment": "Πλήρης πληρωμή",
    "credit_note": "Πιστωτικό",
}


def _money(value: Any) -> str:
    try:
        return f"€{float(value):.2f}"
    except (TypeError, ValueError):
        return "—"


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
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0040df,#001d66);padding:24px 28px;color:#fff;">
            <div style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;opacity:.85;">PoreiaGo Travel</div>
            <h1 style="margin:10px 0 0;font-size:20px;">{title}</h1>
          </td>
        </tr>
        <tr><td style="padding:28px;color:#334155;font-size:14px;line-height:1.65;">{body}</td></tr>
        <tr>
          <td style="padding:16px 28px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8;">
            PoreiaGo Travel · Μην απαντάτε αυτό το email
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _booking_summary_rows(booking: dict[str, Any]) -> str:
    pnr = booking.get("pnr") or booking.get("id") or "—"
    return f"""
    <table width="100%" style="background:#f8fafc;border-radius:12px;padding:16px;font-size:13px;color:#475569;margin-top:16px;">
      <tr><td style="padding:4px 0;"><strong>PNR:</strong> {pnr}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Εκδρομή:</strong> {booking.get("tripTitle") or "—"}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Θέσεις:</strong> {booking.get("seat") or booking.get("seats") or "—"}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Ημερομηνία:</strong> {booking.get("date") or "—"} {booking.get("time") or ""}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Πελάτης:</strong> {booking.get("customerName") or "—"}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Email:</strong> {booking.get("email") or "—"}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Τηλέφωνο:</strong> {booking.get("phone") or "—"}</td></tr>
    </table>
    """


def _fiscal_mark_block(booking: dict[str, Any]) -> str:
    mark = booking.get("fiscalMark") or booking.get("fiscal_mark")
    if not mark:
        return ""
    kind = booking.get("fiscalKindLabel") or booking.get("fiscal_kind_label") or "Απόδειξη"
    amount = _money(booking.get("fiscalReceiptAmount") or booking.get("lastReceiptAmount"))
    provider = booking.get("fiscalProvider") or booking.get("fiscal_provider") or ""
    provider_row = (
        f'<tr><td style="padding:4px 0;"><strong>Πάροχος:</strong> {provider}</td></tr>'
        if provider
        else ""
    )
    return f"""
    <div style="margin:20px 0;padding:18px 20px;background:#ecfdf5;border:2px solid #6ee7b7;border-radius:14px;">
      <p style="margin:0 0 10px;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;color:#047857;">
        Φορολογική απόδειξη (myDATA)
      </p>
      <table width="100%" style="font-size:14px;color:#064e3b;">
        <tr><td style="padding:4px 0;"><strong>MARK:</strong></td>
            <td style="padding:4px 0;font-family:monospace;font-weight:bold;text-align:right;">{mark}</td></tr>
        <tr><td style="padding:4px 0;"><strong>Τύπος:</strong> {kind}</td></tr>
        <tr><td style="padding:4px 0;"><strong>Ποσό απόδειξης:</strong> {amount}</td></tr>
        {provider_row}
      </table>
    </div>
    """


def _passenger_track_block(booking: dict[str, Any]) -> str:
    enriched = enrich_booking_passenger_track(dict(booking))
    return track_link_email_block(enriched.get("passengerTrackUrl"))


def _bank_transfer_email_block(booking: dict[str, Any]) -> str:
    bank = resolve_bank_transfer_details(booking)
    if not bank.get("iban"):
        return ""
    bic_row = (
        f'<tr><td style="padding:6px 0;color:#64748b;">BIC / SWIFT</td>'
        f'<td style="padding:6px 0;font-family:monospace;font-weight:bold;text-align:right;">{bank["bic"]}</td></tr>'
        if bank.get("bic")
        else ""
    )
    instructions = ""
    if bank.get("instructions"):
        instructions = f"""
        <p style="margin:12px 0 0;font-size:13px;color:#475569;line-height:1.5;">
          {bank["instructions"]}
        </p>
        """
    return f"""
    <div style="margin:20px 0;padding:18px 20px;background:#eff6ff;border:2px solid #bfdbfe;border-radius:14px;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;color:#1d4ed8;">
        Στοιχεία τραπεζικής κατάθεσης
      </p>
      <table width="100%" style="font-size:14px;color:#0f172a;">
        <tr>
          <td style="padding:6px 0;color:#64748b;width:42%;">Τράπεζα</td>
          <td style="padding:6px 0;font-weight:bold;text-align:right;">{bank.get("bank_name") or "—"}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Δικαιούχος</td>
          <td style="padding:6px 0;font-weight:bold;text-align:right;">{bank.get("beneficiary") or "—"}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;vertical-align:top;">IBAN</td>
          <td style="padding:6px 0;font-family:monospace;font-weight:bold;font-size:15px;text-align:right;word-break:break-all;">
            {bank.get("iban_display") or "—"}
          </td>
        </tr>
        {bic_row}
        <tr>
          <td style="padding:6px 0;color:#64748b;vertical-align:top;">Αιτιολογία</td>
          <td style="padding:6px 0;font-family:monospace;font-weight:bold;text-align:right;word-break:break-all;">
            {bank.get("reference") or "—"}
          </td>
        </tr>
      </table>
      <p style="margin:12px 0 0;font-size:12px;color:#64748b;">
        Χρησιμοποιήστε <strong>ακριβώς</strong> την παραπάνω αιτιολογία ώστε να ταυτοποιηθεί η πληρωμή σας.
      </p>
      {instructions}
    </div>
    """


def build_customer_payment_email(booking: dict[str, Any], event: str) -> tuple[str, str]:
    name = booking.get("customerName") or "επιβάτη"
    total = _money(booking.get("price") or booking.get("amount"))
    paid = _money(booking.get("amountPaid") or booking.get("price"))
    balance = _money(booking.get("balanceDue") or 0)
    pnr = booking.get("pnr") or booking.get("id") or "—"

    if event == EVENT_BANK_PENDING:
        subject = f"PoreiaGo — Οδηγίες κατάθεσης · {pnr}"
        body = f"""
        <p>Αγαπητέ/ή <strong>{name}</strong>,</p>
        <p>Η κράτησή σας καταχωρήθηκε και <strong>αναμένει τραπεζική κατάθεση</strong>.</p>
        <p style="margin:16px 0;padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">
          Ποσό προς κατάθεση: <strong style="color:#c2410c;">{paid}</strong><br/>
          Σύνολο κράτησης: {total}
        </p>
        {_bank_transfer_email_block(booking)}
        <p>Μόλις επιβεβαιωθεί η κατάθεση, θα λάβετε νέο email με το εισιτήριό σας.</p>
        {_booking_summary_rows(booking)}
        """
        return subject, _wrap_html("Οδηγίες τραπεζικής κατάθεσης", body)

    if event == EVENT_ONLINE_DEPOSIT:
        subject = f"PoreiaGo — Επιβεβαίωση προκαταβολής · {pnr}"
        body = f"""
        <p>Αγαπητέ/ή <strong>{name}</strong>,</p>
        <p>Λάβαμε την <strong>προκαταβολή</strong> σας και η κράτηση επιβεβαιώθηκε.</p>
        <p style="margin:16px 0;padding:14px 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;">
          Πληρώθηκε τώρα: <strong style="color:#047857;">{paid}</strong><br/>
          Υπόλοιπο (μετρητά στο λεωφορείο): <strong>{balance}</strong><br/>
          Σύνολο: {total}
        </p>
        {_passenger_track_block(booking)}
        {_booking_summary_rows(booking)}
        {_passenger_track_block(booking)}
        """
        return subject, _wrap_html("Επιβεβαίωση προκαταβολής", body)

    if event == EVENT_BANK_CONFIRMED:
        subject = f"PoreiaGo — Κατάθεση επιβεβαιώθηκε · {pnr}"
        body = f"""
        <p>Αγαπητέ/ή <strong>{name}</strong>,</p>
        <p>Η τραπεζική σας κατάθεση <strong>επιβεβαιώθηκε</strong>. Η κράτηση είναι πλέον ενεργή.</p>
        <p style="margin:16px 0;padding:14px 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;">
          Εξοφλήθηκε: <strong style="color:#047857;">{paid}</strong>
          {"<br/>Υπόλοιπο: <strong>" + balance + "</strong>" if float(booking.get("balanceDue") or 0) > 0 else ""}
        </p>
        {_passenger_track_block(booking)}
        {_booking_summary_rows(booking)}
        """
        return subject, _wrap_html("Επιβεβαίωση κατάθεσης", body)

    if event == EVENT_CASH_PAYMENT:
        method = booking.get("paymentMethod") or "Μετρητά"
        subject = f"PoreiaGo — Επιβεβαίωση πληρωμής μετρητών · {pnr}"
        body = f"""
        <p>Αγαπητέ/ή <strong>{name}</strong>,</p>
        <p>Καταχωρήθηκε πληρωμή μετρητών (<strong>{method}</strong>).</p>
        <p style="margin:16px 0;padding:14px 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;">
          Ποσό αυτής της είσπραξης: <strong style="color:#047857;">{_money(booking.get("lastCashAmount") or paid)}</strong><br/>
          Συνολικά πληρωμένα: <strong>{paid}</strong><br/>
          {"Υπόλοιπο: <strong>" + balance + "</strong><br/>" if float(booking.get("balanceDue") or 0) > 0 else ""}
          Σύνολο κράτησης: {total}
        </p>
        {_passenger_track_block(booking)}
        {_booking_summary_rows(booking)}
        """
        return subject, _wrap_html("Επιβεβαίωση μετρητών", body)

    if event == EVENT_FISCAL_RECEIPT:
        mark = booking.get("fiscalMark") or booking.get("fiscal_mark") or "—"
        subject = f"PoreiaGo — Φορολογική απόδειξη · MARK {mark} · {pnr}"
        body = f"""
        <p>Αγαπητέ/ή <strong>{name}</strong>,</p>
        <p>Εκδόθηκε η φορολογική απόδειξη για την πληρωμή σας.</p>
        {_fiscal_mark_block(booking)}
        {_booking_summary_rows(booking)}
        <p style="font-size:12px;color:#64748b;margin-top:16px;">
          Το MARK αποτελεί τον μοναδικό αριθμό καταχώρησης στην ΑΑΔΕ (myDATA).
        </p>
        """
        return subject, _wrap_html(f"Απόδειξη · MARK {mark}", body)

    subject = f"PoreiaGo — Επιβεβαίωση πληρωμής · {pnr}"
    body = f"""
    <p>Αγαπητέ/ή <strong>{name}</strong>,</p>
    <p>Η πληρωμή σας ολοκληρώθηκε και η κράτηση <strong>επιβεβαιώθηκε</strong>.</p>
    <p style="margin:16px 0;padding:14px 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;">
      Ποσό: <strong style="color:#047857;">{paid}</strong> · Σύνολο: {total}
    </p>
    {_passenger_track_block(booking)}
    {_booking_summary_rows(booking)}
    """
    return subject, _wrap_html("Επιβεβαίωση πληρωμής", body)


def build_admin_payment_email(booking: dict[str, Any], event: str) -> tuple[str, str]:
    pnr = booking.get("pnr") or booking.get("id") or "—"
    labels = {
        EVENT_BANK_PENDING: "Νέα κράτηση — εκκρεμής τραπεζική κατάθεση",
        EVENT_ONLINE_DEPOSIT: "Νέα κράτηση — προκαταβολή online",
        EVENT_BANK_CONFIRMED: "Κατάθεση επιβεβαιώθηκε",
        EVENT_CASH_PAYMENT: "Είσπραξη μετρητών",
        EVENT_FISCAL_RECEIPT: "Φορολογική απόδειξη εκδόθηκε",
        EVENT_ONLINE_FULL: "Νέα κράτηση — πλήρης πληρωμή online",
    }
    label = labels.get(event, "Ενημέρωση πληρωμής")
    subject = f"[Admin] {label} · {pnr}"
    body = f"""
    <p><strong>{label}</strong></p>
    <p>Τρόπος πληρωμής: {booking.get("paymentMethod") or "—"}<br/>
    Κατάσταση: {booking.get("status") or "—"} · {booking.get("paymentStatus") or "—"}</p>
    <p>Πληρώθηκε: {_money(booking.get("amountPaid") or booking.get("price"))} ·
    Υπόλοιπο: {_money(booking.get("balanceDue") or 0)} ·
    Σύνολο: {_money(booking.get("price") or booking.get("amount"))}</p>
    {_fiscal_mark_block(booking) if event == EVENT_FISCAL_RECEIPT else ""}
    {_bank_transfer_email_block(booking) if event == EVENT_BANK_PENDING else ""}
    {_booking_summary_rows(booking)}
    """
    return subject, _wrap_html(label, body)


def detect_payment_event(booking: dict[str, Any], event: str | None = None) -> str:
    if event:
        return event
    status = str(booking.get("status") or "")
    payment_method = str(booking.get("paymentMethod") or "").lower()
    payment_plan = str(booking.get("paymentPlan") or "")
    balance = float(booking.get("balanceDue") or 0)

    if status == "Εκκρεμής" or "τραπεζ" in payment_method or "bank" in payment_method.lower():
        if status == "Επιβεβαιωμένη" and ("τραπεζ" in payment_method or "bank" in payment_method.lower()):
            return EVENT_BANK_CONFIRMED
        return EVENT_BANK_PENDING
    if payment_plan == "deposit" or balance > 0:
        return EVENT_ONLINE_DEPOSIT
    return EVENT_ONLINE_FULL


def _ticket_payload(booking: dict[str, Any]) -> dict[str, Any]:
    enriched = enrich_booking_passenger_track(dict(booking))
    price = enriched.get("price") or enriched.get("amount")
    return {
        "email": enriched.get("email"),
        "customer_name": enriched.get("customerName") or "",
        "trip_title": enriched.get("tripTitle") or "",
        "date": enriched.get("date") or "",
        "time": enriched.get("time") or "",
        "seat": enriched.get("seat") or "",
        "pnr": enriched.get("pnr") or enriched.get("id"),
        "booking_id": enriched.get("id"),
        "price": price,
        "payment_method": enriched.get("paymentMethod"),
        "payment_status": enriched.get("paymentStatus") or enriched.get("status"),
        "phone": enriched.get("phone"),
        "passenger_track_url": enriched.get("passengerTrackUrl"),
    }


async def send_payment_confirmation_notifications(
    booking: dict[str, Any],
    *,
    event: str | None = None,
) -> dict[str, Any]:
    cfg = _read_notification_settings()
    ev = detect_payment_event(booking, event)
    customer_email = str(booking.get("email") or "").strip().lower()
    results: dict[str, Any] = {"event": ev, "customer": None, "admin": None, "ticket": None}

    if cfg["notify_customer"] and customer_email and "@" in customer_email:
        try:
            subject, html = build_customer_payment_email(booking, ev)
            ref = await send_email(customer_email, subject, html)
            results["customer"] = {"email": customer_email, "reference": ref}

            if ev in (EVENT_ONLINE_FULL, EVENT_ONLINE_DEPOSIT, EVENT_BANK_CONFIRMED, EVENT_CASH_PAYMENT):
                ticket_result = await send_ticket_confirmation_email(_ticket_payload(booking))
                results["ticket"] = ticket_result
        except Exception as exc:
            logger.warning("Customer payment email failed: %s", exc)
            results["customer_error"] = str(exc)

    if cfg["notify_admin"]:
        admin_to = _admin_recipient()
        if admin_to:
            try:
                subject, html = build_admin_payment_email(booking, ev)
                ref = await send_email(admin_to, subject, html)
                results["admin"] = {"email": admin_to, "reference": ref}
            except Exception as exc:
                logger.warning("Admin payment email failed: %s", exc)
                results["admin_error"] = str(exc)
        else:
            results["admin_skipped"] = "No admin email configured"

    return results


async def notify_fiscal_receipt_issued(
    booking: dict[str, Any],
    *,
    mark: str,
    invoice_kind: str,
    amount: float,
    provider: str | None = None,
) -> dict[str, Any]:
    """Email customer + admin when a fiscal receipt MARK is issued."""
    enriched = {
        **booking,
        "fiscalMark": mark,
        "fiscal_mark": mark,
        "fiscalKindLabel": INVOICE_KIND_LABELS.get(invoice_kind, invoice_kind),
        "fiscalReceiptAmount": amount,
        "fiscalProvider": provider or "",
    }
    return await send_payment_confirmation_notifications(enriched, event=EVENT_FISCAL_RECEIPT)
