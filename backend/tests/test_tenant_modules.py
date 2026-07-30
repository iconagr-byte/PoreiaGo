"""Unit tests for office trips/rent module derivation."""

from types import SimpleNamespace

from app.models.tenant import TenantPlan
from app.services.tenant_modules import (
    apply_known_office_rent_policy,
    disable_rent_addon_in_settings,
    enable_rent_addon_in_settings,
    initial_settings_for_plan,
    is_achillio_travel_office,
    is_poreiago_platform_office,
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


def test_disable_rent_addon_keeps_trips():
    bag = disable_rent_addon_in_settings({"addons": {"rent": True}})
    assert bag["addons"]["rent"] is False
    assert bag["modules"]["rent_enabled"] is False
    assert bag["modules"]["trips_enabled"] is True


def test_modules_for_tenant_reads_settings_json():
    tenant = SimpleNamespace(
        plan=TenantPlan.RENT,
        settings_json='{"addons":{"rent":true}}',
    )
    mods = modules_for_tenant(tenant)
    assert mods["mode"] == "rent_only"


def test_achillio_travel_detected_by_domain():
    tenant = SimpleNamespace(
        slug="admin-achillio-gr",
        custom_domain="www.achilliotravel.com",
        legal_name="Achillio Travel",
        subdomain="admin-achillio-gr",
    )
    assert is_achillio_travel_office(tenant) is True
    assert is_poreiago_platform_office(tenant) is False


def test_poreiago_platform_seed_slug_keeps_rent():
    tenant = SimpleNamespace(
        slug="achillio",
        custom_domain=None,
        legal_name="PoreiaGo",
        subdomain="achillio",
        plan=TenantPlan.PROFESSIONAL,
        settings_json=None,
    )
    assert is_poreiago_platform_office(tenant) is True
    updated = apply_known_office_rent_policy(tenant)
    assert updated is not None
    assert updated["modules"]["rent_enabled"] is True
    assert updated["modules"]["trips_enabled"] is True


def test_poreiago_platform_detected_by_domain():
    tenant = SimpleNamespace(
        slug="office-main",
        custom_domain="www.poreiago.com",
        legal_name="PoreiaGo SaaS",
        subdomain="office-main",
    )
    assert is_poreiago_platform_office(tenant) is True
    assert is_achillio_travel_office(tenant) is False


def test_achillio_policy_disables_rent_only_for_that_office():
    tenant = SimpleNamespace(
        slug="admin-achillio-gr",
        custom_domain="achilliotravel.com",
        legal_name="Achillio Travel",
        subdomain="x",
        plan=TenantPlan.PROFESSIONAL,
        settings_json='{"addons":{"rent":true},"modules":{"rent_enabled":true,"trips_enabled":true}}',
    )
    updated = apply_known_office_rent_policy(tenant)
    assert updated is not None
    assert updated["modules"]["rent_enabled"] is False
    assert updated["modules"]["trips_enabled"] is True


def test_unrelated_customer_office_untouched():
    tenant = SimpleNamespace(
        slug="sunny-rentals",
        custom_domain="sunny.example",
        legal_name="Sunny",
        subdomain="sunny",
        plan=TenantPlan.STARTER,
        settings_json=None,
    )
    assert apply_known_office_rent_policy(tenant) is None
