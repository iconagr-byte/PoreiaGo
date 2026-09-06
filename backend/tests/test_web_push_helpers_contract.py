"""Contract checks for push subscription audience + shift notify wiring."""

from __future__ import annotations

from travel_platform.notifications.push_subscription_store import (
    delete_subscription_by_endpoint,
    list_subscriptions_for_driver,
    list_subscriptions_for_tenant,
    upsert_subscription,
)


def test_admin_and_driver_audiences_do_not_collide(tmp_path, monkeypatch):
    monkeypatch.setenv("POREIAGO_DATA_DIR", str(tmp_path))

    upsert_subscription(
        email="office@example.com",
        endpoint="https://push.example/admin-1",
        keys={"p256dh": "a", "auth": "b"},
        tenant_id="tenant-a",
        audience="admin",
    )
    upsert_subscription(
        email="driver:d1@tenant-a",
        endpoint="https://push.example/driver-1",
        keys={"p256dh": "c", "auth": "d"},
        tenant_id="tenant-a",
        audience="driver",
        driver_id="d1",
    )

    admin = list_subscriptions_for_tenant("tenant-a", audience="admin")
    drivers = list_subscriptions_for_driver("tenant-a", "d1")
    assert len(admin) == 1
    assert admin[0]["endpoint"].endswith("admin-1")
    assert len(drivers) == 1
    assert drivers[0]["endpoint"].endswith("driver-1")

    delete_subscription_by_endpoint("https://push.example/admin-1")
    assert list_subscriptions_for_tenant("tenant-a", audience="admin") == []
    assert len(list_subscriptions_for_driver("tenant-a", "d1")) == 1


def test_application_server_key_match_helper():
    # Pure JS helper mirrored here so rematch logic stays intentional.
    def match(existing, server):
        if not existing or not server:
            return True
        if len(existing) != len(server):
            return False
        return all(a == b for a, b in zip(existing, server))

    assert match(bytes([1, 2, 3]), bytes([1, 2, 3])) is True
    assert match(bytes([1, 2, 3]), bytes([1, 2, 4])) is False
    assert match(None, bytes([1])) is True
