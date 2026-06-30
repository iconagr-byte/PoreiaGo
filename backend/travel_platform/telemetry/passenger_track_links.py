"""Build signed passenger live-track URLs for bookings and emails."""

from __future__ import annotations

import os
from typing import Any
from uuid import UUID

DEMO_TENANT = "00000000-0000-0000-0000-000000000001"


def public_frontend_base() -> str:
    return (
        os.getenv("PUBLIC_APP_URL")
        or os.getenv("VITE_APP_URL")
        or "http://localhost:5173"
    ).rstrip("/")


def resolve_booking_trip_id(booking: dict[str, Any]) -> int | None:
    raw = booking.get("tripId") or booking.get("trip_id")
    try:
        trip_id = int(raw)
    except (TypeError, ValueError):
        return None
    return trip_id if trip_id > 0 else None


def resolve_booking_tenant_id(booking: dict[str, Any]) -> str:
    return str(
        booking.get("tenantId")
        or booking.get("tenant_id")
        or os.getenv("SAAS_DEFAULT_TENANT_ID")
        or os.getenv("DEFAULT_TENANT_ID")
        or DEMO_TENANT,
    )


def build_passenger_track_link(
    *,
    trip_id: int,
    tenant_id: str | UUID,
    ttl_hours: int | None = None,
    frontend_base: str | None = None,
) -> dict[str, Any] | None:
    from travel_platform.telemetry.passenger_track_token import (
        DEFAULT_TTL_HOURS,
        create_passenger_track_token,
    )

    hours = ttl_hours if ttl_hours is not None else DEFAULT_TTL_HOURS
    try:
        token = create_passenger_track_token(
            trip_id=trip_id,
            tenant_id=tenant_id,
            ttl_hours=hours,
        )
    except Exception:
        return None

    tid = str(tenant_id)
    base = (frontend_base or public_frontend_base()).rstrip("/")
    path = f"/track/trip/{trip_id}?tenant_id={tid}&token={token}"
    return {
        "trip_id": trip_id,
        "tenant_id": tid,
        "token": token,
        "path": path,
        "url": f"{base}{path}",
        "expires_hours": hours,
    }


def enrich_booking_passenger_track(
    booking: dict[str, Any],
    *,
    ttl_hours: int | None = None,
    force: bool = False,
) -> dict[str, Any]:
    """Attach passengerTrackUrl to booking dict when trip_id is known."""
    out = dict(booking)
    if not force and out.get("passengerTrackUrl"):
        return out
    trip_id = resolve_booking_trip_id(out)
    if not trip_id:
        return out
    link = build_passenger_track_link(
        trip_id=trip_id,
        tenant_id=resolve_booking_tenant_id(out),
        ttl_hours=ttl_hours,
    )
    if not link:
        return out
    out["passengerTrackUrl"] = link["url"]
    out["passengerTrackPath"] = link["path"]
    out["passengerTrackExpiresHours"] = link["expires_hours"]
    return out


def track_link_email_block(url: str | None) -> str:
    if not url:
        return ""
    safe = str(url).replace('"', "&quot;")
    return f"""
    <div style="margin:24px 0;text-align:center;padding:20px;background:#0f172a;border-radius:16px;">
      <p style="margin:0 0 14px;font-size:13px;color:#cbd5e1;font-weight:600;">
        Παρακολουθήστε το λεωφορείο live
      </p>
      <a href="{safe}" style="display:inline-block;padding:14px 28px;background:#facc15;color:#0a0a0a;font-weight:bold;text-decoration:none;border-radius:999px;font-size:15px;">
        Ζωντανή θέση &amp; ώρα άφιξης
      </a>
      <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;line-height:1.5;">
        Χάρτης με GPS, επόμενη στάση και ETA — χωρίς login.
      </p>
    </div>
    """
