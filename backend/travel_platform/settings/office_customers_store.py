"""Office CRM customers — durable JSON store (tenant-scoped)."""

from __future__ import annotations

import json
import logging
import re
import threading
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.core.data_paths import poreiago_data_dir, resolve_data_file
from travel_platform.settings.drivers_store import DEMO_TENANT_ID

logger = logging.getLogger(__name__)

_PACKAGE_DIR = Path(__file__).resolve().parent
STORE_FILE = resolve_data_file(
    "office_customers.json",
    _PACKAGE_DIR / "office_customers.json",
    poreiago_data_dir() / "office_customers.json",
)
_LOCK = threading.RLock()

VALID_TIERS = frozenset({"Silver", "Gold", "Platinum", "VIP"})
VALID_SCOPES = frozenset({"buses", "rent"})


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_tenant(tenant_id: str | None) -> str:
    return str(tenant_id or DEMO_TENANT_ID).strip() or DEMO_TENANT_ID


def _normalize_scope(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if raw in ("rent", "rental", "hire"):
        return "rent"
    return "buses"


def _normalize_email(value: Any) -> str:
    return str(value or "").strip().lower()


def _normalize_tier(value: Any) -> str:
    raw = str(value or "Silver").strip()
    aliases = {
        "silver": "Silver",
        "gold": "Gold",
        "platinum": "Platinum",
        "vip": "VIP",
        "βασικό": "Silver",
        "τακτικός": "Gold",
        "premium": "Platinum",
        "προτεραιότητα": "VIP",
    }
    mapped = aliases.get(raw.lower(), raw)
    return mapped if mapped in VALID_TIERS else "Silver"


def _empty() -> dict[str, Any]:
    return {"customers": []}


def _read() -> dict[str, Any]:
    if not STORE_FILE.exists():
        return _empty()
    try:
        data = json.loads(STORE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.warning("office_customers store unreadable — starting empty")
        return _empty()
    if not isinstance(data, dict):
        return _empty()
    rows = data.get("customers")
    if not isinstance(rows, list):
        rows = []
    return {"customers": rows}


def _write(data: dict[str, Any]) -> None:
    STORE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STORE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(STORE_FILE)


def _tags(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(t).strip() for t in value if str(t).strip()]
    return [
        part.strip()
        for part in re.split(r"[,;]", str(value or ""))
        if part.strip()
    ]


def _public(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "name": row.get("name") or "",
        "email": row.get("email") or "",
        "phone": row.get("phone") or "",
        "company": row.get("company") or "",
        "afm": row.get("afm") or "",
        "city": row.get("city") or "",
        "address": row.get("address") or "",
        "notes": row.get("notes") or "",
        "source": row.get("source") or "manual",
        "serviceScope": _normalize_scope(row.get("serviceScope") or row.get("service_scope")),
        "marketingOptIn": bool(row.get("marketingOptIn", True)),
        "tags": _tags(row.get("tags")),
        "points": int(row.get("points") or 0),
        "tier": _normalize_tier(row.get("tier")),
        "joinDate": row.get("joinDate") or (row.get("created_at") or "")[:10],
        "picture": row.get("picture") or "",
        "authProvider": row.get("authProvider") or "email",
        "updatedAt": row.get("updated_at") or row.get("created_at"),
    }


def list_customers(
    tenant_id: str | None,
    *,
    service_scope: str | None = None,
) -> list[dict[str, Any]]:
    tid = _normalize_tenant(tenant_id)
    scope = _normalize_scope(service_scope) if service_scope else None
    with _LOCK:
        rows = [
            _public(r)
            for r in _read()["customers"]
            if r.get("tenant_id") == tid and not r.get("deleted")
        ]
    if scope:
        rows = [r for r in rows if _normalize_scope(r.get("serviceScope")) == scope]
    return sorted(rows, key=lambda r: str(r.get("name") or r.get("email") or "").lower())


def get_customer(tenant_id: str | None, customer_id: str) -> dict[str, Any] | None:
    tid = _normalize_tenant(tenant_id)
    cid = str(customer_id or "").strip()
    if not cid:
        return None
    with _LOCK:
        for row in _read()["customers"]:
            if row.get("tenant_id") != tid or row.get("deleted"):
                continue
            if str(row.get("id")) == cid:
                return _public(row)
    return None


def upsert_customer(tenant_id: str | None, body: dict[str, Any]) -> dict[str, Any]:
    tid = _normalize_tenant(tenant_id)
    email = _normalize_email(body.get("email"))
    if not email or "@" not in email:
        raise ValueError("Απαιτείται έγκυρο email")

    service_scope = _normalize_scope(body.get("serviceScope") or body.get("service_scope"))
    customer_id = str(body.get("id") or "").strip() or None
    now = _now()

    with _LOCK:
        data = _read()
        rows: list[dict[str, Any]] = data["customers"]
        existing: dict[str, Any] | None = None
        idx = -1

        if customer_id:
            for i, row in enumerate(rows):
                if row.get("tenant_id") == tid and str(row.get("id")) == customer_id:
                    existing = row
                    idx = i
                    break

        if existing is None:
            for i, row in enumerate(rows):
                if row.get("tenant_id") != tid:
                    continue
                if _normalize_email(row.get("email")) != email:
                    continue
                if _normalize_scope(row.get("serviceScope")) != service_scope:
                    continue
                existing = row
                idx = i
                break

        name = str(body.get("name") or "").strip() or (
            (existing or {}).get("name") or email.split("@")[0]
        )
        record = {
            "id": (existing or {}).get("id") or customer_id or f"CUST-{uuid4().hex[:8].upper()}",
            "tenant_id": tid,
            "name": name,
            "email": email,
            "phone": str(body.get("phone") if body.get("phone") is not None else (existing or {}).get("phone") or "").strip(),
            "company": str(body.get("company") if body.get("company") is not None else (existing or {}).get("company") or "").strip(),
            "afm": str(body.get("afm") if body.get("afm") is not None else (existing or {}).get("afm") or "").strip(),
            "city": str(body.get("city") if body.get("city") is not None else (existing or {}).get("city") or "").strip(),
            "address": str(body.get("address") if body.get("address") is not None else (existing or {}).get("address") or "").strip(),
            "notes": str(body.get("notes") if body.get("notes") is not None else (existing or {}).get("notes") or "").strip(),
            "source": str(body.get("source") or (existing or {}).get("source") or "manual").strip() or "manual",
            "serviceScope": service_scope,
            "marketingOptIn": bool(
                body["marketingOptIn"]
                if "marketingOptIn" in body
                else (existing or {}).get("marketingOptIn", True)
            ),
            "tags": _tags(body["tags"] if "tags" in body else (existing or {}).get("tags")),
            "points": int((existing or {}).get("points") or 0),
            "tier": _normalize_tier(body.get("tier") or (existing or {}).get("tier")),
            "joinDate": (existing or {}).get("joinDate") or now[:10],
            "picture": str(body.get("picture") or (existing or {}).get("picture") or ""),
            "authProvider": str(body.get("authProvider") or (existing or {}).get("authProvider") or "email"),
            "created_at": (existing or {}).get("created_at") or now,
            "updated_at": now,
            "deleted": False,
        }

        if idx >= 0:
            rows[idx] = record
        else:
            rows.append(record)
        data["customers"] = rows
        _write(data)
        return _public(record)


def delete_customer(
    tenant_id: str | None,
    id_or_email: str,
    *,
    service_scope: str | None = None,
) -> bool:
    tid = _normalize_tenant(tenant_id)
    needle = str(id_or_email or "").strip()
    if not needle:
        return False
    needle_l = needle.lower()
    scope = _normalize_scope(service_scope) if service_scope else None
    now = _now()

    with _LOCK:
        data = _read()
        changed = False
        for row in data["customers"]:
            if row.get("tenant_id") != tid or row.get("deleted"):
                continue
            match_id = str(row.get("id")) == needle
            match_email = _normalize_email(row.get("email")) == needle_l
            if not (match_id or match_email):
                continue
            if scope and _normalize_scope(row.get("serviceScope")) != scope:
                continue
            row["deleted"] = True
            row["updated_at"] = now
            changed = True
            if match_id:
                break
        if changed:
            _write(data)
        return changed


def replace_customers_for_tenant(
    tenant_id: str | None,
    customers: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Bulk replace (used by client hydrate sync). Soft-deletes missing rows."""
    tid = _normalize_tenant(tenant_id)
    now = _now()
    incoming = []
    for raw in customers or []:
        if not isinstance(raw, dict):
            continue
        try:
            incoming.append(
                {
                    **raw,
                    "email": _normalize_email(raw.get("email")),
                    "serviceScope": _normalize_scope(raw.get("serviceScope")),
                    "tier": _normalize_tier(raw.get("tier")),
                }
            )
        except Exception:
            continue

    kept_keys: set[tuple[str, str]] = set()
    with _LOCK:
        data = _read()
        others = [r for r in data["customers"] if r.get("tenant_id") != tid]
        by_key: dict[tuple[str, str], dict[str, Any]] = {}
        for row in data["customers"]:
            if row.get("tenant_id") != tid:
                continue
            key = (
                _normalize_email(row.get("email")),
                _normalize_scope(row.get("serviceScope")),
            )
            by_key[key] = row

        next_rows: list[dict[str, Any]] = []
        for raw in incoming:
            email = raw.get("email") or ""
            if not email or "@" not in email:
                continue
            scope = raw.get("serviceScope") or "buses"
            key = (email, scope)
            kept_keys.add(key)
            prev = by_key.get(key)
            next_rows.append(
                {
                    "id": str(raw.get("id") or (prev or {}).get("id") or f"CUST-{uuid4().hex[:8].upper()}"),
                    "tenant_id": tid,
                    "name": str(raw.get("name") or email.split("@")[0]).strip(),
                    "email": email,
                    "phone": str(raw.get("phone") or "").strip(),
                    "company": str(raw.get("company") or "").strip(),
                    "afm": str(raw.get("afm") or "").strip(),
                    "city": str(raw.get("city") or "").strip(),
                    "address": str(raw.get("address") or "").strip(),
                    "notes": str(raw.get("notes") or "").strip(),
                    "source": str(raw.get("source") or "manual").strip() or "manual",
                    "serviceScope": scope,
                    "marketingOptIn": bool(raw.get("marketingOptIn", True)),
                    "tags": _tags(raw.get("tags")),
                    "points": int(raw.get("points") or (prev or {}).get("points") or 0),
                    "tier": _normalize_tier(raw.get("tier")),
                    "joinDate": str(raw.get("joinDate") or (prev or {}).get("joinDate") or now[:10])[:10],
                    "picture": str(raw.get("picture") or ""),
                    "authProvider": str(raw.get("authProvider") or "email"),
                    "created_at": (prev or {}).get("created_at") or now,
                    "updated_at": now,
                    "deleted": False,
                }
            )

        for key, prev in by_key.items():
            if key in kept_keys:
                continue
            tomb = deepcopy(prev)
            tomb["deleted"] = True
            tomb["updated_at"] = now
            next_rows.append(tomb)

        data["customers"] = others + next_rows
        _write(data)
        return [_public(r) for r in next_rows if not r.get("deleted")]
