"""Tenant ownership + reserved domain guards for custom-domain APIs."""

from __future__ import annotations

import unittest

from travel_platform.growth.domain_security import (
    assert_domain_owned_by_tenant,
    is_valid_public_domain,
    normalize_apex,
    sanitize_edge_status,
)


class DomainSecurityTests(unittest.TestCase):
    def test_reserved_platform_domains_blocked(self):
        self.assertFalse(is_valid_public_domain("poreiago.com"))
        self.assertFalse(is_valid_public_domain("www.poreiago.com"))
        self.assertFalse(is_valid_public_domain("admin.poreiago.com"))
        self.assertFalse(is_valid_public_domain("localhost"))
        self.assertTrue(is_valid_public_domain("achilliotravel.com"))
        self.assertTrue(is_valid_public_domain("myagency.gr"))

    def test_assert_owned_domain_only(self):
        self.assertEqual(
            assert_domain_owned_by_tenant(None, "myagency.gr"),
            "myagency.gr",
        )
        self.assertEqual(
            assert_domain_owned_by_tenant("www.myagency.gr", "myagency.gr"),
            "myagency.gr",
        )
        with self.assertRaises(PermissionError):
            assert_domain_owned_by_tenant("other.gr", "myagency.gr")
        with self.assertRaises(PermissionError):
            assert_domain_owned_by_tenant("achilliotravel.com", "")

    def test_sanitize_edge_strips_foreign_data(self):
        raw = {
            "ok": True,
            "www": "www.myagency.gr",
            "redirect_ok": True,
            "detail": "secret upstream dump",
            "forward": "127.0.0.1:8003",
        }
        safe = sanitize_edge_status(owned_domain="myagency.gr", npm_result=raw)
        self.assertEqual(safe["domain"], "myagency.gr")
        self.assertNotIn("detail", safe["npm"])
        self.assertNotIn("forward", safe["npm"])
        self.assertTrue(safe["npm"]["ok"])

    def test_normalize_apex(self):
        self.assertEqual(normalize_apex("https://WWW.Example.GR/path"), "example.gr")


if __name__ == "__main__":
    unittest.main()
