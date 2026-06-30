"""Email εισιτηρίου / επιβεβαίωσης κράτησης."""

from __future__ import annotations

from urllib.parse import quote

from ticketing.email_dispatch import send_email
from travel_platform.telemetry.passenger_track_links import track_link_email_block


def _qr_img_url(pnr: str, size: int = 180) -> str:
    return f"https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&data={quote(str(pnr))}"


def build_ticket_email_html(payload: dict) -> str:
    pnr = payload.get("pnr") or payload.get("booking_id") or "—"
    price = payload.get("price")
    price_str = f"€{float(price):.2f}" if price is not None else "—"
    base = payload.get("base_price")
    taxes = payload.get("taxes")
    payment = payload.get("payment_method") or payload.get("payment_status") or "—"

    return f"""<!DOCTYPE html>
<html lang="el">
<head><meta charset="utf-8"><title>Εισιτήριο PoreiaGo</title></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0040df,#001d66);padding:28px 32px;color:#fff;">
            <div style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;opacity:.85;">PoreiaGo Travel</div>
            <h1 style="margin:12px 0 4px;font-size:22px;">Το εισιτήριό σας</h1>
            <p style="margin:0;opacity:.9;font-size:14px;">{payload.get("trip_title") or "Εκδρομή"}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;color:#64748b;font-size:13px;">Αγαπητέ/ή <strong style="color:#0f172a;">{payload.get("customer_name") or "επιβάτη"}</strong>,</p>
            <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
              Η κράτησή σας επιβεβαιώθηκε. Παρακάτω τα στοιχεία εισιτηρίου — σκανάρετε το QR κατά την επιβίβαση.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td width="50%" style="padding:8px 8px 8px 0;vertical-align:top;">
                  <div style="font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:bold;">PNR</div>
                  <div style="font-family:monospace;font-size:18px;font-weight:bold;color:#0f172a;">{pnr}</div>
                </td>
                <td width="50%" style="padding:8px 0 8px 8px;vertical-align:top;">
                  <div style="font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:bold;">Θέση</div>
                  <div style="font-size:22px;font-weight:bold;color:#0040df;">{payload.get("seat") or "—"}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 8px 8px 0;">
                  <div style="font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:bold;">Ημερομηνία</div>
                  <div style="font-weight:bold;color:#0f172a;">{payload.get("date") or "—"} · {payload.get("time") or "—"}</div>
                </td>
                <td style="padding:8px 0 8px 8px;">
                  <div style="font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:bold;">Σύνολο</div>
                  <div style="font-weight:bold;color:#059669;">{price_str}</div>
                </td>
              </tr>
            </table>
            <div style="text-align:center;padding:20px;border:2px dashed #e2e8f0;border-radius:16px;margin-bottom:24px;">
              <img src="{_qr_img_url(pnr)}" width="160" height="160" alt="QR εισιτηρίου" style="display:block;margin:0 auto 12px;" />
              <div style="font-family:monospace;font-weight:bold;letter-spacing:.12em;">{pnr}</div>
            </div>
            {track_link_email_block(payload.get("passenger_track_url"))}
            <table width="100%" style="background:#f8fafc;border-radius:12px;padding:16px;font-size:13px;color:#475569;">
              <tr><td style="padding:4px 0;"><strong>Κράτηση:</strong> #{payload.get("booking_id") or "—"}</td></tr>
              <tr><td style="padding:4px 0;"><strong>Πληρωμή:</strong> {payment}</td></tr>
              <tr><td style="padding:4px 0;"><strong>Email:</strong> {payload.get("email") or "—"}</td></tr>
              <tr><td style="padding:4px 0;"><strong>Τηλέφωνο:</strong> {payload.get("phone") or "—"}</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8;">
            PoreiaGo Travel · Μην απαντάτε σε αυτό το email
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def send_ticket_confirmation_email(payload: dict) -> dict:
    from travel_platform.telemetry.passenger_track_links import enrich_booking_passenger_track

    payload = enrich_booking_passenger_track(dict(payload))
    if not payload.get("passenger_track_url"):
        payload["passenger_track_url"] = payload.get("passengerTrackUrl")

    email = str(payload.get("email") or "").strip().lower()
    if not email or "@" not in email:
        raise ValueError("Δεν υπάρχει έγκυρο email πελάτη")

    pnr = payload.get("pnr") or payload.get("booking_id") or "TICKET"
    subject = f"PoreiaGo — Εισιτήριο {pnr} · {payload.get('trip_title') or 'Εκδρομή'}"
    html = build_ticket_email_html(payload)
    ref = await send_email(email, subject, html)
    return {"ok": True, "email": email, "reference": ref, "logged_only": ref.startswith("email-log-")}
