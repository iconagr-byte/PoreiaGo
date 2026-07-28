"""Unit tests for office trips/rent module derivation."""

from types import SimpleNamespace

from app.models.tenant import TenantPlan
from app.services.tenant_modules import (
    enable_rent_addon_in_settings,
    initial_settings_for_plan,
    modules_for_settings,
    modules_for_tenant,
)


def test_rent_only_plan_hides_trips():
    mods = modules_for_settings(plan=TenantPlan.RENT)
    assert mods["trips_enabled"] is False
    assert mods["rent_enabled"] is True
    assert mods["mode"] == "rent_only"


def test_bus_plan_default_trips_only():
    mods = modules_for_settings(plan=TenantPlan.STARTER)
    assert mods["trips_enabled"] is True
    assert mods["rent_enabled"] is False
    assert mods["mode"] == "trips_only"


def test_bus_plan_with_rent_addon():
    mods = modules_for_settings(
        plan=TenantPlan.PROFESSIONAL,
        settings={"addons": {"rent": True}},
    )
    assert mods["trips_enabled"] is True
    assert mods["rent_enabled"] is True
    assert mods["mode"] == "both"


def test_explicit_modules_override():
    mods = modules_for_settings(
        plan=TenantPlan.STARTER,
        settings={"modules": {"trips_enabled": False, "rent_enabled": True}},
    )
    assert mods["mode"] == "rent_only"


def test_initial_settings_for_rent_plan():
    seed = initial_settings_for_plan(TenantPlan.RENT, office_name="Achillio Travel")
    assert seed["modules"]["rent_enabled"] is True
    assert seed["modules"]["trips_enabled"] is False
    assert seed["site_appearance"]["rent_office_name"] == "Achillio Travel"
    assert seed["site_appearance"]["footer_brand_name"] == "Achillio Travel"
    assert "Το όχημά σας" in seed["site_appearance"]["rent_hero_title"]


def test_enable_rent_addon_merge():
    bag = enable_rent_addon_in_settings({"theme": {"primary": "#123"}})
    assert bag["addons"]["rent"] is True
    assert bag["modules"]["rent_enabled"] is True
    assert bag["theme"]["primary"] == "#123"


def test_modules_for_tenant_reads_settings_json():
    tenant = SimpleNamespace(
        plan=TenantPlan.RENT,
        settings_json='{"addons":{"rent":true}}',
    )
    mods = modules_for_tenant(tenant)
    assert mods["mode"] == "rent_only"
