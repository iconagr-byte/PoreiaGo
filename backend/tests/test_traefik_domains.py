"""Traefik custom-domain YAML renderer."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from travel_platform.growth.traefik_domains import (
    apex_points_to_platform,
    render_custom_domains_yaml,
    write_custom_domains_file,
)


class TraefikDomainsTests(unittest.TestCase):
    def test_render_includes_www_only_by_default(self):
        with patch(
            "travel_platform.growth.traefik_domains.apex_points_to_platform",
            return_value=False,
        ):
            yaml = render_custom_domains_yaml(["www.achilliotravel.com"])
        self.assertIn("Host(`www.achilliotravel.com`)", yaml)
        self.assertNotIn("Host(`achilliotravel.com`)", yaml)
        self.assertIn('main: "www.achilliotravel.com"', yaml)
        self.assertIn("certResolver: letsencrypt", yaml)
        self.assertIn("http://frontend:80", yaml)
        # Platform domains must never be routed here.
        with patch(
            "travel_platform.growth.traefik_domains.apex_points_to_platform",
            return_value=False,
        ):
            blocked = render_custom_domains_yaml(
                ["www.poreiago.com", "api.poreiago.com", "achilliotravel.com"]
            )
        self.assertIn("www.achilliotravel.com", blocked)
        self.assertNotIn("Host(`www.poreiago.com`)", blocked)
        self.assertNotIn("Host(`api.poreiago.com`)", blocked)

    def test_render_can_include_apex_as_separate_mains(self):
        yaml = render_custom_domains_yaml(["achilliotravel.com"], include_apex=True)
        self.assertIn("Host(`achilliotravel.com`)", yaml)
        self.assertIn("Host(`www.achilliotravel.com`)", yaml)
        self.assertIn('main: "achilliotravel.com"', yaml)
        self.assertIn('main: "www.achilliotravel.com"', yaml)
        # Must not nest apex under www as SAN (would break LE if apex DNS is wrong).
        self.assertNotIn("sans:", yaml)

    def test_apex_points_to_platform(self):
        with patch(
            "travel_platform.growth.traefik_domains.socket.getaddrinfo",
            return_value=[(None, None, None, None, ("169.58.199.186", 0))],
        ):
            self.assertTrue(apex_points_to_platform("achilliotravel.com"))
        with patch(
            "travel_platform.growth.traefik_domains.socket.getaddrinfo",
            return_value=[(None, None, None, None, ("34.141.98.145", 0))],
        ):
            self.assertFalse(apex_points_to_platform("achilliotravel.com"))
        with patch(
            "travel_platform.growth.traefik_domains.socket.getaddrinfo",
            return_value=[(None, None, None, None, ("185.104.144.132", 0))],
        ):
            self.assertFalse(apex_points_to_platform("achilliotravel.com"))

    def test_write_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "custom-domains.yml"
            with patch(
                "travel_platform.growth.traefik_domains.apex_points_to_platform",
                return_value=False,
            ):
                written = write_custom_domains_file(["achilliotravel.com"], path=out)
            self.assertEqual(written, out)
            text = out.read_text(encoding="utf-8")
            self.assertIn("www.achilliotravel.com", text)


if __name__ == "__main__":
    unittest.main()
