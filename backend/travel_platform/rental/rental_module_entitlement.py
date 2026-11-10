"""Rent module entitlement — optional SaaS add-on, JSON-backed (dual-write ready)."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

_FILE = Path(__file__).resolve().parent / "rental_module_entitlement.json"

# Default ON so existing offices keep Rent until they opt out.
DEFAULT_ENTITLEMENT: dict[str, Any] = {
    "rent_enabled": True,
    "rent_addon_monthly_eur": 79.0,
    "note": "",
}


def _ensure() -> None:
    if not _FILE.exists():
        _FILE.parent.mkdir(parents=True, exist_ok=True)
        _FILE.write_text(
            json.dumps(DEFAULT_ENTITLEMENT, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


def read_rent_module() -> dict[str, Any]:
    _ensure()
    try:
        raw = json.loads(_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    out = deepcopy(DEFAULT_ENTITLEMENT)
    if "rent_enabled" in raw:
        out["rent_enabled"] = bool(raw["rent_enabled"])
    if "rent_addon_monthly_eur" in raw and raw["rent_addon_monthly_eur"] is not None:
        try:
            out["rent_addon_monthly_eur"] = round(float(raw["rent_addon_monthly_eur"]), 2)
        except (TypeError, ValueError):
            pass
    if "note" in raw and raw["note"] is not None:
        out["note"] = str(raw["note"])
    return out


def update_rent_module(patch: dict[str, Any] | None) -> dict[str, Any]:
    current = read_rent_module()
    if not isinstance(patch, dict):
        return current
    if "rent_enabled" in patch:
        current["rent_enabled"] = bool(patch["rent_enabled"])
    if "rent_addon_monthly_eur" in patch and patch["rent_addon_monthly_eur"] is not None:
        try:
            current["rent_addon_monthly_eur"] = round(float(patch["rent_addon_monthly_eur"]), 2)
        except (TypeError, ValueError):
            pass
    if "note" in patch and patch["note"] is not None:
        current["note"] = str(patch["note"])
    _FILE.parent.mkdir(parents=True, exist_ok=True)
    _FILE.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return deepcopy(current)


def is_rent_enabled() -> bool:
    return bool(read_rent_module().get("rent_enabled", True))
