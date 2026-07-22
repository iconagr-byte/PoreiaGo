"""Traefik custom-domain YAML renderer."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from travel_platform.growth.traefik_domains import (
    render_custom_domains_yaml,
    write_custom_domains_file,
)


class TraefikDomainsTests(unittest.TestCase):
    def test_render_includes_apex_and_www(self):
        yaml = render_custom_domains_yaml(["www.achilliotravel.com"])
        self.assertIn("Host(`achilliotravel.com`)", yaml)
        self.assertIn("Host(`www.achilliotravel.com`)", yaml)
        self.assertIn("certResolver: letsencrypt", yaml)
        self.assertIn("http://frontend:80", yaml)
        # Platform domains must never be routed here.
        blocked = render_custom_domains_yaml(["www.poreiago.com", "api.poreiago.com", "achilliotravel.com"])
        self.assertIn("achilliotravel.com", blocked)
        self.assertNotIn("Host(`www.poreiago.com`)", blocked)
        self.assertNotIn("Host(`api.poreiago.com`)", blocked)

    def test_write_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "custom-domains.yml"
            written = write_custom_domains_file(["achilliotravel.com"], path=out)
            self.assertEqual(written, out)
            text = out.read_text(encoding="utf-8")
            self.assertIn("tenant-domain-achilliotravel-com", text)


if __name__ == "__main__":
    unittest.main()
