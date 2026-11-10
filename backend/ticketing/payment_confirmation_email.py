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


_FONT = (
    "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Helvetica,Arial,sans-serif"
)


def _esc(value: Any) -> str:
    return (
        str(value or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _is_blank(value: Any) -> bool:
    s = str(value or "").strip()
    return (not s) or s in {"—", "-", "None", "null"}


def _looks_like_uuid(value: Any) -> bool:
    s = str(value or "").strip()
    if len(s) != 36 or s.count("-") != 4:
        return False
    hexish = s.replace("-", "")
    return len(hexish) == 32 and all(c in "0123456789abcdefABCDEF" for c in hexish)


def _payment_method_label(raw: Any) -> str:
    s = str(raw or "").strip()
    if _is_blank(s):
        return ""
    key = s.lower()
    if key in {"card", "credit_card", "creditcard"} or "κάρτ" in key:
        return "Κάρτα"
    if "paypal" in key:
        return "PayPal"
    if "apple" in key:
        return "Apple Pay"
    if "bank" in key or "τραπεζ" in key or "iban" in key:
        return "Τραπεζική μεταφορά"
    if "cash" in key or "μετρητ" in key:
        return "Μετρητά"
    return s


def _payment_status_label(raw: Any) -> str:
    s = str(raw or "").strip()
    if _is_blank(s):
        return ""
    low = s.lower()
    if low.startswith("paid") or "πληρωμ" in low:
        return "Πληρωμένη"
    if "partial" in low or "deposit" in low or "προκαταβ" in low:
        return "Μερική / προκαταβολή"
    if "pending" in low or "εκκρεμ" in low:
        return "Εκκρεμής"
    return s


def _plan_label(plan: Any, deposit_pct: Any = None) -> str:
    s = str(plan or "").strip().lower()
    if not s:
        return ""
    if s in {"full", "full_payment"}:
        label = "Πλήρης πληρωμή"
    elif s in {"deposit", "down_payment"}:
        label = "Προκαταβολή"
    else:
        label = str(plan)
    if deposit_pct not in (None, ""):
        label = f"{label} ({deposit_pct}%)"
    return label


def _trip_when(booking: dict[str, Any]) -> str:
    date = str(booking.get("date") or "").strip()
    time = str(booking.get("time") or "").strip()
    if date or time:
        return " ".join(p for p in (date, time) if p).strip()
    for key in ("departureTime", "departure_time", "tripDate", "trip_date"):
        raw = booking.get(key)
        if not raw:
            continue
        text = str(raw).strip()
        if "T" in text:
            try:
                from datetime import datetime

                dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
                return dt.strftime("%d/%m/%Y %H:%M")
            except Exception:
                return text.replace("T", " ")[:16]
        return text
    return ""


def _kv_row(label: str, value: Any, *, mono: bool = False, emphasize: bool = False) -> str:
    if _is_blank(value):
        return ""
    val = _esc(value)
    value_style = "padding:11px 0;text-align:right;color:#1d1d1f;font-size:14px;line-height:1.35;"
    if mono:
        value_style += "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.02em;"
    if emphasize:
        value_style += "font-weight:600;"
    return (
        f'<tr>'
        f'<td style="padding:11px 0;color:#86868b;font-size:13px;line-height:1.35;width:42%;vertical-align:top;">{_esc(label)}</td>'
        f'<td style="{value_style}">{val}</td>'
        f"</tr>"
    )


def _section(title: str, rows_html: str, *, tone: str = "neutral") -> str:
    if not rows_html.strip():
        return ""
    bg = "#f5f5f7" if tone == "neutral" else "#f0f7ff"
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:18px 0 0;background:{bg};border-radius:16px;">
      <tr><td style="padding:18px 18px 6px;">
        <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#86868b;">
          {_esc(title)}
        </p>
      </td></tr>
      <tr><td style="padding:0 18px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="border-collapse:collapse;">
          {rows_html}
        </table>
      </td></tr>
    </table>
    """


def _hero_amount(label: str, amount: str) -> str:
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:8px 0 4px;background:#f5f5f7;border-radius:16px;">
      <tr><td style="padding:22px 20px;text-align:center;">
        <p style="margin:0 0 6px;font-size:13px;color:#86868b;">{_esc(label)}</p>
        <p style="margin:0;font-size:32px;line-height:1.1;font-weight:600;letter-spacing:-.03em;color:#1d1d1f;">
          {_esc(amount)}
        </p>
      </td></tr>
    </table>
    """


def _wrap_html(title: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{_esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:{_FONT};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;
               box-shadow:0 1px 2px rgba(0,0,0,.04),0 12px 40px rgba(0,0,0,.06);">
        <tr>
          <td style="padding:28px 28px 8px;">
            <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:-.01em;color:#1d1d1f;">
              PoreiaGo
            </p>
            <h1 style="margin:10px 0 0;font-size:24px;line-height:1.2;font-weight:600;letter-spacing:-.03em;color:#1d1d1f;">
              {_esc(title)}
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 28px;color:#1d1d1f;font-size:15px;line-height:1.55;">
            {body}
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 24px;">
            <p style="margin:0;padding-top:18px;border-top:1px solid #e8e8ed;font-size:12px;line-height:1.45;color:#86868b;text-align:center;">
              PoreiaGo · Μην απαντάτε σε αυτό το email
            </p>
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
        return ", ".join(str(s) for s in seats if s) or ""
    return str(seats or "").strip()


def _booking_summary_rows(booking: dict[str, Any], *, admin: bool = False) -> str:
    pnr = booking.get("pnr") or booking.get("id") or ""
    saas_id = booking.get("saasBookingId") or booking.get("saas_booking_id") or ""
    source = booking.get("bookingSource") or booking.get("source") or ""
    agent = booking.get("agentName") or booking.get("agent_name") or ""
    trip_id = booking.get("tripId") or booking.get("trip_id") or booking.get("external_trip_id") or ""
    rows = [
        _kv_row("Κωδικός", pnr, mono=True, emphasize=True),
    ]
    if admin and saas_id:
        rows.append(_kv_row("Booking ID", saas_id, mono=True))
    if admin and trip_id:
        rows.append(_kv_row("Trip ID", trip_id, mono=True))
    if admin and source:
        rows.append(_kv_row("Πηγή", source))
    if agent:
        rows.append(_kv_row("Πράκτορας", agent))
    rows.extend(
        [
            _kv_row("Εκδρομή", booking.get("tripTitle") or booking.get("trip_title"), emphasize=True),
            _kv_row("Θέσεις", _seats_display(booking), mono=True),
            _kv_row("Ημερομηνία", _trip_when(booking)),
            _kv_row("Πελάτης", booking.get("customerName") or booking.get("customer_name")),
            _kv_row("Email", booking.get("email")),
            _kv_row("Τηλέφωνο", booking.get("phone"), mono=True),
        ]
    )
    return _section("Κράτηση", "".join(rows))


def _payment_detail_rows(booking: dict[str, Any]) -> str:
    plan = booking.get("paymentPlan") or booking.get("payment_plan") or ""
    deposit_pct = booking.get("depositPercent") or booking.get("deposit_percent")
    txn = booking.get("transactionId") or booking.get("transaction_id") or ""
    invoice = booking.get("invoiceNumber") or booking.get("invoice_number") or ""
    pay_date = booking.get("paymentDate") or booking.get("payment_date") or ""
    balance_method = booking.get("balanceDueMethod") or booking.get("balance_due_method") or ""
    tenant = booking.get("tenant_id") or booking.get("tenantId") or ""
    method = _payment_method_label(booking.get("paymentMethod") or booking.get("payment_method"))
    pay_status = _payment_status_label(
        booking.get("paymentStatus") or booking.get("payment_status")
    )
    rows = [
        _kv_row("Τρόπος πληρωμής", method),
        _kv_row("Κατάσταση κράτησης", booking.get("status")),
        _kv_row("Κατάσταση πληρωμής", pay_status, emphasize=True),
        _kv_row(
            "Πληρώθηκε",
            _money(
                booking.get("amountPaid")
                if booking.get("amountPaid") is not None
                else booking.get("amount_paid")
                if booking.get("amount_paid") is not None
                else booking.get("price")
            ),
            emphasize=True,
        ),
        _kv_row(
            "Υπόλοιπο",
            _money(booking.get("balanceDue") if booking.get("balanceDue") is not None else booking.get("balance_due") or 0),
        ),
        _kv_row(
            "Σύνολο",
            _money(booking.get("price") or booking.get("amount") or booking.get("total_eur")),
            emphasize=True,
        ),
    ]
    plan_txt = _plan_label(plan, deposit_pct)
    if plan_txt:
        rows.append(_kv_row("Πλάνο", plan_txt))
    if balance_method:
        rows.append(_kv_row("Υπόλοιπο — τρόπος", balance_method))
    if txn:
        rows.append(_kv_row("Συναλλαγή", txn, mono=True))
    if invoice:
        rows.append(_kv_row("Τιμολόγιο", invoice, mono=True))
    if pay_date:
        rows.append(_kv_row("Ημ/νία πληρωμής", pay_date))
    # Keep tenant id for office ops/tests, but de-emphasize raw UUIDs.
    if tenant:
        label = "Γραφείο (ID)" if _looks_like_uuid(tenant) else "Γραφείο"
        rows.append(_kv_row(label, tenant, mono=True))
    return _section("Πληρωμή", "".join(rows), tone="info")


def _fiscal_mark_block(booking: dict[str, Any]) -> str:
    mark = booking.get("fiscalMark") or booking.get("fiscal_mark")
    if not mark:
        return ""
    kind = booking.get("fiscalKindLabel") or booking.get("fiscal_kind_label") or "Απόδειξη"
    amount = _money(booking.get("fiscalReceiptAmount") or booking.get("lastReceiptAmount"))
    provider = booking.get("fiscalProvider") or booking.get("fiscal_provider") or ""
    rows = [
        _kv_row("MARK", mark, mono=True, emphasize=True),
        _kv_row("Τύπος", kind),
        _kv_row("Ποσό απόδειξης", amount, emphasize=True),
        _kv_row("Πάροχος", provider),
    ]
    return _section("Φορολογική απόδειξη · myDATA", "".join(rows))


def _passenger_track_block(booking: dict[str, Any]) -> str:
    enriched = enrich_booking_passenger_track(dict(booking))
    return track_link_email_block(enriched.get("passengerTrackUrl"))


def _bank_transfer_email_block(booking: dict[str, Any]) -> str:
    bank = resolve_bank_transfer_details(booking)
    if not bank.get("iban"):
        return ""
    rows = [
        _kv_row("Τράπεζα", bank.get("bank_name"), emphasize=True),
        _kv_row("Δικαιούχος", bank.get("beneficiary")),
        _kv_row("IBAN", bank.get("iban_display"), mono=True, emphasize=True),
        _kv_row("BIC / SWIFT", bank.get("bic"), mono=True),
        _kv_row("Αιτιολογία", bank.get("reference"), mono=True, emphasize=True),
    ]
    note = """
    <p style="margin:10px 18px 16px;font-size:12px;line-height:1.45;color:#86868b;">
      Χρησιμοποιήστε <strong style="color:#1d1d1f;">ακριβώς</strong> την αιτιολογία για να ταυτοποιηθεί η πληρωμή.
    </p>
    """
    instructions = ""
    if bank.get("instructions"):
        instructions = f"""
        <p style="margin:0 18px 16px;font-size:13px;line-height:1.5;color:#424245;">
          {_esc(bank["instructions"])}
        </p>
        """
    return _section("Τραπεζική κατάθεση", "".join(rows)) + note + instructions


def build_customer_payment_email(booking: dict[str, Any], event: str) -> tuple[str, str]:
    name = _esc(booking.get("customerName") or "επιβάτη")
    total = _money(booking.get("price") or booking.get("amount"))
    paid = _money(booking.get("amountPaid") or booking.get("price"))
    balance = _money(booking.get("balanceDue") or 0)
    pnr = booking.get("pnr") or booking.get("id") or "—"
    greeting = f'<p style="margin:0 0 12px;color:#424245;">Γεια σας, {name}.</p>'

    if event == EVENT_BANK_PENDING:
        subject = f"PoreiaGo — Οδηγίες κατάθεσης · {pnr}"
        body = f"""
        {greeting}
        <p style="margin:0 0 8px;color:#424245;">Η κράτηση καταχωρήθηκε και αναμένει τραπεζική κατάθεση.</p>
        {_hero_amount("Ποσό προς κατάθεση", paid)}
        <p style="margin:10px 0 0;font-size:13px;color:#86868b;text-align:center;">Σύνολο κράτησης {total}</p>
        {_bank_transfer_email_block(booking)}
        <p style="margin:16px 0 0;color:#424245;">Μόλις επιβεβαιωθεί η κατάθεση, θα λάβετε το εισιτήριό σας.</p>
        {_booking_summary_rows(booking)}
        """
        return subject, _wrap_html("Οδηγίες κατάθεσης", body)

    if event == EVENT_ONLINE_DEPOSIT:
        subject = f"PoreiaGo — Επιβεβαίωση προκαταβολής · {pnr}"
        body = f"""
        {greeting}
        <p style="margin:0 0 8px;color:#424245;">Η προκαταβολή σας καταχωρήθηκε και η κράτηση επιβεβαιώθηκε.</p>
        {_hero_amount("Πληρώθηκε τώρα", paid)}
        <p style="margin:10px 0 0;font-size:13px;color:#86868b;text-align:center;">
          Υπόλοιπο στο λεωφορείο {balance} · Σύνολο {total}
        </p>
        {_passenger_track_block(booking)}
        {_booking_summary_rows(booking)}
        """
        return subject, _wrap_html("Προκαταβολή επιβεβαιώθηκε", body)

    if event == EVENT_BANK_CONFIRMED:
        subject = f"PoreiaGo — Κατάθεση επιβεβαιώθηκε · {pnr}"
        bal_note = (
            f'<p style="margin:10px 0 0;font-size:13px;color:#86868b;text-align:center;">Υπόλοιπο {balance}</p>'
            if float(booking.get("balanceDue") or 0) > 0
            else ""
        )
        body = f"""
        {greeting}
        <p style="margin:0 0 8px;color:#424245;">Η κατάθεση επιβεβαιώθηκε. Η κράτησή σας είναι ενεργή.</p>
        {_hero_amount("Εξοφλήθηκε", paid)}
        {bal_note}
        {_passenger_track_block(booking)}
        {_booking_summary_rows(booking)}
        """
        return subject, _wrap_html("Κατάθεση επιβεβαιώθηκε", body)

    if event == EVENT_CASH_PAYMENT:
        method = _payment_method_label(booking.get("paymentMethod")) or "Μετρητά"
        subject = f"PoreiaGo — Επιβεβαίωση πληρωμής μετρητών · {pnr}"
        cash_amt = _money(booking.get("lastCashAmount") or paid)
        bal_note = (
            f" · Υπόλοιπο {balance}" if float(booking.get("balanceDue") or 0) > 0 else ""
        )
        body = f"""
        {greeting}
        <p style="margin:0 0 8px;color:#424245;">Καταχωρήθηκε πληρωμή μετρητών ({_esc(method)}).</p>
        {_hero_amount("Είσπραξη", cash_amt)}
        <p style="margin:10px 0 0;font-size:13px;color:#86868b;text-align:center;">
          Συνολικά πληρωμένα {paid}{bal_note} · Σύνολο {total}
        </p>
        {_passenger_track_block(booking)}
        {_booking_summary_rows(booking)}
        """
        return subject, _wrap_html("Επιβεβαίωση μετρητών", body)

    if event == EVENT_FISCAL_RECEIPT:
        mark = booking.get("fiscalMark") or booking.get("fiscal_mark") or "—"
        subject = f"PoreiaGo — Φορολογική απόδειξη · MARK {mark} · {pnr}"
        body = f"""
        {greeting}
        <p style="margin:0 0 8px;color:#424245;">Εκδόθηκε η φορολογική απόδειξη για την πληρωμή σας.</p>
        {_fiscal_mark_block(booking)}
        {_booking_summary_rows(booking)}
        <p style="margin:16px 0 0;font-size:12px;color:#86868b;">
          Το MARK είναι ο μοναδικός αριθμός καταχώρησης στην ΑΑΔΕ (myDATA).
        </p>
        """
        return subject, _wrap_html(f"Απόδειξη · MARK {mark}", body)

    subject = f"PoreiaGo — Επιβεβαίωση πληρωμής · {pnr}"
    body = f"""
    {greeting}
    <p style="margin:0 0 8px;color:#424245;">Η πληρωμή ολοκληρώθηκε και η κράτηση επιβεβαιώθηκε.</p>
    {_hero_amount("Πληρώθηκε", paid)}
    <p style="margin:10px 0 0;font-size:13px;color:#86868b;text-align:center;">Σύνολο κράτησης {total}</p>
    {_passenger_track_block(booking)}
    {_booking_summary_rows(booking)}
    """
    return subject, _wrap_html("Επιβεβαίωση πληρωμής", body)


def build_admin_payment_email(booking: dict[str, Any], event: str) -> tuple[str, str]:
    pnr = booking.get("pnr") or booking.get("id") or "—"
    labels = {
        EVENT_NEW_BOOKING: "Νέα κράτηση εκδρομής",
        EVENT_BANK_PENDING: "Νέα κράτηση — εκκρεμής κατάθεση",
        EVENT_ONLINE_DEPOSIT: "Νέα κράτηση — προκαταβολή online",
        EVENT_BANK_CONFIRMED: "Κατάθεση επιβεβαιώθηκε",
        EVENT_CASH_PAYMENT: "Είσπραξη μετρητών",
        EVENT_FISCAL_RECEIPT: "Φορολογική απόδειξη εκδόθηκε",
        EVENT_ONLINE_FULL: "Νέα κράτηση — πλήρης πληρωμή online",
    }
    label = labels.get(event, "Ενημέρωση πληρωμής")
    subject = f"[Γραφείο] {label} · {pnr}"
    paid = _money(
        booking.get("amountPaid")
        if booking.get("amountPaid") is not None
        else booking.get("amount_paid")
        if booking.get("amount_paid") is not None
        else booking.get("price")
    )
    customer = _esc(booking.get("customerName") or booking.get("customer_name") or "—")
    trip = _esc(booking.get("tripTitle") or booking.get("trip_title") or "—")
    body = f"""
    <p style="margin:0 0 6px;font-size:13px;color:#86868b;">Ενημέρωση γραφείου</p>
    <p style="margin:0 0 14px;color:#424245;">
      {customer} · {trip}
    </p>
    {_hero_amount("Πληρωμή", paid)}
    {_payment_detail_rows(booking)}
    {_fiscal_mark_block(booking) if event == EVENT_FISCAL_RECEIPT else ""}
    {_bank_transfer_email_block(booking) if event == EVENT_BANK_PENDING else ""}
    {_booking_summary_rows(booking, admin=True)}
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
