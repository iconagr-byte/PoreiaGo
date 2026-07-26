"""Contract: ticket email magic links prefer office public origin."""

from __future__ import annotations

import unittest

from ticketing.ticket_email import _public_base_url


class TicketEmailPublicUrlTests(unittest.TestCase):
    def test_custom_domain_gets_www(self):
        self.assertEqual(
            _public_base_url({"custom_domain": "achilliotravel.com"}),
            "https://www.achilliotravel.com",
        )

    def test_www_custom_domain_kept(self):
        self.assertEqual(
            _public_base_url({"custom_domain": "www.achilliotravel.com"}),
            "https://www.achilliotravel.com",
        )

    def test_explicit_public_base_wins(self):
        self.assertEqual(
            _public_base_url(
                {
                    "public_base_url": "https://demo.poreiago.com",
                    "custom_domain": "achilliotravel.com",
                }
            ),
            "https://demo.poreiago.com",
        )

    def test_platform_subdomain_not_prefixed_www(self):
        self.assertEqual(
            _public_base_url({"custom_domain": "athens.poreiago.com"}),
            "https://athens.poreiago.com",
        )


if __name__ == "__main__":
    unittest.main()
