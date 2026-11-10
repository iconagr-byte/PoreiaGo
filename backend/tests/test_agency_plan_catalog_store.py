"""Agency SaaS plan marketing catalog — add/hide/edit persists."""

from __future__ import annotations

from travel_platform.settings import agency_plan_catalog_store as store


def test_default_catalog_has_three_builtins(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "_SETTINGS_FILE", tmp_path / "agency_plan_catalog.json")
    catalog = store.read_agency_plan_catalog()
    assert catalog["sectionTitle"]
    ids = [p["id"] for p in catalog["plans"]]
    assert ids == ["starter", "professional", "enterprise"]
    assert all(p["visible"] for p in catalog["plans"])


def test_write_custom_plan_and_hide_builtin(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "_SETTINGS_FILE", tmp_path / "agency_plan_catalog.json")
    saved = store.write_agency_plan_catalog(
        {
            "sectionTitle": "Πλάνα γραφείων",
            "plans": [
                {
                    "id": "starter",
                    "name": "Starter Plus",
                    "tagline": "Νέα περιγραφή",
                    "monthlyEur": 109,
                    "features": ["A", "B"],
                    "visible": True,
                    "highlighted": False,
                    "contactSales": False,
                    "icon": "storefront",
                    "builtin": True,
                },
                {
                    "id": "professional",
                    "name": "Professional",
                    "visible": False,
                    "builtin": True,
                },
                {
                    "id": "custom_gold",
                    "name": "Gold",
                    "tagline": "Custom",
                    "monthlyEur": None,
                    "features": ["VIP"],
                    "contactSales": True,
                    "visible": True,
                    "highlighted": True,
                    "icon": "diamond",
                    "builtin": False,
                },
            ],
        }
    )
    assert saved["sectionTitle"] == "Πλάνα γραφείων"
    by_id = {p["id"]: p for p in saved["plans"]}
    assert by_id["starter"]["name"] == "Starter Plus"
    assert by_id["starter"]["monthlyEur"] == 109.0
    assert by_id["professional"]["visible"] is False
    assert by_id["custom_gold"]["contactSales"] is True
    assert by_id["custom_gold"]["monthlyEur"] is None
    # Enterprise must remain even if omitted from patch list.
    assert "enterprise" in by_id
    assert by_id["enterprise"]["visible"] is False

    reloaded = store.read_agency_plan_catalog()
    assert reloaded["plans"][0]["name"] == "Starter Plus"
    assert any(p["id"] == "custom_gold" for p in reloaded["plans"])
