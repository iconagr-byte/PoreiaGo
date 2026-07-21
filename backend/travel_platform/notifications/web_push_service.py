"""Web Push delivery for customer notifications (VAPID)."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def web_push_configured() -> bool:
    return bool(_vapid_private_key() and _vapid_public_key())


def _vapid_public_key() -> str:
    return os.getenv("WEB_PUSH_VAPID_PUBLIC_KEY", "").strip()


def _vapid_private_key() -> str:
    key_file = os.getenv("WEB_PUSH_VAPID_PRIVATE_KEY_FILE", "").strip()
    if key_file:
        path = Path(key_file)
        if path.is_file():
            return path.read_text(encoding="utf-8").strip()
    inline = os.getenv("WEB_PUSH_VAPID_PRIVATE_KEY", "").strip()
    if "\\n" in inline:
        return inline.replace("\\n", "\n")
    return inline


def _vapid_subject() -> str:
    subject = os.getenv("WEB_PUSH_VAPID_SUBJECT", "").strip()
    if subject:
        return subject
    reply = os.getenv("SMTP_REPLY_TO", "").strip()
    if reply and "@" in reply:
        return f"mailto:{reply}"
    return "mailto:noreply@aerostride.app"


def get_public_vapid_key() -> str | None:
    key = _vapid_public_key()
    return key or None


def _data_dir() -> Path:
    raw = (os.getenv("POREIAGO_DATA_DIR") or "").strip()
    if raw:
        return Path(raw)
    return Path(__file__).resolve().parents[2] / "data"


def _apply_vapid_env(*, public_key: str, private_pem: str, private_path: Path) -> None:
    os.environ["WEB_PUSH_VAPID_PUBLIC_KEY"] = public_key
    os.environ["WEB_PUSH_VAPID_PRIVATE_KEY_FILE"] = str(private_path)
    # Keep inline fallback for environments where the file path is not readable later.
    os.environ["WEB_PUSH_VAPID_PRIVATE_KEY"] = private_pem
    if not os.getenv("WEB_PUSH_VAPID_SUBJECT", "").strip():
        os.environ["WEB_PUSH_VAPID_SUBJECT"] = "mailto:iconagr@gmail.com"


def ensure_web_push_keys() -> bool:
    """
    Ensure VAPID keys exist for Web Push.

    If env/files are missing, generate a keypair into POREIAGO_DATA_DIR and
    export WEB_PUSH_VAPID_* into the process environment so admin/driver push
    works without a manual VPS bootstrap step.
    """
    if web_push_configured():
        return True

    data = _data_dir()
    public_path = data / "vapid_public.key"
    private_path = data / "vapid_private.pem"

    try:
        data.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        logger.warning("Cannot create VAPID data dir %s: %s", data, exc)
        return False

    if public_path.is_file() and private_path.is_file():
        public_key = public_path.read_text(encoding="utf-8").strip()
        private_pem = private_path.read_text(encoding="utf-8").strip()
        if public_key and private_pem:
            _apply_vapid_env(public_key=public_key, private_pem=private_pem, private_path=private_path)
            logger.info("Loaded Web Push VAPID keys from %s", data)
            return web_push_configured()

    try:
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

        private_key = ec.generate_private_key(ec.SECP256R1())
        pub_raw = private_key.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
        public_key = base64.urlsafe_b64encode(pub_raw).decode("ascii").rstrip("=")
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("ascii")
        public_path.write_text(public_key + "\n", encoding="utf-8")
        private_path.write_text(private_pem, encoding="utf-8")
        try:
            private_path.chmod(0o600)
        except OSError:
            pass
        _apply_vapid_env(public_key=public_key, private_pem=private_pem, private_path=private_path)
        logger.info("Generated Web Push VAPID keys in %s", data)
        return web_push_configured()
    except Exception as exc:
        logger.warning("Failed to auto-generate VAPID keys: %s", exc)
        return False


def build_fiscal_receipt_push_payload(
    booking: dict[str, Any],
    *,
    mark: str,
    amount: float,
    invoice_kind_label: str,
    invoice_id: str,
) -> dict[str, Any]:
    trip = booking.get("tripTitle") or "κράτησή σας"
    pnr = booking.get("pnr") or booking.get("id") or "—"
    booking_id = str(booking.get("id") or "")
    receipt_path = f"/wallet/receipt/{booking_id}" if booking_id else "/wallet"
    return {
        "title": "Εκδόθηκε φορολογική απόδειξη",
        "body": f"{invoice_kind_label} · MARK {mark} · €{float(amount):.2f} · PNR {pnr} · {trip}",
        "url": receipt_path,
        "tag": f"fiscal-{invoice_id}",
        "data": {
            "type": "fiscal_receipt_issued",
            "bookingId": booking_id,
            "mark": mark,
            "amount": float(amount),
            "invoiceKind": invoice_kind_label,
            "pnr": pnr,
        },
    }


def _send_sync(subscription: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    from pywebpush import webpush

    sub_info = {
        "endpoint": subscription["endpoint"],
        "keys": subscription.get("keys") or {},
    }
    body = json.dumps(payload, ensure_ascii=False)
    webpush(
        subscription_info=sub_info,
        data=body,
        vapid_private_key=_vapid_private_key(),
        vapid_claims={"sub": _vapid_subject()},
    )
    return {"sent": True, "endpoint": subscription.get("endpoint")}


async def send_push_to_subscription(subscription: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    if not web_push_configured():
        ensure_web_push_keys()
    if not web_push_configured():
        return {"skipped": True, "reason": "vapid_not_configured"}
    try:
        return await asyncio.to_thread(_send_sync, subscription, payload)
    except Exception as exc:
        from pywebpush import WebPushException

        if isinstance(exc, WebPushException):
            code = getattr(exc, "status_code", None)
            response = getattr(exc, "response", None)
            if response is not None:
                code = getattr(response, "status_code", code)
            if code in (404, 410):
                from travel_platform.notifications.push_subscription_store import delete_subscription_by_endpoint

                delete_subscription_by_endpoint(str(subscription.get("endpoint") or ""))
                return {"removed": True, "reason": "expired", "status": code}
        logger.warning("Web push failed endpoint=%s: %s", subscription.get("endpoint"), exc)
        return {"error": str(exc)[:200]}


async def send_push_to_email(email: str, payload: dict[str, Any]) -> dict[str, Any]:
    from travel_platform.notifications.push_subscription_store import list_subscriptions_for_email

    if not web_push_configured():
        ensure_web_push_keys()
    if not web_push_configured():
        return {"skipped": True, "reason": "vapid_not_configured"}

    subs = list_subscriptions_for_email(email)
    if not subs:
        return {"skipped": True, "reason": "no_subscriptions"}

    results: list[dict[str, Any]] = []
    sent = 0
    for sub in subs:
        result = await send_push_to_subscription(sub, payload)
        results.append(result)
        if result.get("sent"):
            sent += 1
    return {"email": email, "attempted": len(subs), "sent": sent, "results": results}
