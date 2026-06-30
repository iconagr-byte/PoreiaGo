"""Payment methods, deposit rules & bank accounts — JSON store."""

from __future__ import annotations

import json
import uuid
from copy import deepcopy
from pathlib import Path
from typing import Any

from travel_platform.payments.payment_security import validate_iban_checksum

_SETTINGS_FILE = Path(__file__).resolve().parent / "payment_settings.json"
_PLATFORM_FILE = Path(__file__).resolve().parent / "platform_settings.json"

DEFAULT_METHODS: dict[str, Any] = {
    "card": {"enabled": True, "label": "Πιστωτική / Χρεωστική"},
    "paypal": {"enabled": True, "label": "PayPal"},
    "apple": {"enabled": True, "label": "Apple Pay"},
    "bank_transfer": {"enabled": True, "label": "Τραπεζική μεταφορά"},
    "cash_office": {"enabled": True, "label": "Μετρητά — γκισέ"},
    "cash_driver": {"enabled": True, "label": "Μετρητά — οδηγός / λεωφορείο"},
}

DEFAULT_BANK_ACCOUNT: dict[str, Any] = {
    "id": "bank-default",
    "label": "Eurobank EUR",
    "bank_name": "Eurobank",
    "beneficiary": "AeroStride Travel AE",
    "iban": "GR1601101250000000012300695",
    "bic": "ERBKGRAA",
    "currency": "EUR",
    "enabled": True,
    "is_default": True,
    "reference_template": "VOY-{pnr}",
    "instructions": (
        "Μετά την κατάθεση, στείλτε την απόδειξη στο email υποστήριξης. "
        "Η κράτηση επιβεβαιώνεται εντός 24 ωρών."
    ),
}

DEFAULT_SECURITY: dict[str, Any] = {
    "require_amount_on_confirm": True,
    "require_reference_on_confirm": True,
    "validate_iban_checksum": True,
    "audit_payment_actions": True,
    "mask_iban_public": False,
    "notify_customer_on_payment": True,
    "notify_admin_on_payment": True,
    "notify_sms_on_fiscal_receipt": True,
    "notify_push_on_fiscal_receipt": True,
    "notify_push_on_driver_shift": True,
    "notify_admin_on_driver_shift": True,
    "notify_erp_on_fiscal_receipt": True,
    "notify_admin_on_fiscal_issues": True,
    "notify_admin_fleet_digest": True,
    "notify_sms_fleet_digest": False,
    "admin_notification_email": "",
    "admin_notification_phone": "",
    "email_spam_filter_enabled": True,
    "block_disposable_emails": True,
    "email_deliverability_headers": True,
    "blocked_email_domains": [],
    "allowed_email_domains": [],
}

DEFAULT_PAYMENT_SETTINGS: dict[str, Any] = {
    "deposit": {"enabled": True, "percent": 30},
    "methods": deepcopy(DEFAULT_METHODS),
    "bank_accounts": [deepcopy(DEFAULT_BANK_ACCOUNT)],
    "global_bank_instructions": "",
    "security": deepcopy(DEFAULT_SECURITY),
}


def _normalize_iban(value: str) -> str:
    return str(value or "").replace(" ", "").strip().upper()


def _normalize_bank_account(raw: dict[str, Any] | None) -> dict[str, Any] | None:
    if not raw:
        return None
    iban = _normalize_iban(raw.get("iban", ""))
    if not iban:
        return None
    return {
        "id": str(raw.get("id") or uuid.uuid4().hex[:12]),
        "label": str(raw.get("label") or raw.get("bank_name") or "Τραπεζικός λογαριασμός").strip(),
        "bank_name": str(raw.get("bank_name") or "").strip(),
        "beneficiary": str(raw.get("beneficiary") or "").strip(),
        "iban": iban,
        "bic": str(raw.get("bic") or "").strip(),
        "currency": str(raw.get("currency") or "EUR").strip().upper() or "EUR",
        "enabled": bool(raw.get("enabled", True)),
        "is_default": bool(raw.get("is_default")),
        "reference_template": str(raw.get("reference_template") or "VOY-{pnr}").strip(),
        "instructions": str(raw.get("instructions") or "").strip(),
    }


def _ensure_default_account(accounts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not accounts:
        return [deepcopy(DEFAULT_BANK_ACCOUNT)]
    enabled = [a for a in accounts if a.get("enabled")]
    if not enabled:
        accounts[0]["enabled"] = True
        enabled = [accounts[0]]
    defaults = [a for a in enabled if a.get("is_default")]
    if not defaults:
        accounts[0]["is_default"] = True
    elif len(defaults) > 1:
        first = defaults[0]["id"]
        for acc in accounts:
            acc["is_default"] = acc["id"] == first
    return accounts


def _migrate_from_platform(current: dict[str, Any]) -> dict[str, Any]:
    if not _PLATFORM_FILE.exists():
        return current
    try:
        raw = json.loads(_PLATFORM_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, TypeError):
        return current
    deposit = current.get("deposit") or {}
    if "checkout_deposit_enabled" in raw:
        deposit["enabled"] = bool(raw.get("checkout_deposit_enabled", True))
    if raw.get("checkout_deposit_percent") is not None:
        try:
            deposit["percent"] = max(5, min(90, int(raw.get("checkout_deposit_percent"))))
        except (TypeError, ValueError):
            pass
    current["deposit"] = deposit
    methods = current.get("methods") or deepcopy(DEFAULT_METHODS)
    if "checkout_bank_transfer_enabled" in raw:
        methods.setdefault("bank_transfer", deepcopy(DEFAULT_METHODS["bank_transfer"]))
        methods["bank_transfer"]["enabled"] = bool(raw.get("checkout_bank_transfer_enabled", True))
    current["methods"] = methods
    iban = _normalize_iban(raw.get("checkout_bank_iban", ""))
    if iban and not current.get("bank_accounts"):
        current["bank_accounts"] = [
            {
                "id": "bank-default",
                "label": str(raw.get("checkout_bank_name") or "Τραπεζικός λογαριασμός").strip(),
                "bank_name": str(raw.get("checkout_bank_name") or "").strip(),
                "beneficiary": str(raw.get("checkout_bank_beneficiary") or "").strip(),
                "iban": iban,
                "bic": str(raw.get("checkout_bank_bic") or "").strip(),
                "currency": "EUR",
                "enabled": True,
                "is_default": True,
                "reference_template": str(raw.get("checkout_bank_reference_template") or "VOY-{pnr}").strip(),
                "instructions": str(raw.get("checkout_bank_instructions") or "").strip(),
            }
        ]
    return current


def _merge_settings(raw: dict | None) -> dict[str, Any]:
    merged = deepcopy(DEFAULT_PAYMENT_SETTINGS)
    if raw:
        if isinstance(raw.get("deposit"), dict):
            merged["deposit"] = {**merged["deposit"], **raw["deposit"]}
        if isinstance(raw.get("methods"), dict):
            for key, val in raw["methods"].items():
                if isinstance(val, dict):
                    merged["methods"][key] = {**merged["methods"].get(key, {}), **val}
        if isinstance(raw.get("bank_accounts"), list):
            accounts = []
            for item in raw["bank_accounts"]:
                norm = _normalize_bank_account(item if isinstance(item, dict) else None)
                if norm:
                    accounts.append(norm)
            if accounts:
                merged["bank_accounts"] = accounts
        if raw.get("global_bank_instructions") is not None:
            merged["global_bank_instructions"] = str(raw["global_bank_instructions"] or "").strip()
        if isinstance(raw.get("security"), dict):
            merged["security"] = {**merged["security"], **raw["security"]}
    merged = _migrate_from_platform(merged)
    merged["bank_accounts"] = _ensure_default_account(merged["bank_accounts"])
    try:
        pct = int(merged["deposit"].get("percent") or 30)
    except (TypeError, ValueError):
        pct = 30
    merged["deposit"]["percent"] = max(5, min(90, pct))
    merged["deposit"]["enabled"] = bool(merged["deposit"].get("enabled", True))
    return merged


def read_payment_settings() -> dict[str, Any]:
    if not _SETTINGS_FILE.exists():
        data = _merge_settings(None)
        write_payment_settings(data)
        return data
    try:
        raw = json.loads(_SETTINGS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, TypeError):
        raw = None
    return _merge_settings(raw)


def write_payment_settings(data: dict[str, Any]) -> dict[str, Any]:
    merged = _merge_settings(data)
    _SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _SETTINGS_FILE.write_text(
        json.dumps(merged, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return merged


def get_public_payment_settings() -> dict[str, Any]:
    data = read_payment_settings()
    security = data.get("security") or deepcopy(DEFAULT_SECURITY)
    accounts = [a for a in data["bank_accounts"] if a.get("enabled")]
    methods = {
        key: {"enabled": bool(val.get("enabled", True)), "label": val.get("label", key)}
        for key, val in (data.get("methods") or {}).items()
    }
    return {
        "deposit": data["deposit"],
        "methods": methods,
        "bank_accounts": accounts,
        "global_bank_instructions": data.get("global_bank_instructions") or "",
        "security": {
            "mask_iban_public": bool(security.get("mask_iban_public")),
        },
    }


def patch_payment_settings(patch: dict[str, Any]) -> dict[str, Any]:
    current = read_payment_settings()
    if isinstance(patch.get("deposit"), dict):
        current["deposit"] = {**current["deposit"], **patch["deposit"]}
    if isinstance(patch.get("methods"), dict):
        for key, val in patch["methods"].items():
            if isinstance(val, dict) and key in current["methods"]:
                current["methods"][key] = {**current["methods"][key], **val}
    if patch.get("global_bank_instructions") is not None:
        current["global_bank_instructions"] = str(patch["global_bank_instructions"] or "").strip()
    if isinstance(patch.get("security"), dict):
        sec = patch["security"]
        current_sec = current.get("security") or {}
        for key, val in sec.items():
            if key in ("blocked_email_domains", "allowed_email_domains") and isinstance(val, list):
                current_sec[key] = [
                    str(d).strip().lower().lstrip("@")
                    for d in val
                    if str(d).strip()
                ]
            elif val is not None:
                current_sec[key] = val
        current["security"] = current_sec
    return write_payment_settings(current)


def _validate_account_iban(account: dict[str, Any]) -> None:
    settings = read_payment_settings()
    security = settings.get("security") or DEFAULT_SECURITY
    if not security.get("validate_iban_checksum", True):
        return
    iban = account.get("iban") or ""
    if not validate_iban_checksum(iban):
        raise ValueError("Invalid IBAN — checksum failed (MOD-97)")


def add_bank_account(payload: dict[str, Any]) -> dict[str, Any]:
    current = read_payment_settings()
    account = _normalize_bank_account({**payload, "id": uuid.uuid4().hex[:12]})
    if not account:
        raise ValueError("Invalid bank account — IBAN required")
    _validate_account_iban(account)
    if payload.get("is_default") or not any(a.get("is_default") for a in current["bank_accounts"]):
        for acc in current["bank_accounts"]:
            acc["is_default"] = False
        account["is_default"] = True
    current["bank_accounts"].append(account)
    current["bank_accounts"] = _ensure_default_account(current["bank_accounts"])
    write_payment_settings(current)
    return account


def update_bank_account(account_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    current = read_payment_settings()
    idx = next((i for i, a in enumerate(current["bank_accounts"]) if a["id"] == account_id), -1)
    if idx < 0:
        raise KeyError(account_id)
    merged = {**current["bank_accounts"][idx], **patch, "id": account_id}
    account = _normalize_bank_account(merged)
    if not account:
        raise ValueError("Invalid bank account")
    _validate_account_iban(account)
    if patch.get("is_default"):
        for acc in current["bank_accounts"]:
            acc["is_default"] = acc["id"] == account_id
    account["is_default"] = bool(
        patch.get("is_default") or current["bank_accounts"][idx].get("is_default")
    )
    current["bank_accounts"][idx] = account
    current["bank_accounts"] = _ensure_default_account(current["bank_accounts"])
    write_payment_settings(current)
    return account


def delete_bank_account(account_id: str) -> dict[str, Any]:
    current = read_payment_settings()
    remaining = [a for a in current["bank_accounts"] if a["id"] != account_id]
    if not remaining:
        raise ValueError("Cannot delete the last bank account")
    if not any(a.get("is_default") for a in remaining):
        remaining[0]["is_default"] = True
    current["bank_accounts"] = _ensure_default_account(remaining)
    return write_payment_settings(current)
