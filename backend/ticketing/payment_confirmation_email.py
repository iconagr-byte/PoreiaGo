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
EVENT_NEW_BOOKING = "new_booking"

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


def _valid_email(value: Any) -> str | None:
    email = str(value or "").strip().lower()
    return email if email and "@" in email and "." in email.split("@", 1)[-1] else None


def _tenant_id_from_booking(booking: dict[str, Any] | None) -> str | None:
    if not booking:
        return None
    for key in ("tenant_id", "tenantId", "office_id", "officeId"):
        raw = booking.get(key)
        if raw:
            return str(raw).strip()
    return None


def _read_notification_settings(tenant_id: str | None = None) -> dict[str, Any]:
    try:
        from travel_platform.settings.payment_settings_store import read_payment_settings

        security = read_payment_settings(tenant_id).get("security") or {}
    except Exception:
        security = {}
    return {
        "notify_customer": security.get("notify_customer_on_payment", True) is not False,
        "notify_admin": security.get("notify_admin_on_payment", True) is not False,
        "admin_email": str(security.get("admin_notification_email") or "").strip(),
    }


def _admin_recipient(tenant_id: str | None = None) -> str | None:
    """Sync fallback chain for office/admin payment emails.

    Order: tenant payment admin_notification_email → platform support_email →
    ADMIN_NOTIFICATION_EMAIL env.
    Prefer ``resolve_office_recipient`` (async) when tenant DB lookups are needed.
    """
    cfg = _read_notification_settings(tenant_id)
    if _valid_email(cfg["admin_email"]):
        return _valid_email(cfg["admin_email"])
    try:
        from travel_platform.settings.platform_store import get_platform_config

        email = _valid_email(get_platform_config().support_email)
        if email:
            return email
    except Exception:
        pass
    import os

    return _valid_email(os.getenv("ADMIN_NOTIFICATION_EMAIL", ""))


async def _tenant_office_emails(tenant_id: str) -> list[str]:
    """Collect office contact emails from tenant settings / appearance / admin users."""
    found: list[str] = []
    seen: set[str] = set()

    def _add(value: Any) -> None:
        email = _valid_email(value)
        if email and email not in seen:
            seen.add(email)
            found.append(email)

    try:
        from uuid import UUID

        from sqlalchemy import select

        from app.core.database import AsyncSessionLocal
        from app.models.tenant import Tenant
        from app.models.user import User, UserRole

        tid = UUID(str(tenant_id))
        async with AsyncSessionLocal() as session:
            tenant = (
                await session.execute(select(Tenant).where(Tenant.id == tid))
            ).scalar_one_or_none()
            if tenant and tenant.settings_json:
                import json

                try:
                    settings = json.loads(tenant.settings_json)
                except (json.JSONDecodeError, TypeError):
                    settings = {}
                if isinstance(settings, dict):
                    platform = settings.get("platform") if isinstance(settings.get("platform"), dict) else {}
                    appearance = (
                        settings.get("site_appearance")
                        if isinstance(settings.get("site_appearance"), dict)
                        else {}
                    )
                    _add(platform.get("support_email"))
                    _add(platform.get("admin_notification_email"))
                    _add(appearance.get("footer_contact_email"))
                    _add(settings.get("support_email"))
                    _add(settings.get("contact_email"))

            # Prefer an active tenant_admin as last resort for this office.
            users = (
                await session.execute(
                    select(User)
                    .where(User.tenant_id == tid, User.is_active.is_(True))
                    .limit(25)
                )
            ).scalars().all()
            for user in users:
                roles = list(user.roles or [])
                if UserRole.TENANT_ADMIN.value in roles or UserRole.DISPATCHER.value in roles:
                    _add(user.email)
    except Exception as exc:
        logger.debug("tenant office email lookup failed tenant=%s: %s", tenant_id, exc)

    return found


async def _tenant_mailbox_email(tenant_id: str) -> str | None:
    """Active Email Hub mailbox address for the office (e.g. info@achilliotravel.com)."""
    tid = str(tenant_id or "").strip()
    if not tid:
        return None
    try:
        from email_client.settings_store import list_settings

        accounts = await list_settings(owner_key=f"tenant:{tid}", active_only=True)
        for row in accounts:
            email = _valid_email(row.get("email_address") or row.get("mail_username"))
            if email:
                return email
    except Exception:
        logger.debug("tenant mailbox lookup failed tenant=%s", tid, exc_info=True)
    return None


async def resolve_office_recipient(
    tenant_id: str | None = None,
    *,
    booking: dict[str, Any] | None = None,
) -> str | None:
    """Resolve office email for a booking's tenant — never silently prefer wrong tenant."""
    tid = (str(tenant_id).strip() if tenant_id else None) or _tenant_id_from_booking(booking)

    cfg = _read_notification_settings(tid)
    if _valid_email(cfg["admin_email"]):
        return _valid_email(cfg["admin_email"])

    if tid:
        for email in await _tenant_office_emails(tid):
            return email
        mailbox = await _tenant_mailbox_email(tid)
        if mailbox:
            return mailbox

    # Global fallbacks (platform / env) — used when tenant has no contact configured.
    return _admin_recipient(None)


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


def _seats_display(booking: dict[str, Any]) -> str:
    seats = booking.get("seat") or booking.get("seats")
    if isinstance(seats, (list, tuple)):
        return ", ".join(str(s) for s in seats if s) or "—"
    return str(seats or "—")


def _booking_summary_rows(booking: dict[str, Any]) -> str:
    pnr = booking.get("pnr") or booking.get("id") or "—"
    saas_id = booking.get("saasBookingId") or booking.get("saas_booking_id") or ""
    source = booking.get("bookingSource") or booking.get("source") or ""
    agent = booking.get("agentName") or booking.get("agent_name") or ""
    trip_id = booking.get("tripId") or booking.get("trip_id") or booking.get("external_trip_id") or ""
    extra_rows = ""
    if saas_id:
        extra_rows += f'<tr><td style="padding:4px 0;"><strong>Booking ID:</strong> {saas_id}</td></tr>'
    if trip_id:
        extra_rows += f'<tr><td style="padding:4px 0;"><strong>Trip ID:</strong> {trip_id}</td></tr>'
    if source:
        extra_rows += f'<tr><td style="padding:4px 0;"><strong>Πηγή:</strong> {source}</td></tr>'
    if agent:
        extra_rows += f'<tr><td style="padding:4px 0;"><strong>Πράκτορας:</strong> {agent}</td></tr>'
    return f"""
    <table width="100%" style="background:#f8fafc;border-radius:12px;padding:16px;font-size:13px;color:#475569;margin-top:16px;">
      <tr><td style="padding:4px 0;"><strong>PNR:</strong> {pnr}</td></tr>
      {extra_rows}
      <tr><td style="padding:4px 0;"><strong>Εκδρομή:</strong> {booking.get("tripTitle") or booking.get("trip_title") or "—"}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Θέσεις:</strong> {_seats_display(booking)}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Ημερομηνία:</strong> {booking.get("date") or "—"} {booking.get("time") or ""}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Πελάτης:</strong> {booking.get("customerName") or booking.get("customer_name") or "—"}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Email:</strong> {booking.get("email") or "—"}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Τηλέφωνο:</strong> {booking.get("phone") or "—"}</td></tr>
    </table>
    """


def _payment_detail_rows(booking: dict[str, Any]) -> str:
    plan = booking.get("paymentPlan") or booking.get("payment_plan") or ""
    deposit_pct = booking.get("depositPercent") or booking.get("deposit_percent")
    txn = booking.get("transactionId") or booking.get("transaction_id") or ""
    invoice = booking.get("invoiceNumber") or booking.get("invoice_number") or ""
    pay_date = booking.get("paymentDate") or booking.get("payment_date") or ""
    balance_method = booking.get("balanceDueMethod") or booking.get("balance_due_method") or ""
    tenant = booking.get("tenant_id") or booking.get("tenantId") or ""
    rows = [
        f'<tr><td style="padding:4px 0;"><strong>Τρόπος πληρωμής:</strong> {booking.get("paymentMethod") or booking.get("payment_method") or "—"}</td></tr>',
        f'<tr><td style="padding:4px 0;"><strong>Κατάσταση κράτησης:</strong> {booking.get("status") or "—"}</td></tr>',
        f'<tr><td style="padding:4px 0;"><strong>Κατάσταση πληρωμής:</strong> {booking.get("paymentStatus") or booking.get("payment_status") or "—"}</td></tr>',
        f'<tr><td style="padding:4px 0;"><strong>Πληρώθηκε τώρα / σύνολο πληρωμών:</strong> {_money(booking.get("amountPaid") or booking.get("amount_paid") or booking.get("price"))}</td></tr>',
        f'<tr><td style="padding:4px 0;"><strong>Υπόλοιπο:</strong> {_money(booking.get("balanceDue") or booking.get("balance_due") or 0)}</td></tr>',
        f'<tr><td style="padding:4px 0;"><strong>Σύνολο κράτησης:</strong> {_money(booking.get("price") or booking.get("amount") or booking.get("total_eur"))}</td></tr>',
    ]
    if plan:
        plan_label = plan
        if deposit_pct:
            plan_label = f"{plan} ({deposit_pct}%)"
        rows.append(f'<tr><td style="padding:4px 0;"><strong>Πλάνο:</strong> {plan_label}</td></tr>')
    if balance_method:
        rows.append(
            f'<tr><td style="padding:4px 0;"><strong>Υπόλοιπο — τρόπος:</strong> {balance_method}</td></tr>'
        )
    if txn:
        rows.append(f'<tr><td style="padding:4px 0;"><strong>Transaction:</strong> {txn}</td></tr>')
    if invoice:
        rows.append(f'<tr><td style="padding:4px 0;"><strong>Τιμολόγιο:</strong> {invoice}</td></tr>')
    if pay_date:
        rows.append(f'<tr><td style="padding:4px 0;"><strong>Ημ/νία πληρωμής:</strong> {pay_date}</td></tr>')
    if tenant:
        rows.append(f'<tr><td style="padding:4px 0;"><strong>Tenant / γραφείο:</strong> {tenant}</td></tr>')
    return (
        '<table width="100%" style="background:#eff6ff;border-radius:12px;padding:16px;'
        'font-size:13px;color:#1e3a8a;margin-top:12px;border:1px solid #bfdbfe;">'
        + "".join(rows)
        + "</table>"
    )


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
        EVENT_NEW_BOOKING: "Νέα κράτηση εκδρομής",
        EVENT_BANK_PENDING: "Νέα κράτηση — εκκρεμής τραπεζική κατάθεση",
        EVENT_ONLINE_DEPOSIT: "Νέα κράτηση — προκαταβολή online",
        EVENT_BANK_CONFIRMED: "Κατάθεση επιβεβαιώθηκε",
        EVENT_CASH_PAYMENT: "Είσπραξη μετρητών",
        EVENT_FISCAL_RECEIPT: "Φορολογική απόδειξη εκδόθηκε",
        EVENT_ONLINE_FULL: "Νέα κράτηση — πλήρης πληρωμή online",
    }
    label = labels.get(event, "Ενημέρωση πληρωμής")
    subject = f"[Γραφείο] {label} · {pnr}"
    body = f"""
    <p><strong>{label}</strong></p>
    <p>Νέα / ενημερωμένη κράτηση εκδρομής — στοιχεία πληρωμής παρακάτω.</p>
    {_payment_detail_rows(booking)}
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
    payload = {
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
    # Prefer office storefront host for magic-link CTAs when known on the booking.
    domain = (
        enriched.get("customDomain")
        or enriched.get("custom_domain")
        or enriched.get("officeDomain")
        or enriched.get("office_domain")
        or ""
    )
    public_base = enriched.get("publicBaseUrl") or enriched.get("public_base_url") or ""
    if public_base:
        payload["public_base_url"] = public_base
    elif domain:
        payload["custom_domain"] = domain
    return payload


async def send_payment_confirmation_notifications(
    booking: dict[str, Any],
    *,
    event: str | None = None,
    require_office: bool = False,
    notify_customer: bool | None = None,
) -> dict[str, Any]:
    """Send customer + office payment emails.

    ``require_office=True`` (paid/confirmed success paths): always attempt the
    office email even if ``notify_admin_on_payment`` is disabled, and log at
    error level when no recipient can be resolved.
    """
    tenant_id = _tenant_id_from_booking(booking)
    cfg = _read_notification_settings(tenant_id)
    ev = detect_payment_event(booking, event)
    customer_email = _valid_email(booking.get("email"))
    send_customer = cfg["notify_customer"] if notify_customer is None else bool(notify_customer)
    send_admin = True if require_office else cfg["notify_admin"]
    results: dict[str, Any] = {
        "event": ev,
        "customer": None,
        "admin": None,
        "ticket": None,
        "tenant_id": tenant_id,
        "require_office": require_office,
    }

    if send_customer and customer_email and ev != EVENT_NEW_BOOKING:
        try:
            subject, html = build_customer_payment_email(booking, ev)
            ref = await send_email(customer_email, subject, html, tenant_id=tenant_id)
            results["customer"] = {"email": customer_email, "reference": ref}

            if ev in (EVENT_ONLINE_FULL, EVENT_ONLINE_DEPOSIT, EVENT_BANK_CONFIRMED, EVENT_CASH_PAYMENT):
                ticket_result = await send_ticket_confirmation_email(_ticket_payload(booking))
                results["ticket"] = ticket_result
        except Exception as exc:
            logger.warning("Customer payment email failed: %s", exc)
            results["customer_error"] = str(exc)

    if send_admin:
        admin_to = await resolve_office_recipient(tenant_id, booking=booking)
        if admin_to:
            try:
                subject, html = build_admin_payment_email(booking, ev)
                ref = await send_email(admin_to, subject, html, tenant_id=tenant_id)
                results["admin"] = {"email": admin_to, "reference": ref}
                logger.info(
                    "Office payment email sent event=%s pnr=%s to=%s tenant=%s",
                    ev,
                    booking.get("pnr") or booking.get("id"),
                    admin_to,
                    tenant_id,
                )
            except Exception as exc:
                logger.error(
                    "Office payment email failed event=%s pnr=%s tenant=%s: %s",
                    ev,
                    booking.get("pnr") or booking.get("id"),
                    tenant_id,
                    exc,
                )
                results["admin_error"] = str(exc)
        else:
            msg = (
                f"No office/admin email configured for paid booking "
                f"event={ev} pnr={booking.get('pnr') or booking.get('id')} tenant={tenant_id}"
            )
            if require_office:
                logger.error(msg)
            else:
                logger.warning(msg)
            results["admin_skipped"] = "No admin email configured"

    return results


def is_paid_success_booking(booking: dict[str, Any] | None = None, *, amount_paid: float | None = None) -> bool:
    """True when money was collected / booking is paid or partially paid online."""
    if amount_paid is not None:
        try:
            return float(amount_paid) > 0
        except (TypeError, ValueError):
            return False
    if not booking:
        return False
    try:
        paid = float(
            booking.get("amountPaid")
            if booking.get("amountPaid") is not None
            else booking.get("amount_paid")
            if booking.get("amount_paid") is not None
            else 0
        )
    except (TypeError, ValueError):
        paid = 0.0
    if paid > 0:
        return True
    status = str(booking.get("status") or "").lower()
    pay_status = str(booking.get("paymentStatus") or booking.get("payment_status") or "").lower()
    return status in {"επιβεβαιωμένη", "confirmed", "paid"} and (
        "paid" in pay_status or pay_status in {"paid", "partial", "deposit"}
    )


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
