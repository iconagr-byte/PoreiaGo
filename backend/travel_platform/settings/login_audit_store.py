"""Append-only login audit (admin / customer / driver) under POREIAGO_DATA_DIR."""

from __future__ import annotations

import json
import logging
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

logger = logging.getLogger(__name__)

ActorType = Literal["admin", "customer", "driver"]

_DATA_DIR = Path(os.getenv("POREIAGO_DATA_DIR") or Path(__file__).resolve().parents[2] / "data")
STORE_PATH = Path(os.getenv("LOGIN_AUDIT_STORE") or (_DATA_DIR / "login_audit.json"))
_MAX_ENTRIES = 2_000
_lock = threading.Lock()

ACTOR_LABELS = {
    "admin": "Διαχειριστής",
    "customer": "Πελάτης",
    "driver": "Οδηγός",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _empty() -> dict[str, Any]:
    return {"entries": []}


def reset_login_audit_store_for_tests(path: Path | None = None) -> None:
    global STORE_PATH
    if path is not None:
        STORE_PATH = Path(path)
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _lock:
        _save(_empty())


def _load() -> dict[str, Any]:
    if not STORE_PATH.exists():
        return _empty()
    try:
        data = json.loads(STORE_PATH.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("entries"), list):
            return data
        if isinstance(data, list):
            return {"entries": data}
    except (json.JSONDecodeError, OSError, TypeError) as exc:
        logger.warning("login audit load failed: %s", exc)
    return _empty()


def _save(data: dict[str, Any]) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = STORE_PATH.with_suffix(".tmp")
    payload = {"entries": list(data.get("entries") or [])[:_MAX_ENTRIES]}
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(STORE_PATH)


def extract_client_ip(request: Any) -> str | None:
    try:
        headers = getattr(request, "headers", None) or {}
        forwarded = headers.get("X-Forwarded-For") or headers.get("x-forwarded-for")
        if forwarded:
            return str(forwarded).split(",")[0].strip() or None
        client = getattr(request, "client", None)
        if client and getattr(client, "host", None):
            return str(client.host)
    except Exception:
        return None
    return None


def extract_user_agent(request: Any) -> str | None:
    try:
        headers = getattr(request, "headers", None) or {}
        ua = headers.get("User-Agent") or headers.get("user-agent")
        if ua:
            return str(ua)[:500]
    except Exception:
        return None
    return None


def summarize_device(user_agent: str | None) -> str:
    ua = (user_agent or "").lower()
    if not ua:
        return "Άγνωστη συσκευή"
    if "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    elif "android" in ua:
        os_name = "Android"
    elif "mac os" in ua or "macintosh" in ua:
        os_name = "macOS"
    elif "windows" in ua:
        os_name = "Windows"
    elif "linux" in ua:
        os_name = "Linux"
    else:
        os_name = "Άλλο"

    if "edg/" in ua or "edg " in ua:
        browser = "Edge"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "chrome" in ua and "chromium" not in ua:
        browser = "Chrome"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    else:
        browser = "Browser"
    return f"{browser} · {os_name}"


def append_login_event(
    *,
    actor_type: ActorType,
    identity: str,
    success: bool,
    ip: str | None = None,
    user_agent: str | None = None,
    actor_id: str | None = None,
    actor_name: str | None = None,
    method: str | None = None,
    detail: str | None = None,
    tenant_id: str | None = None,
) -> dict[str, Any]:
    actor = actor_type if actor_type in ("admin", "customer", "driver") else "admin"
    ident = " ".join(str(identity or "").split()).strip()[:200] or "—"
    ua = (user_agent or None)
    if ua:
        ua = ua[:500]
    entry = {
        "id": uuid.uuid4().hex[:16],
        "at": _now_iso(),
        "actor_type": actor,
        "actor_id": (str(actor_id).strip() if actor_id else None) or None,
        "identity": ident,
        "actor_name": (str(actor_name).strip() if actor_name else None) or None,
        "success": bool(success),
        "ip": (str(ip).strip() if ip else None) or None,
        "user_agent": ua,
        "device": summarize_device(ua),
        "method": (str(method).strip() if method else None) or "password",
        "detail": (str(detail).strip() if detail else None) or None,
        "tenant_id": (str(tenant_id).strip() if tenant_id else None) or None,
    }
    with _lock:
        data = _load()
        data["entries"].insert(0, entry)
        data["entries"] = data["entries"][:_MAX_ENTRIES]
        _save(data)
    return entry


def record_login_from_request(
    request: Any,
    *,
    actor_type: ActorType,
    identity: str,
    success: bool,
    actor_id: str | None = None,
    actor_name: str | None = None,
    method: str | None = None,
    detail: str | None = None,
    tenant_id: str | None = None,
) -> dict[str, Any] | None:
    """Best-effort record — never raises into the auth flow."""
    try:
        return append_login_event(
            actor_type=actor_type,
            identity=identity,
            success=success,
            ip=extract_client_ip(request),
            user_agent=extract_user_agent(request),
            actor_id=actor_id,
            actor_name=actor_name,
            method=method,
            detail=detail,
            tenant_id=tenant_id,
        )
    except Exception as exc:
        logger.warning("login audit record failed: %s", exc)
        return None


def list_login_events(
    *,
    limit: int = 100,
    actor_type: str | None = None,
    success: bool | None = None,
    q: str | None = None,
) -> list[dict[str, Any]]:
    cap = max(1, min(int(limit), 500))
    needle = " ".join(str(q or "").lower().split()).strip()
    actor = (actor_type or "").strip().lower() or None
    with _lock:
        rows = list((_load().get("entries") or []))
    out: list[dict[str, Any]] = []
    for row in rows:
        if actor and str(row.get("actor_type") or "") != actor:
            continue
        if success is not None and bool(row.get("success")) != bool(success):
            continue
        if needle:
            blob = " ".join(
                str(row.get(k) or "")
                for k in ("identity", "actor_name", "ip", "device", "detail", "actor_id")
            ).lower()
            if needle not in blob:
                continue
        out.append(dict(row))
        if len(out) >= cap:
            break
    return out


def actor_type_label(actor_type: str | None) -> str:
    return ACTOR_LABELS.get(str(actor_type or ""), str(actor_type or "—"))
