"""Custom-domain DNS check + nginx apex→www automation (Achillio path for any office)."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from travel_platform.growth.domain_dns import check_custom_domain_dns, www_points_to_platform
from travel_platform.growth.nginx_apex_redirect import (
    render_apex_www_redirect_map,
    write_apex_www_redirect_map,
)


class DomainDnsAutomationTests(unittest.TestCase):
    def test_www_points_via_cname_chain(self):
        with patch(
            "travel_platform.growth.domain_dns._cname_chain",
            return_value=["www.poreiago.com"],
        ), patch(
            "travel_platform.growth.domain_dns._resolve_addrs",
            return_value=["169.58.199.186"],
        ):
            result = www_points_to_platform("example.gr")
        self.assertTrue(result["ok"])
        self.assertEqual(result["matched_via"], "cname")

    def test_www_points_via_a_record(self):
        with patch(
            "travel_platform.growth.domain_dns._cname_chain",
            return_value=[],
        ), patch(
            "travel_platform.growth.domain_dns._resolve_addrs",
            return_value=["169.58.199.186"],
        ):
            result = www_points_to_platform("example.gr")
        self.assertTrue(result["ok"])
        self.assertEqual(result["matched_via"], "a")

    def test_check_ready_when_www_ok(self):
        with patch(
            "travel_platform.growth.domain_dns.www_points_to_platform",
            return_value={
                "host": "www.example.gr",
                "ok": True,
                "cname_chain": ["www.poreiago.com"],
                "addresses": [],
                "expected_cname": "www.poreiago.com",
                "matched_via": "cname",
            },
        ), patch(
            "travel_platform.growth.domain_dns.apex_points_to_platform",
            return_value=False,
        ), patch(
            "travel_platform.growth.domain_dns._resolve_addrs",
            return_value=[],
        ):
            result = check_custom_domain_dns("www.example.gr")
        self.assertEqual(result["domain"], "example.gr")
        self.assertTrue(result["www_ok"])
        self.assertTrue(result["ready_for_tls"])
        self.assertFalse(result["apex_ok"])

    def test_nginx_map_includes_achillio_and_office(self):
        text = render_apex_www_redirect_map(["bookings.agency.gr", "poreiago.com"])
        self.assertIn("www.achilliotravel.com", text)
        self.assertIn("www.bookings.agency.gr", text)
        # Platform domains must never redirect via this map.
        self.assertNotIn("www.poreiago.com;", text)
        self.assertIn("$apex_to_www", text)

    def test_write_nginx_map_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "apex-www-redirect.map"
            written = write_apex_www_redirect_map(["demo.office.gr"], path=out)
            self.assertEqual(written, out)
            body = out.read_text(encoding="utf-8")
            self.assertIn("www.demo.office.gr", body)
            self.assertIn("www.achilliotravel.com", body)


if __name__ == "__main__":
    unittest.main()
