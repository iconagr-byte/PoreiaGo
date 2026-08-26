"""Login on api.* must use Origin host for Achillio Travel affinity."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from fastapi import Request

from app.api.auth import _browser_office_host


def _request(*, host: str, origin: str | None = None, referer: str | None = None) -> Request:
    headers = [(b"host", host.encode())]
    if origin:
        headers.append((b"origin", origin.encode()))
    if referer:
        headers.append((b"referer", referer.encode()))
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "https",
        "path": "/api/v1/auth/login",
        "raw_path": b"/api/v1/auth/login",
        "query_string": b"",
        "headers": headers,
        "client": ("127.0.0.1", 12345),
        "server": ("api.poreiago.com", 443),
    }
    return Request(scope)


class BrowserOfficeHostTests(unittest.TestCase):
    def test_shared_api_uses_origin_achillio(self):
        req = _request(
            host="api.poreiago.com",
            origin="https://www.achilliotravel.com",
        )
        with patch(
            "middleware.domain_tenant._request_host",
            return_value="api.poreiago.com",
        ):
            self.assertEqual(_browser_office_host(req), "www.achilliotravel.com")

    def test_non_api_host_unchanged(self):
        req = _request(
            host="www.achilliotravel.com",
            origin="https://www.poreiago.com",
        )
        with patch(
            "middleware.domain_tenant._request_host",
            return_value="www.achilliotravel.com",
        ):
            self.assertEqual(_browser_office_host(req), "www.achilliotravel.com")

    def test_shared_api_falls_back_to_referer(self):
        req = _request(
            host="api.poreiago.com",
            referer="https://www.achilliotravel.com/admin/login",
        )
        with patch(
            "middleware.domain_tenant._request_host",
            return_value="api.poreiago.com",
        ):
            self.assertEqual(_browser_office_host(req), "www.achilliotravel.com")


if __name__ == "__main__":
    unittest.main()
