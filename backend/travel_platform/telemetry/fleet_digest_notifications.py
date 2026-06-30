"""Fleet digest — email & SMS notifications για dispatchers."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def build_fleet_digest_sms(digest: dict[str, Any]) -> str:
    summary = digest.get("summary") or {}
    days = digest.get("digest_period_days") or 1
    km = float(summary.get("total_distance_km") or 0)
    drivers = int(summary.get("drivers_with_gps") or 0)
    alerts = int(summary.get("alerts_total") or 0)
    online = int(summary.get("active_drivers_now") or 0)
    deviations = int(summary.get("alerts_route_deviation") or 0)
    tenant = str(digest.get("tenant_id") or "")[:8]
    return (
        f"AeroStride Fleet ({tenant}…): {days}η — {km:.0f}km, "
        f"{drivers} οδηγοί GPS, {alerts} alerts ({deviations} αποκλίσεις), {online} online τώρα."
    )


def build_fleet_digest_email_subject(digest: dict[str, Any]) -> str:
    days = digest.get("digest_period_days") or 1
    tenant = str(digest.get("tenant_id") or "tenant")[:8]
    return f"[Fleet digest] {days}η — tenant {tenant}…"


def build_fleet_digest_email_html(digest: dict[str, Any]) -> str:
    summary = digest.get("summary") or {}
    top_trips = digest.get("top_trips") or []
    alerts_by_type = digest.get("alerts_by_type") or {}
    days = digest.get("digest_period_days") or 1

    trip_rows = "".join(
        (
            "<tr>"
            f"<td style='padding:6px;border-bottom:1px solid #e2e8f0;'>{t.get('trip_id', '—')}</td>"
            f"<td style='padding:6px;border-bottom:1px solid #e2e8f0;'>{float(t.get('distance_km') or 0):.1f} km</td>"
            f"<td style='padding:6px;border-bottom:1px solid #e2e8f0;'>{int(t.get('gps_points') or 0)}</td>"
            "</tr>"
        )
        for t in top_trips[:5]
    ) or "<tr><td colspan='3' style='padding:8px;'>—</td></tr>"

    alert_items = "".join(
        f"<li><strong>{k}</strong>: {v}</li>" for k, v in sorted(alerts_by_type.items())
    ) or "<li>Κανένα alert</li>"

    body = f"""
    <h2 style="margin:0 0 12px;font-family:sans-serif;">Ημερήσιο fleet digest ({days} ημέρα/ες)</h2>
    <p style="font-family:sans-serif;color:#475569;">Tenant: <code>{digest.get('tenant_id')}</code></p>
    <table cellpadding="0" cellspacing="0" style="font-family:sans-serif;font-size:14px;margin:16px 0;">
      <tr><td style="padding:4px 12px 4px 0;"><strong>Χιλιόμετρα</strong></td><td>{float(summary.get('total_distance_km') or 0):.1f} km</td></tr>
      <tr><td style="padding:4px 12px 4px 0;"><strong>Οδηγοί με GPS</strong></td><td>{int(summary.get('drivers_with_gps') or 0)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;"><strong>GPS points</strong></td><td>{int(summary.get('gps_points') or 0)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;"><strong>Online τώρα</strong></td><td>{int(summary.get('active_drivers_now') or 0)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;"><strong>Alerts</strong></td><td>{int(summary.get('alerts_total') or 0)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;"><strong>Αποκλίσεις διαδρομής</strong></td><td>{int(summary.get('alerts_route_deviation') or 0)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;"><strong>Driver online/offline</strong></td><td>{int(summary.get('alerts_driver_online') or 0)} / {int(summary.get('alerts_driver_offline') or 0)}</td></tr>
    </table>
    <h3 style="font-family:sans-serif;">Top trips (km)</h3>
    <table width="100%" style="border-collapse:collapse;font-family:sans-serif;font-size:13px;">
      <thead><tr style="background:#f1f5f9;text-align:left;">
        <th style="padding:8px;">Trip</th><th style="padding:8px;">Km</th><th style="padding:8px;">GPS</th>
      </tr></thead>
      <tbody>{trip_rows}</tbody>
    </table>
    <h3 style="font-family:sans-serif;">Alerts ανά τύπο</h3>
    <ul style="font-family:sans-serif;">{alert_items}</ul>
    """
    try:
        from ticketing.payment_confirmation_email import _wrap_html

        return _wrap_html(body, title="Fleet digest")
    except Exception:
        return f"<html><body>{body}</body></html>"


async def send_fleet_digest_notifications(digest: dict[str, Any]) -> dict[str, Any]:
    from travel_platform.telemetry.fleet_digest_service import admin_recipients, fleet_digest_settings
    from travel_platform.telemetry.settings_store import get_telemetry_settings

    cfg = fleet_digest_settings()
    if not cfg["enabled"]:
        return {"skipped": True, "reason": "disabled"}

    tenant_id = str(digest.get("tenant_id") or "")
    tenant_settings = get_telemetry_settings(tenant_id or None)
    if not tenant_settings.fleet_digest_enabled:
        return {"skipped": True, "reason": "tenant_disabled"}

    recipients = admin_recipients()
    result: dict[str, Any] = {"tenant_id": tenant_id}

    if recipients["email"] and tenant_settings.fleet_digest_email_enabled:
        from travel_platform.notifications.dispatcher import send_email

        try:
            ref = await send_email(
                recipients["email"],
                build_fleet_digest_email_subject(digest),
                build_fleet_digest_email_html(digest),
            )
            result["email"] = {"to": recipients["email"], "reference": ref}
        except Exception as exc:
            logger.warning("Fleet digest email failed tenant=%s: %s", tenant_id, exc)
            result["email"] = {"error": str(exc)}

    if recipients["phone"] and tenant_settings.fleet_digest_sms_enabled:
        from travel_platform.notifications.dispatcher import send_sms
        from ticketing.fiscal_notifications import normalize_phone

        phone = normalize_phone(recipients["phone"])
        if phone:
            try:
                ref = await send_sms(phone, build_fleet_digest_sms(digest))
                result["sms"] = {"to": phone, "reference": ref}
            except Exception as exc:
                logger.warning("Fleet digest SMS failed tenant=%s: %s", tenant_id, exc)
                result["sms"] = {"error": str(exc)}

    if not result.get("email") and not result.get("sms"):
        result["skipped"] = True
        result["reason"] = "no_recipients"
    return result


async def run_fleet_digest_job() -> dict[str, Any]:
    from travel_platform.telemetry.fleet_digest_service import collect_all_fleet_digests, fleet_digest_settings

    cfg = fleet_digest_settings()
    if not cfg["enabled"]:
        return {"skipped": True, "reason": "disabled"}

    try:
        from app.core.database import AsyncSessionLocal
    except ImportError:
        from database import AsyncSessionLocal

    sent: list[dict[str, Any]] = []
    async with AsyncSessionLocal() as session:
        digests = await collect_all_fleet_digests(session, lookback_days=int(cfg["lookback_days"]))
        for digest in digests:
            outcome = await send_fleet_digest_notifications(digest)
            sent.append(outcome)
    return {"tenants": len(digests), "results": sent}
