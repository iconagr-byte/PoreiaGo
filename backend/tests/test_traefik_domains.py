"""Traefik custom-domain YAML renderer."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from travel_platform.growth.traefik_domains import (
    render_custom_domains_yaml,
    write_custom_domains_file,
)


class TraefikDomainsTests(unittest.TestCase):
    def test_render_includes_www_and_apex_by_default(self):
        yaml = render_custom_domains_yaml(["www.achilliotravel.com"])
        self.assertIn("Host(`www.achilliotravel.com`)", yaml)
        self.assertIn("Host(`achilliotravel.com`)", yaml)
        self.assertIn('main: "www.achilliotravel.com"', yaml)
        self.assertIn('main: "achilliotravel.com"', yaml)
        self.assertIn("tenant-domain-www-achilliotravel-com", yaml)
        self.assertIn("tenant-domain-apex-achilliotravel-com", yaml)
        self.assertIn("certResolver: letsencrypt", yaml)
        self.assertIn("http://frontend:80", yaml)
        # Platform domains must never be routed here.
        blocked = render_custom_domains_yaml(["www.poreiago.com", "api.poreiago.com", "achilliotravel.com"])
        self.assertIn("www.achilliotravel.com", blocked)
        self.assertNotIn("Host(`www.poreiago.com`)", blocked)
        self.assertNotIn("Host(`api.poreiago.com`)", blocked)

    def test_render_can_skip_apex(self):
        yaml = render_custom_domains_yaml(["achilliotravel.com"], include_apex=False)
        self.assertIn("Host(`www.achilliotravel.com`)", yaml)
        self.assertNotIn("Host(`achilliotravel.com`)", yaml)

    def test_write_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "custom-domains.yml"
            written = write_custom_domains_file(["achilliotravel.com"], path=out)
            self.assertEqual(written, out)
            text = out.read_text(encoding="utf-8")
            self.assertIn("www.achilliotravel.com", text)
            self.assertIn("Host(`achilliotravel.com`)", text)

    def test_env_can_disable_apex(self):
        with patch.dict("os.environ", {"TRAEFIK_INCLUDE_APEX": "0"}, clear=False):
            yaml = render_custom_domains_yaml(["achilliotravel.com"])
            self.assertIn("Host(`www.achilliotravel.com`)", yaml)
            self.assertNotIn("Host(`achilliotravel.com`)", yaml)


if __name__ == "__main__":
    unittest.main()
