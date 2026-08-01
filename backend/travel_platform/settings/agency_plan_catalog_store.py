"""Editable agency SaaS plan cards (Starter/Pro/Enterprise + custom) — durable JSON."""

from __future__ import annotations

import json
import os
import re
import time
from copy import deepcopy
from pathlib import Path
from typing import Any

_DATA_DIR = Path(
    os.getenv("POREIAGO_DATA_DIR") or Path(__file__).resolve().parents[2] / "data"
)
_SETTINGS_FILE = _DATA_DIR / "agency_plan_catalog.json"

_SLUG_RE = re.compile(r"[^a-z0-9_]+")

DEFAULT_PLANS: list[dict[str, Any]] = [
    {
        "id": "starter",
        "name": "Starter",
        "tagline": "Μικρά γραφεία & νέες εκκινήσεις",
        "kind": "buses",
        "monthlyEur": 99,
        "features": [
            "Έως 2 λεωφορεία στο fleet",
            "Online κρατήσεις & QR εισιτήρια",
            "Βασικό Control Panel",
            "Καμπάνιες email με έτοιμα πρότυπα",
            "Email υποστήριξη",
        ],
        "highlighted": False,
        "contactSales": False,
        "visible": True,
        "icon": "storefront",
        "builtin": True,
    },
    {
        "id": "professional",
        "name": "Professional",
        "tagline": "Ταξιδιωτικά γραφεία σε ανάπτυξη",
        "kind": "buses",
        "monthlyEur": 299,
        "features": [
            "Απεριόριστα λεωφορεία (metered)",
            "Live GPS & telematics",
            "Dynamic pricing & Growth tools",
            "Email Hub — 94+ έτοιμα πρότυπα καμπάνιας",
            "GDPR & audit logs",
            "Προτεραιότητα υποστήριξης",
        ],
        "highlighted": True,
        "contactSales": False,
        "visible": True,
        "icon": "apartment",
        "builtin": True,
    },
    {
        "id": "enterprise",
        "name": "Enterprise",
        "tagline": "Πολυκαταστήματα & white-label",
        "kind": "buses",
        "monthlyEur": None,
        "features": [
            "Πολλαπλά branches / tenants",
            "Custom domain & SLA",
            "Dedicated onboarding",
            "API & partner webhooks",
        ],
        "highlighted": False,
        "contactSales": True,
        "visible": True,
        "icon": "domain",
        "builtin": True,
    },
]

DEFAULT_CATALOG: dict[str, Any] = {
    "sectionTitle": "Συμβόλαια λεωφορείων",
    "plans": deepcopy(DEFAULT_PLANS),
}

BUILTIN_IDS = {p["id"] for p in DEFAULT_PLANS}


def _normalize_str_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [line.strip() for line in value.splitlines() if line.strip()]
    return []


def _slugify(value: str) -> str:
    slug = _SLUG_RE.sub("_", str(value or "").strip().lower()).strip("_")
    return slug[:48] or f"plan_{int(time.time())}"


def _normalize_plan(raw: dict[str, Any] | None, *, fallback_id: str | None = None) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    plan_id = str(raw.get("id") or fallback_id or "").strip()
    if not plan_id:
        plan_id = _slugify(str(raw.get("name") or "custom"))
    builtin = plan_id in BUILTIN_IDS or bool(raw.get("builtin"))
    base = next((deepcopy(p) for p in DEFAULT_PLANS if p["id"] == plan_id), None)
    plan = base or {
        "id": plan_id,
        "name": "Custom",
        "tagline": "",
        "kind": "buses",
        "monthlyEur": 0,
        "features": [],
        "highlighted": False,
        "contactSales": False,
        "visible": True,
        "icon": "workspace_premium",
        "builtin": False,
    }
    plan["id"] = plan_id
    plan["builtin"] = builtin
    if raw.get("name") is not None:
        plan["name"] = str(raw["name"]).strip() or plan["name"]
    if raw.get("tagline") is not None:
        plan["tagline"] = str(raw["tagline"]).strip()
    if raw.get("kind") is not None:
        plan["kind"] = str(raw["kind"]).strip() or "buses"
    if raw.get("icon") is not None:
        plan["icon"] = str(raw["icon"]).strip() or plan.get("icon") or "workspace_premium"
    if "monthlyEur" in raw:
        if raw["monthlyEur"] is None or raw["monthlyEur"] == "":
            plan["monthlyEur"] = None
        else:
            try:
                plan["monthlyEur"] = float(raw["monthlyEur"])
            except (TypeError, ValueError):
                pass
    if "features" in raw:
        features = _normalize_str_list(raw.get("features"))
        if features or not builtin:
            plan["features"] = features
    if "highlighted" in raw:
        plan["highlighted"] = bool(raw["highlighted"])
    if "contactSales" in raw:
        plan["contactSales"] = bool(raw["contactSales"])
        if plan["contactSales"]:
            plan["monthlyEur"] = None
    if "visible" in raw:
        plan["visible"] = bool(raw["visible"])
    return plan


def _load_raw_file(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, TypeError):
        return None
    return raw if isinstance(raw, dict) else None


def _apply_raw(catalog: dict[str, Any], raw: dict[str, Any]) -> dict[str, Any]:
    if raw.get("sectionTitle") is not None:
        catalog["sectionTitle"] = str(raw["sectionTitle"]).strip() or catalog["sectionTitle"]
    raw_plans = raw.get("plans")
    if isinstance(raw_plans, list) and raw_plans:
        normalized: list[dict[str, Any]] = []
        seen: set[str] = set()
        for item in raw_plans:
            plan = _normalize_plan(item if isinstance(item, dict) else None)
            if not plan or plan["id"] in seen:
                continue
            seen.add(plan["id"])
            normalized.append(plan)
        # Ensure builtin plans remain available (hidden ok) so billing IDs stay stable.
        for builtin in DEFAULT_PLANS:
            if builtin["id"] not in seen:
                hidden = deepcopy(builtin)
                hidden["visible"] = False
                normalized.append(hidden)
        catalog["plans"] = normalized
    return catalog


def read_agency_plan_catalog() -> dict[str, Any]:
    catalog = deepcopy(DEFAULT_CATALOG)
    raw = _load_raw_file(_SETTINGS_FILE)
    if raw is None:
        return catalog
    return _apply_raw(catalog, raw)


def write_agency_plan_catalog(data: dict[str, Any]) -> dict[str, Any]:
    current = read_agency_plan_catalog()
    if not isinstance(data, dict):
        return current
    if data.get("sectionTitle") is not None:
        current["sectionTitle"] = str(data["sectionTitle"]).strip() or current["sectionTitle"]
    if isinstance(data.get("plans"), list):
        normalized: list[dict[str, Any]] = []
        seen: set[str] = set()
        for item in data["plans"]:
            plan = _normalize_plan(item if isinstance(item, dict) else None)
            if not plan or plan["id"] in seen:
                continue
            # Never hard-delete builtins — mark hidden instead if omitted later.
            seen.add(plan["id"])
            normalized.append(plan)
        for builtin in DEFAULT_PLANS:
            if builtin["id"] not in seen:
                hidden = deepcopy(builtin)
                hidden["visible"] = False
                normalized.append(hidden)
        current["plans"] = normalized
    _SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = _SETTINGS_FILE.with_suffix(".json.tmp")
    payload = json.dumps(current, indent=2, ensure_ascii=False)
    tmp.write_text(payload, encoding="utf-8")
    tmp.replace(_SETTINGS_FILE)
    return current
