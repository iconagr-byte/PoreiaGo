"""Tests for login audit store (time, IP, device)."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from travel_platform.settings import login_audit_store as store


class _FakeRequest:
    def __init__(self, *, ip=None, forwarded=None, ua=None):
        headers = {}
        if forwarded:
            headers["X-Forwarded-For"] = forwarded
        if ua:
            headers["User-Agent"] = ua
        self.headers = headers
        self.client = SimpleNamespace(host=ip) if ip else None


class LoginAuditStoreTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        store.reset_login_audit_store_for_tests(Path(self._tmpdir.name) / "login_audit.json")

    def tearDown(self):
        self._tmpdir.cleanup()

    def test_append_and_list_with_device_summary(self):
        entry = store.append_login_event(
            actor_type="admin",
            identity="admin@example.com",
            success=True,
            ip="203.0.113.10",
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            actor_id="u1",
            method="password",
        )
        self.assertTrue(entry["id"])
        self.assertEqual(entry["ip"], "203.0.113.10")
        self.assertIn("Chrome", entry["device"])
        self.assertIn("macOS", entry["device"])

        rows = store.list_login_events(limit=10)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["identity"], "admin@example.com")

    def test_record_from_request_uses_forwarded_ip(self):
        req = _FakeRequest(
            ip="10.0.0.1",
            forwarded="198.51.100.20, 10.0.0.1",
            ua="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1.15",
        )
        entry = store.record_login_from_request(
            req,
            actor_type="customer",
            identity="user@example.com",
            success=True,
            method="password",
        )
        self.assertEqual(entry["ip"], "198.51.100.20")
        self.assertIn("iOS", entry["device"])

    def test_filters_actor_and_success(self):
        store.append_login_event(actor_type="driver", identity="d1@ex.com", success=True, ip="1.1.1.1")
        store.append_login_event(actor_type="driver", identity="d2@ex.com", success=False, ip="1.1.1.2")
        store.append_login_event(actor_type="admin", identity="a@ex.com", success=True, ip="1.1.1.3")

        drivers = store.list_login_events(actor_type="driver")
        self.assertEqual(len(drivers), 2)
        fails = store.list_login_events(success=False)
        self.assertEqual(len(fails), 1)
        self.assertEqual(fails[0]["identity"], "d2@ex.com")
        found = store.list_login_events(q="a@ex")
        self.assertEqual(len(found), 1)


if __name__ == "__main__":
    unittest.main()
