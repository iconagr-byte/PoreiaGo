"""Firebase Cloud Messaging (FCM) delivery for native Capacitor apps."""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_FCM_APP = None
_FCM_INIT_ATTEMPTED = False


def fcm_endpoint_for_token(token: str) -> str:
    tok = str(token or "").strip()
    return f"fcm:{tok}" if tok else ""


def fcm_token_from_subscription(subscription: dict[str, Any] | None) -> str:
    if not subscription:
        return ""
    explicit = str(subscription.get("fcm_token") or "").strip()
    if explicit:
        return explicit
    endpoint = str(subscription.get("endpoint") or "").strip()
    if endpoint.startswith("fcm:"):
        return endpoint[4:].strip()
    return ""


def is_fcm_subscription(subscription: dict[str, Any] | None) -> bool:
    if not subscription:
        return False
    channel = str(subscription.get("channel") or "").strip().lower()
    if channel == "fcm":
        return True
    return str(subscription.get("endpoint") or "").startswith("fcm:")


def _service_account_path() -> Path | None:
    for key in ("FIREBASE_SERVICE_ACCOUNT_FILE", "GOOGLE_APPLICATION_CREDENTIALS"):
        raw = (os.getenv(key) or "").strip()
        if not raw:
            continue
        path = Path(raw)
        if path.is_file():
            return path
    return None


def _service_account_dict() -> dict[str, Any] | None:
    inline = (os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON") or "").strip()
    if inline:
        try:
            data = json.loads(inline)
            if isinstance(data, dict) and data.get("private_key"):
                return data
        except json.JSONDecodeError:
            logger.warning("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON")
    path = _service_account_path()
    if not path:
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and data.get("private_key"):
            return data
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Cannot read Firebase service account %s: %s", path, exc)
    return None


def fcm_configured() -> bool:
    return _service_account_dict() is not None


def _ensure_firebase_app():
    global _FCM_APP, _FCM_INIT_ATTEMPTED
    if _FCM_APP is not None:
        return _FCM_APP
    if _FCM_INIT_ATTEMPTED and _FCM_APP is None:
        return None
    _FCM_INIT_ATTEMPTED = True
    creds_dict = _service_account_dict()
    if not creds_dict:
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials

        if firebase_admin._apps:
            _FCM_APP = firebase_admin.get_app()
            return _FCM_APP
        cred = credentials.Certificate(creds_dict)
        _FCM_APP = firebase_admin.initialize_app(cred)
        return _FCM_APP
    except Exception as exc:
        logger.warning("Firebase Admin init failed: %s", exc)
        return None


def _build_message(token: str, payload: dict[str, Any]):
    from firebase_admin import messaging

    title = str(payload.get("title") or "PoreiaGo")
    body = str(payload.get("body") or "")
    url = str(payload.get("url") or "")
    tag = str(payload.get("tag") or "")
    data_obj = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    data: dict[str, str] = {
        "title": title,
        "body": body,
        "url": url,
        "tag": tag,
    }
    for key, value in data_obj.items():
        if value is None:
            continue
        data[str(key)] = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)

    android = messaging.AndroidConfig(
        priority="high",
        notification=messaging.AndroidNotification(
            title=title,
            body=body,
            channel_id="poreiago_default",
            tag=tag or None,
            click_action="OPEN_APP",
        ),
    )
    return messaging.Message(
        token=token,
        notification=messaging.Notification(title=title, body=body),
        data=data,
        android=android,
    )


def _send_sync(subscription: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    token = fcm_token_from_subscription(subscription)
    if not token:
        return {"error": "missing_fcm_token"}
    app = _ensure_firebase_app()
    if app is None:
        return {"skipped": True, "reason": "fcm_not_configured"}
    from firebase_admin import messaging

    message = _build_message(token, payload)
    try:
        message_id = messaging.send(message, app=app)
        return {"sent": True, "channel": "fcm", "endpoint": subscription.get("endpoint"), "id": message_id}
    except messaging.UnregisteredError:
        from travel_platform.notifications.push_subscription_store import delete_subscription_by_endpoint

        delete_subscription_by_endpoint(str(subscription.get("endpoint") or ""))
        return {"removed": True, "reason": "unregistered", "channel": "fcm"}
    except Exception as exc:
        # Some SDK versions use NotFoundError / SenderIdMismatchError for dead tokens.
        name = type(exc).__name__
        if name in ("UnregisteredError", "NotFoundError", "SenderIdMismatchError"):
            from travel_platform.notifications.push_subscription_store import delete_subscription_by_endpoint

            delete_subscription_by_endpoint(str(subscription.get("endpoint") or ""))
            return {"removed": True, "reason": name, "channel": "fcm"}
        logger.warning("FCM send failed token=%s…: %s", token[:12], exc)
        return {"error": str(exc)[:200], "channel": "fcm"}


async def send_fcm_to_subscription(subscription: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    if not fcm_configured():
        return {"skipped": True, "reason": "fcm_not_configured"}
    try:
        return await asyncio.to_thread(_send_sync, subscription, payload)
    except Exception as exc:
        logger.warning("FCM async send failed: %s", exc)
        return {"error": str(exc)[:200], "channel": "fcm"}
