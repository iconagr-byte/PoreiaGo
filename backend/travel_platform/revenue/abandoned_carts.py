"""File-backed abandoned checkout carts + recovery scan (no Celery required)."""

from __future__ import annotations

import json
import secrets
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from travel_platform.notifications.dispatcher import send_email, send_sms
from travel_platform.settings.platform_store import get_platform_config

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
STORE_PATH = DATA_DIR / "abandoned_carts.json"


@dataclass
class AbandonedCart:
    id: str
    resume_token: str
    trip_id: int
    trip_title: str
    seats: str
    amount_eur: float
    passenger_name: str
    passenger_email: str
    passenger_phone: str
    created_at: str
    updated_at: str
    recovery_sent_at: str | None = None
    completed_at: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _load() -> list[dict[str, Any]]:
    if not STORE_PATH.exists():
        return []
    try:
        raw = json.loads(STORE_PATH.read_text(encoding="utf-8"))
        return raw.get("carts", []) if isinstance(raw, dict) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _save(carts: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    STORE_PATH.write_text(
        json.dumps({"carts": carts}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def upsert_cart(
    *,
    trip_id: int,
    trip_title: str,
    seats: str,
    amount_eur: float,
    passenger_name: str = "",
    passenger_email: str = "",
    passenger_phone: str = "",
    resume_token: str | None = None,
) -> AbandonedCart:
    carts = _load()
    token = resume_token or secrets.token_urlsafe(16)
    now = datetime.now(timezone.utc).isoformat()

    existing = next((c for c in carts if c.get("resume_token") == token), None)
    if existing:
        existing.update(
            {
                "trip_id": trip_id,
                "trip_title": trip_title,
                "seats": seats,
                "amount_eur": amount_eur,
                "passenger_name": passenger_name,
                "passenger_email": passenger_email,
                "passenger_phone": passenger_phone,
                "updated_at": now,
            }
        )
        _save(carts)
        return AbandonedCart(**existing)

    cart_id = f"AC-{secrets.token_hex(4).upper()}"
    row = AbandonedCart(
        id=cart_id,
        resume_token=token,
        trip_id=trip_id,
        trip_title=trip_title,
        seats=seats,
        amount_eur=amount_eur,
        passenger_name=passenger_name,
        passenger_email=passenger_email,
        passenger_phone=passenger_phone,
        created_at=now,
        updated_at=now,
    )
    carts.append(row.to_dict())
    _save(carts)
    return row


def get_by_resume_token(token: str) -> AbandonedCart | None:
    for c in _load():
        if c.get("resume_token") == token and not c.get("completed_at"):
            return AbandonedCart(**c)
    return None


def mark_completed(resume_token: str) -> bool:
    carts = _load()
    found = False
    for c in carts:
        if c.get("resume_token") == resume_token:
            c["completed_at"] = datetime.now(timezone.utc).isoformat()
            found = True
    if found:
        _save(carts)
    return found


def list_carts(*, include_completed: bool = False) -> list[AbandonedCart]:
    out = []
    for c in _load():
        if c.get("completed_at") and not include_completed:
            continue
        out.append(AbandonedCart(**c))
    out.sort(key=lambda x: x.updated_at, reverse=True)
    return out


def find_recovery_candidates(
    *,
    pending_minutes: int | None = None,
    base_url: str,
) -> list[tuple[AbandonedCart, str]]:
    cfg = get_platform_config()
    minutes = pending_minutes if pending_minutes is not None else cfg.abandoned_pending_minutes
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=max(minutes, 0))
    candidates: list[tuple[AbandonedCart, str]] = []

    for c in list_carts(include_completed=False):
        if c.recovery_sent_at:
            continue
        if not c.passenger_email and not c.passenger_phone:
            continue
        if minutes > 0:
            updated = datetime.fromisoformat(c.updated_at.replace("Z", "+00:00"))
            if updated.tzinfo is None:
                updated = updated.replace(tzinfo=timezone.utc)
            if updated > cutoff:
                continue
        url = f"{base_url.rstrip('/')}/checkout/resume/{c.resume_token}"
        candidates.append((c, url))
    return candidates


async def scan_and_send_recovery(*, base_url: str | None = None, pending_minutes: int | None = None) -> dict:
    if not base_url:
        try:
            from travel_platform.growth.branding_store import get_branding

            base_url = get_branding().checkout_base_url
        except Exception:
            cfg = get_platform_config()
            base_url = getattr(cfg, "checkout_base_url", None) or "http://localhost:5173"
    candidates = find_recovery_candidates(pending_minutes=pending_minutes, base_url=base_url)
    sent = 0
    errors: list[str] = []

    carts = _load()
    for cart, checkout_url in candidates:
        subject = f"Ολοκληρώστε την κράτησή σας — {cart.trip_title}"
        body = (
            f"<p>Γεια σας {cart.passenger_name or ''},</p>"
            f"<p>Η κράτησή σας για <strong>{cart.trip_title}</strong> "
            f"(θέσεις: {cart.seats}) περιμένει ολοκλήρωση.</p>"
            f'<p><a href="{checkout_url}">Συνέχεια πληρωμής</a></p>'
            f"<p>Ποσό: €{cart.amount_eur:.2f}</p>"
        )
        sms = (
            f"Achillio: Ολοκληρώστε την κράτηση για {cart.trip_title}: {checkout_url}"
        )
        try:
            if cart.passenger_email:
                await send_email(cart.passenger_email, subject, body)
            if cart.passenger_phone:
                await send_sms(cart.passenger_phone, sms)
            if not cart.passenger_email and not cart.passenger_phone:
                continue
            sent += 1
            now = datetime.now(timezone.utc).isoformat()
            for row in carts:
                if row.get("id") == cart.id:
                    row["recovery_sent_at"] = now
        except Exception as exc:
            errors.append(f"{cart.id}: {exc}")

    _save(carts)
    return {
        "candidates": len(candidates),
        "sent": sent,
        "errors": errors,
    }
