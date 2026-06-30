"""Tracking pixel, click redirect, unsubscribe footer."""

from __future__ import annotations

import os
import re
from urllib.parse import quote, urlencode

_LINK_PATTERN = re.compile(r'href=["\'](https?://[^"\']+)["\']', re.I)


def public_api_base() -> str:
    return os.getenv("PUBLIC_API_URL", os.getenv("PUBLIC_APP_URL", "http://127.0.0.1:8000")).rstrip("/")


def tracking_pixel_url(token: str) -> str:
    return f"{public_api_base()}/api/track/open/{token}.gif"


def unsubscribe_url(token: str) -> str:
    return f"{public_api_base()}/api/unsubscribe/{token}"


def wrap_links_for_tracking(html: str, token: str) -> str:
    base = public_api_base()

    def repl(match: re.Match) -> str:
        url = match.group(1)
        tracked = f"{base}/api/track/click/{token}?{urlencode({'url': url})}"
        return f'href="{tracked}"'

    return _LINK_PATTERN.sub(repl, html or "")


def inject_campaign_tracking(html: str, *, tracking_token: str) -> str:
    pixel = (
        f'<img src="{tracking_pixel_url(tracking_token)}" width="1" height="1" '
        f'alt="" style="display:none!important" />'
    )
    unsub = (
        f'<p style="margin-top:24px;font-size:12px;color:#64748b;text-align:center;">'
        f'<a href="{unsubscribe_url(tracking_token)}">Διαγραφή από τη λίστα / Unsubscribe</a></p>'
    )
    body = wrap_links_for_tracking(html, tracking_token)
    if "</body>" in body.lower():
        low = body.lower()
        idx = low.rfind("</body>")
        return body[:idx] + pixel + unsub + body[idx:]
    return body + pixel + unsub
