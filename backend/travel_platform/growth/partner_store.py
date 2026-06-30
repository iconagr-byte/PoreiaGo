"""File-backed partner webhook subscriptions + delivery log."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
STORE_PATH = DATA_DIR / "partner_webhooks.json"
DELIVERY_LOG = DATA_DIR / "partner_webhooks.log"

VALID_EVENTS = {
    "booking.confirmed",
    "booking.cancelled",
    "trip.departed",
    "trip.completed",
    "passenger.boarded",
    "fiscal.receipt_issued",
    "fleet.location",
}


@dataclass
class WebhookSubscription:
    id: str
    partner_name: str
    target_url: str
    event_types: list[str]
    active: bool = True
    created_at: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _secret() -> str:
    return os.getenv("WEBHOOK_SIGNING_SECRET", "dev-webhook-secret")


def _load() -> list[dict[str, Any]]:
    if not STORE_PATH.exists():
        return []
    try:
        raw = json.loads(STORE_PATH.read_text(encoding="utf-8"))
        return raw.get("subscriptions", [])
    except (json.JSONDecodeError, TypeError):
        return []


def _save(subs: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    STORE_PATH.write_text(
        json.dumps({"subscriptions": subs}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def list_subscriptions() -> list[WebhookSubscription]:
    return [WebhookSubscription(**s) for s in _load()]


def register_subscription(
    *,
    partner_name: str,
    target_url: str,
    event_types: list[str],
) -> WebhookSubscription:
    invalid = [e for e in event_types if e not in VALID_EVENTS]
    if invalid:
        raise ValueError(f"Invalid event types: {invalid}")
    sub = WebhookSubscription(
        id=str(uuid.uuid4()),
        partner_name=partner_name,
        target_url=target_url,
        event_types=event_types,
        active=True,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    subs = _load()
    subs.append(sub.to_dict())
    _save(subs)
    return sub


def delete_subscription(sub_id: str) -> bool:
    subs = _load()
    new_subs = [s for s in subs if s.get("id") != sub_id]
    if len(new_subs) == len(subs):
        return False
    _save(new_subs)
    return True


def _append_log(line: str) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    DELIVERY_LOG.write_text(
        (DELIVERY_LOG.read_text(encoding="utf-8") if DELIVERY_LOG.exists() else "")
        + line
        + "\n",
        encoding="utf-8",
    )


def dispatch_event(event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Deliver to all active subscriptions matching event_type."""
    if event_type not in VALID_EVENTS:
        raise ValueError(f"Unknown event: {event_type}")

    event_id = str(uuid.uuid4())
    occurred_at = datetime.now(timezone.utc).isoformat()
    body = json.dumps(
        {
            "id": event_id,
            "type": event_type,
            "occurred_at": occurred_at,
            "data": payload,
        },
        separators=(",", ":"),
    )
    signature = hmac.new(_secret().encode(), body.encode(), hashlib.sha256).hexdigest()
    headers = {
        "Content-Type": "application/json",
        "X-PoreiaGo-Event": event_type,
        "X-PoreiaGo-Signature": f"sha256={signature}",
        "X-PoreiaGo-Delivery": event_id,
    }

    results: list[dict[str, Any]] = []
    for sub in _load():
        if not sub.get("active", True):
            continue
        if event_type not in (sub.get("event_types") or []):
            continue
        url = sub["target_url"]
        status = "ok"
        detail = ""
        try:
            with httpx.Client(timeout=10) as client:
                resp = client.post(url, content=body, headers=headers)
                resp.raise_for_status()
                detail = f"http_{resp.status_code}"
        except Exception as exc:
            status = "error"
            detail = str(exc)[:200]
            logger.warning("Webhook to %s failed: %s", url, exc)

        line = f"[{occurred_at}] event={event_type} partner={sub.get('partner_name')} url={url} status={status} {detail}"
        _append_log(line)
        results.append(
            {
                "subscription_id": sub["id"],
                "partner_name": sub.get("partner_name"),
                "status": status,
                "detail": detail,
            }
        )

    return {"event_id": event_id, "delivered": len(results), "results": results}
