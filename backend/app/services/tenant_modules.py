"""Office product modules — trips (buses) vs Rent — derived from plan + settings."""

from __future__ import annotations

import json
from typing import Any

from app.models.tenant import Tenant, TenantPlan


def parse_tenant_settings(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}
    return data if isinstance(data, dict) else {}


def initial_settings_for_plan(plan: TenantPlan | str) -> dict[str, Any]:
    """Seed settings_json when provisioning a new office."""
    plan_value = plan.value if isinstance(plan, TenantPlan) else str(plan or "starter")
    settings: dict[str, Any] = {"theme": {"primary": "#005d90"}}
    if plan_value == TenantPlan.RENT.value:
        settings["addons"] = {"rent": True}
        settings["modules"] = {"trips_enabled": False, "rent_enabled": True}
    return settings


def modules_for_settings(
    *,
    plan: TenantPlan | str | None,
    settings: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Resolve public storefront modules.

    - plan ``rent`` → Rent only (no bus trips on homepage)
    - bus plans → trips on; Rent when ``addons.rent`` (or explicit modules override)
    - ``settings.modules`` can override either flag
    """
    plan_value = (
        plan.value
        if isinstance(plan, TenantPlan)
        else str(plan or TenantPlan.STARTER.value).strip().lower()
    )
    bag = settings if isinstance(settings, dict) else {}
    addons = bag.get("addons") if isinstance(bag.get("addons"), dict) else {}
    override = bag.get("modules") if isinstance(bag.get("modules"), dict) else {}

    rent_only = plan_value == TenantPlan.RENT.value
    rent_addon = bool(addons.get("rent") or addons.get("rent_addon"))

    trips_default = not rent_only
    rent_default = rent_only or rent_addon

    trips_enabled = (
        bool(override["trips_enabled"]) if "trips_enabled" in override else trips_default
    )
    rent_enabled = (
        bool(override["rent_enabled"]) if "rent_enabled" in override else rent_default
    )

    # Never leave an office with zero public product surface.
    if not trips_enabled and not rent_enabled:
        trips_enabled = True

    if rent_enabled and not trips_enabled:
        mode = "rent_only"
    elif rent_enabled and trips_enabled:
        mode = "both"
    else:
        mode = "trips_only"

    return {
        "trips_enabled": trips_enabled,
        "rent_enabled": rent_enabled,
        "plan": plan_value,
        "mode": mode,
    }


def modules_for_tenant(tenant: Tenant) -> dict[str, Any]:
    return modules_for_settings(
        plan=tenant.plan,
        settings=parse_tenant_settings(tenant.settings_json),
    )


def enable_rent_addon_in_settings(settings: dict[str, Any] | None = None) -> dict[str, Any]:
    """Merge Rent add-on onto an existing bus office settings bag."""
    bag = dict(settings or {})
    addons = dict(bag.get("addons") or {})
    addons["rent"] = True
    bag["addons"] = addons
    modules = dict(bag.get("modules") or {})
    modules["rent_enabled"] = True
    if "trips_enabled" not in modules:
        modules["trips_enabled"] = True
    bag["modules"] = modules
    return bag
