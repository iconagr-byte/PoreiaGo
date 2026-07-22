"""Persist Web Push subscriptions per customer/admin (JSON file on durable volume)."""

from __future__ import annotations

import json
import logging
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Legacy path inside the image (wiped on every API recreate / deploy).
_LEGACY_STORE_FILE = Path(__file__).resolve().parent / "push_subscriptions.json"


def _data_dir() -> Path:
    raw = (os.getenv("POREIAGO_DATA_DIR") or "").strip()
    if raw:
        return Path(raw)
    return Path(__file__).resolve().parents[2] / "data"


def _store_path() -> Path:
    """Durable path on the api_data volume (`/app/data` in production)."""
    return _data_dir() / "push_subscriptions.json"


# Tests patch this name; keep a module-level Path that resolves at call time via _resolved_store.
_STORE_FILE: Path | None = None


def _resolved_store() -> Path:
    if _STORE_FILE is not None:
        return _STORE_FILE
    return _store_path()


def _migrate_legacy_if_needed(target: Path) -> None:
    """Copy image-local subscriptions into the durable volume once."""
    if target.exists():
        return
    if not _LEGACY_STORE_FILE.is_file():
        return
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(_LEGACY_STORE_FILE, target)
        logger.info("Migrated push subscriptions from %s → %s", _LEGACY_STORE_FILE, target)
    except OSError as exc:
        logger.warning("Could not migrate legacy push subscriptions: %s", exc)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load() -> dict[str, Any]:
    path = _resolved_store()
    _migrate_legacy_if_needed(path)
    if not path.exists():
        return {"subscriptions": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("subscriptions"), list):
            return data
    except (json.JSONDecodeError, OSError):
        pass
    return {"subscriptions": []}


def _save(data: dict[str, Any]) -> None:
    path = _resolved_store()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def list_subscriptions_for_email(
    email: str,
    *,
    audience: str | None = None,
) -> list[dict[str, Any]]:
    target = _normalize_email(email)
    if not target:
        return []
    rows: list[dict[str, Any]] = []
    for row in _load().get("subscriptions", []):
        if _normalize_email(row.get("email")) != target:
            continue
        if audience is not None:
            row_audience = str(row.get("audience") or "customer")
            if row_audience != audience:
                continue
        rows.append(dict(row))
    return rows


def list_subscriptions_for_tenant(tenant_id: str, *, audience: str | None = "admin") -> list[dict[str, Any]]:
    tid = str(tenant_id or "").strip()
    if not tid:
        return []
    rows: list[dict[str, Any]] = []
    for row in _load().get("subscriptions", []):
        if str(row.get("tenant_id") or "") != tid:
            continue
        row_audience = str(row.get("audience") or "customer")
        if audience and row_audience != audience:
            continue
        rows.append(dict(row))
    return rows


def list_all_subscriptions(*, audience: str | None = "admin") -> list[dict[str, Any]]:
    """All push subscriptions for an audience (fallback when tenant ids diverge)."""
    rows: list[dict[str, Any]] = []
    for row in _load().get("subscriptions", []):
        row_audience = str(row.get("audience") or "customer")
        if audience and row_audience != audience:
            continue
        rows.append(dict(row))
    return rows


def list_subscriptions_for_driver(
    tenant_id: str,
    driver_id: str | None = None,
) -> list[dict[str, Any]]:
    """Driver PWA push targets — optional filter by driver_id."""
    tid = str(tenant_id or "").strip()
    if not tid:
        return []
    did = str(driver_id or "").strip() or None
    rows: list[dict[str, Any]] = []
    for row in _load().get("subscriptions", []):
        if str(row.get("audience") or "") != "driver":
            continue
        if str(row.get("tenant_id") or "") != tid:
            continue
        row_driver = str(row.get("driver_id") or "").strip()
        if did and row_driver and row_driver != did:
            continue
        rows.append(dict(row))
    return rows


def upsert_subscription(
    *,
    email: str,
    endpoint: str,
    keys: dict[str, str],
    user_agent: str | None = None,
    tenant_id: str | None = None,
    audience: str = "customer",
    driver_id: str | None = None,
) -> dict[str, Any]:
    normalized_email = _normalize_email(email)
    endpoint = str(endpoint or "").strip()
    p256dh = str((keys or {}).get("p256dh") or "").strip()
    auth = str((keys or {}).get("auth") or "").strip()
    if not normalized_email or not endpoint or not p256dh or not auth:
        raise ValueError("Invalid push subscription payload")

    data = _load()
    rows: list[dict[str, Any]] = list(data.get("subscriptions") or [])
    now = _now_iso()

    for row in rows:
        if row.get("endpoint") == endpoint:
            row["email"] = normalized_email
            row["keys"] = {"p256dh": p256dh, "auth": auth}
            row["user_agent"] = user_agent or row.get("user_agent") or ""
            if tenant_id:
                row["tenant_id"] = str(tenant_id)
            if audience:
                row["audience"] = audience
            if driver_id is not None:
                row["driver_id"] = str(driver_id).strip() or None
            row["updated_at"] = now
            _save({"subscriptions": rows})
            return dict(row)

    created = {
        "id": uuid.uuid4().hex,
        "email": normalized_email,
        "endpoint": endpoint,
        "keys": {"p256dh": p256dh, "auth": auth},
        "user_agent": user_agent or "",
        "tenant_id": str(tenant_id) if tenant_id else None,
        "audience": audience or "customer",
        "driver_id": str(driver_id).strip() if driver_id else None,
        "created_at": now,
        "updated_at": now,
    }
    rows.append(created)
    _save({"subscriptions": rows})
    return created


def delete_subscription(*, email: str, endpoint: str) -> bool:
    normalized_email = _normalize_email(email)
    endpoint = str(endpoint or "").strip()
    data = _load()
    rows: list[dict[str, Any]] = list(data.get("subscriptions") or [])
    kept: list[dict[str, Any]] = []
    removed = False
    for row in rows:
        if _normalize_email(row.get("email")) == normalized_email and row.get("endpoint") == endpoint:
            removed = True
            continue
        kept.append(row)
    if removed:
        _save({"subscriptions": kept})
    return removed


def delete_subscription_by_endpoint(endpoint: str) -> bool:
    endpoint = str(endpoint or "").strip()
    data = _load()
    rows: list[dict[str, Any]] = list(data.get("subscriptions") or [])
    kept = [row for row in rows if row.get("endpoint") != endpoint]
    if len(kept) == len(rows):
        return False
    _save({"subscriptions": kept})
    return True
