"""Miles+Bonus loyalty JSON store (Phase A). Postgres ORM ready in Alembic 014."""

from __future__ import annotations

import json
import threading
from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import uuid4

from travel_platform.settings.drivers_store import DEMO_TENANT_ID

DATA_DIR = Path(__file__).resolve().parent
STORE_FILE = DATA_DIR / "loyalty_store.json"
_LOCK = threading.RLock()

TIERS = ("STANDARD", "SILVER", "GOLD", "PLATINUM")
TX_TYPES = ("EARN", "REDEEM", "ADJUST", "EXPIRE")

# Lifetime miles thresholds for tier upgrades.
TIER_THRESHOLDS: tuple[tuple[str, Decimal], ...] = (
    ("PLATINUM", Decimal("50000")),
    ("GOLD", Decimal("20000")),
    ("SILVER", Decimal("5000")),
    ("STANDARD", Decimal("0")),
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_tenant(tenant_id: str | None) -> str:
    return str(tenant_id or DEMO_TENANT_ID).strip() or DEMO_TENANT_ID


def _empty() -> dict[str, Any]:
    return {"accounts": [], "transactions": []}


def _read() -> dict[str, Any]:
    if not STORE_FILE.exists():
        return _empty()
    try:
        data = json.loads(STORE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return _empty()
    if not isinstance(data, dict):
        return _empty()
    data.setdefault("accounts", [])
    data.setdefault("transactions", [])
    return data


def _write(data: dict[str, Any]) -> None:
    STORE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STORE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _dec(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


def calc_tier(lifetime_miles: Decimal | float | int | str) -> str:
    miles = _dec(lifetime_miles)
    for tier, threshold in TIER_THRESHOLDS:
        if miles >= threshold:
            return tier
    return "STANDARD"


def list_accounts(tenant_id: str | None) -> list[dict[str, Any]]:
    tid = _normalize_tenant(tenant_id)
    with _LOCK:
        rows = [a for a in _read()["accounts"] if a.get("tenant_id") == tid]
    return sorted(rows, key=lambda a: str(a.get("display_name") or a.get("client_email") or ""))


def get_account(tenant_id: str | None, account_id: str) -> dict[str, Any] | None:
    tid = _normalize_tenant(tenant_id)
    with _LOCK:
        for row in _read()["accounts"]:
            if row.get("tenant_id") == tid and row.get("id") == account_id:
                return deepcopy(row)
    return None


def upsert_account(tenant_id: str | None, body: dict[str, Any], *, account_id: str | None = None) -> dict[str, Any]:
    tid = _normalize_tenant(tenant_id)
    email = str(body.get("client_email") or "").strip().lower() or None
    with _LOCK:
        data = _read()
        existing = None
        if account_id:
            for row in data["accounts"]:
                if row.get("tenant_id") == tid and row.get("id") == account_id:
                    existing = row
                    break
            if not existing:
                raise ValueError("Ο λογαριασμός loyalty δεν βρέθηκε")
        if email:
            for row in data["accounts"]:
                if (
                    row.get("tenant_id") == tid
                    and str(row.get("client_email") or "").lower() == email
                    and (not existing or row.get("id") != existing.get("id"))
                ):
                    raise ValueError("Υπάρχει ήδη loyalty λογαριασμός για αυτό το email")

        now = _now()
        row = existing or {
            "id": str(uuid4()),
            "tenant_id": tid,
            "lifetime_miles": 0,
            "redeemable_miles": 0,
            "tier": "STANDARD",
            "created_at": now,
        }
        lifetime = _dec(body.get("lifetime_miles", row.get("lifetime_miles")))
        redeemable = _dec(body.get("redeemable_miles", row.get("redeemable_miles")))
        tier = str(body.get("tier") or calc_tier(lifetime)).strip().upper()
        if tier not in TIERS:
            tier = calc_tier(lifetime)
        row.update(
            {
                "client_id": (str(body.get("client_id") or "").strip() or row.get("client_id")),
                "client_email": email if email is not None else row.get("client_email"),
                "display_name": (str(body.get("display_name") or "").strip() or row.get("display_name")),
                "lifetime_miles": float(lifetime),
                "redeemable_miles": float(redeemable),
                "tier": tier,
                "updated_at": now,
            }
        )
        if not existing:
            data["accounts"].append(row)
        _write(data)
        return deepcopy(row)


def list_transactions(tenant_id: str | None, *, account_id: str | None = None) -> list[dict[str, Any]]:
    tid = _normalize_tenant(tenant_id)
    with _LOCK:
        rows = [t for t in _read()["transactions"] if t.get("tenant_id") == tid]
    if account_id:
        rows = [t for t in rows if t.get("loyalty_account_id") == account_id]
    return sorted(rows, key=lambda t: str(t.get("created_at") or ""), reverse=True)


def post_transaction(tenant_id: str | None, body: dict[str, Any]) -> dict[str, Any]:
    """Earn / redeem / adjust miles and refresh tier."""
    tid = _normalize_tenant(tenant_id)
    account_id = str(body.get("loyalty_account_id") or "").strip()
    tx_type = str(body.get("tx_type") or "EARN").strip().upper()
    if tx_type not in TX_TYPES:
        raise ValueError("Μη έγκυρος τύπος συναλλαγής")
    miles = _dec(body.get("miles"))
    if miles == 0:
        raise ValueError("Τα miles πρέπει να είναι μη μηδενικά")
    if tx_type == "REDEEM" and miles > 0:
        miles = -miles
    if tx_type == "EARN" and miles < 0:
        miles = abs(miles)

    multiplier = _dec(body.get("multiplier") or 1)
    if multiplier <= 0:
        multiplier = Decimal("1")
    applied = (miles * multiplier).quantize(Decimal("0.01"))

    with _LOCK:
        data = _read()
        account = next(
            (a for a in data["accounts"] if a.get("tenant_id") == tid and a.get("id") == account_id),
            None,
        )
        if not account:
            raise ValueError("Ο λογαριασμός loyalty δεν βρέθηκε")

        redeemable = _dec(account.get("redeemable_miles")) + applied
        if redeemable < 0:
            raise ValueError("Ανεπαρκές διαθέσιμα miles")
        lifetime = _dec(account.get("lifetime_miles"))
        if applied > 0:
            lifetime += applied

        now = _now()
        account["redeemable_miles"] = float(redeemable)
        account["lifetime_miles"] = float(lifetime)
        account["tier"] = calc_tier(lifetime)
        account["updated_at"] = now

        tx = {
            "id": str(uuid4()),
            "tenant_id": tid,
            "loyalty_account_id": account_id,
            "tx_type": tx_type,
            "miles": float(applied),
            "balance_after": float(redeemable),
            "source_kind": (str(body.get("source_kind") or "").strip() or None),
            "source_id": (str(body.get("source_id") or "").strip() or None),
            "distance_km": (
                float(body["distance_km"])
                if body.get("distance_km") not in (None, "")
                else None
            ),
            "multiplier": float(multiplier),
            "notes": (str(body.get("notes") or "").strip() or None),
            "created_at": now,
        }
        data["transactions"].append(tx)
        _write(data)
        return {"account": deepcopy(account), "transaction": deepcopy(tx)}


def delete_account(tenant_id: str | None, account_id: str) -> bool:
    tid = _normalize_tenant(tenant_id)
    aid = str(account_id or "").strip()
    if not aid:
        return False
    with _LOCK:
        data = _read()
        before = len(data["accounts"])
        data["accounts"] = [
            a for a in data["accounts"] if not (a.get("tenant_id") == tid and a.get("id") == aid)
        ]
        if len(data["accounts"]) == before:
            return False
        data["transactions"] = [
            t
            for t in data["transactions"]
            if not (t.get("tenant_id") == tid and t.get("loyalty_account_id") == aid)
        ]
        _write(data)
        return True


def tier_meta() -> dict[str, Any]:
    return {
        "tiers": list(TIERS),
        "tx_types": list(TX_TYPES),
        "thresholds": [
            {"tier": tier, "lifetime_miles": float(threshold)} for tier, threshold in TIER_THRESHOLDS
        ],
    }
