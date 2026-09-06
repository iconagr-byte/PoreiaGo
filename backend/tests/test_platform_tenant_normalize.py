"""Platform tenant update helpers — domain / AFM normalization."""

from __future__ import annotations

import unittest

from app.services.platform_admin_service import normalize_custom_domain, normalize_vat_number


class NormalizeDomainTests(unittest.TestCase):
    def test_strips_protocol_and_www(self):
        self.assertEqual(normalize_custom_domain("https://www.AchillioTravel.com/path"), "achilliotravel.com")

    def test_empty_clears(self):
        self.assertIsNone(normalize_custom_domain(""))
        self.assertIsNone(normalize_custom_domain(None))

    def test_rejects_invalid(self):
        with self.assertRaises(ValueError):
            normalize_custom_domain("not a domain")


class NormalizeVatTests(unittest.TestCase):
    def test_accepts_nine_digits(self):
        self.assertEqual(normalize_vat_number("123456789"), "123456789")

    def test_empty_clears(self):
        self.assertIsNone(normalize_vat_number(""))

    def test_rejects_short(self):
        with self.assertRaises(ValueError):
            normalize_vat_number("12345")


if __name__ == "__main__":
    unittest.main()
