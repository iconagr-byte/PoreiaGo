"""Nginx Proxy Manager API — upsert proxy + apex→www redirection hosts.

Contabo production uses NPM on :80/:443. When NPM_API_URL + credentials are set,
saving a custom domain provisions the same route pattern used for achilliotravel.com:
  - Proxy Host: www.{apex} (+ optional apex) → FRONTEND_UPSTREAM
  - Redirection Host: apex → https://www.{apex}
  - Advanced: X-Forwarded-Host snippet (required for SPA/seo-shell)
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_SAFE = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$", re.I)

DEFAULT_XFH_SNIPPET = """\
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
"""


def edge_proxy_mode() -> str:
    raw = (os.getenv("EDGE_PROXY") or "").strip().lower()
    if raw in {"npm", "traefik"}:
        return raw
    if (os.getenv("USE_NPM") or "").strip() in {"1", "true", "yes"}:
        return "npm"
    return "traefik"


def npm_configured() -> bool:
    if not (os.getenv("NPM_API_URL") or "").strip():
        return False
    if (os.getenv("NPM_TOKEN") or "").strip():
        return True
    return bool((os.getenv("NPM_EMAIL") or "").strip() and (os.getenv("NPM_PASSWORD") or "").strip())


def _normalize_domain(value: str) -> str:
    host = value.strip().lower().removeprefix("https://").removeprefix("http://")
    return host.split("/")[0].split(":")[0].removeprefix("www.")


def _frontend_upstream() -> tuple[str, int]:
    host = (os.getenv("NPM_FORWARD_HOST") or "127.0.0.1").strip() or "127.0.0.1"
    port = int((os.getenv("NPM_APP_PORT") or os.getenv("NPM_FORWARD_PORT") or "8003").strip() or "8003")
    return host, port


def _xfh_snippet() -> str:
    path = (os.getenv("NPM_XFH_SNIPPET_PATH") or "").strip()
    if path:
        try:
            from pathlib import Path

            text = Path(path).read_text(encoding="utf-8")
            if text.strip():
                return text if text.endswith("\n") else text + "\n"
        except OSError:
            pass
    return DEFAULT_XFH_SNIPPET


class NpmClient:
    def __init__(self, base_url: str | None = None, timeout: float = 12.0) -> None:
        self.base = (base_url or os.getenv("NPM_API_URL") or "").rstrip("/")
        self.timeout = timeout
        self._token: str | None = (os.getenv("NPM_TOKEN") or "").strip() or None

    async def _ensure_token(self, client: httpx.AsyncClient) -> str:
        if self._token:
            return self._token
        email = (os.getenv("NPM_EMAIL") or "").strip()
        password = (os.getenv("NPM_PASSWORD") or "").strip()
        if not email or not password:
            raise RuntimeError("NPM_TOKEN or NPM_EMAIL/NPM_PASSWORD required")
        res = await client.post(
            f"{self.base}/api/tokens",
            json={"identity": email, "secret": password},
        )
        res.raise_for_status()
        data = res.json()
        token = data.get("token") or (data.get("result") or {}).get("token")
        if not token:
            raise RuntimeError("NPM login returned no token")
        self._token = str(token)
        return self._token

    def _headers(self, token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async def list_proxy_hosts(self, client: httpx.AsyncClient, token: str) -> list[dict]:
        res = await client.get(f"{self.base}/api/nginx/proxy-hosts", headers=self._headers(token))
        res.raise_for_status()
        data = res.json()
        return data if isinstance(data, list) else []

    async def list_redirection_hosts(self, client: httpx.AsyncClient, token: str) -> list[dict]:
        res = await client.get(
            f"{self.base}/api/nginx/redirection-hosts",
            headers=self._headers(token),
        )
        res.raise_for_status()
        data = res.json()
        return data if isinstance(data, list) else []

    async def upsert_www_proxy(self, domain: str) -> dict[str, Any]:
        apex = _normalize_domain(domain)
        if not apex or not _SAFE.match(apex):
            return {"ok": False, "error": "invalid_domain"}
        www = f"www.{apex}"
        forward_host, forward_port = _frontend_upstream()
        snippet = _xfh_snippet()

        async with httpx.AsyncClient(timeout=self.timeout, verify=False) as client:
            token = await self._ensure_token(client)
            hosts = await self.list_proxy_hosts(client, token)
            existing = None
            for row in hosts:
                names = [str(n).lower() for n in (row.get("domain_names") or [])]
                if www in names or apex in names:
                    existing = row
                    break

            body = {
                "domain_names": [www],
                "forward_scheme": "http",
                "forward_host": forward_host,
                "forward_port": forward_port,
                "certificate_id": "new" if not existing else existing.get("certificate_id") or "new",
                "ssl_forced": True,
                "http2_support": True,
                "block_exploits": True,
                "caching_enabled": False,
                "allow_websocket_upgrade": True,
                "access_list_id": "0",
                "advanced_config": snippet,
                "meta": {"letsencrypt_agree": True, "dns_challenge": False},
                "locations": [],
            }
            # Keep existing LE cert id when present (int); "new" requests issuance.
            cert_id = body["certificate_id"]
            if isinstance(cert_id, int) and cert_id > 0:
                body["certificate_id"] = cert_id
            elif existing and isinstance(existing.get("certificate_id"), int):
                body["certificate_id"] = existing["certificate_id"]
            else:
                body["certificate_id"] = "new"

            if existing:
                hid = existing.get("id")
                res = await client.put(
                    f"{self.base}/api/nginx/proxy-hosts/{hid}",
                    headers=self._headers(token),
                    json={**existing, **body, "id": hid},
                )
            else:
                res = await client.post(
                    f"{self.base}/api/nginx/proxy-hosts",
                    headers=self._headers(token),
                    json=body,
                )
            if res.status_code >= 400:
                logger.warning("NPM proxy upsert failed for %s: %s %s", www, res.status_code, res.text[:300])
                return {"ok": False, "error": f"proxy_{res.status_code}", "detail": res.text[:300]}
            proxy = res.json()

            # Apex → www redirection host (same as Achillio SERP fix).
            redirects = await self.list_redirection_hosts(client, token)
            red_existing = None
            for row in redirects:
                names = [str(n).lower() for n in (row.get("domain_names") or [])]
                if apex in names:
                    red_existing = row
                    break
            red_body = {
                "domain_names": [apex],
                "forward_domain_name": www,
                "forward_scheme": "https",
                "forward_http_code": 301,
                "preserve_path": True,
                "certificate_id": "new",
                "ssl_forced": True,
                "block_exploits": True,
                "advanced_config": "",
                "meta": {"letsencrypt_agree": True, "dns_challenge": False},
            }
            if red_existing and isinstance(red_existing.get("certificate_id"), int):
                red_body["certificate_id"] = red_existing["certificate_id"]
            if red_existing:
                rid = red_existing.get("id")
                rres = await client.put(
                    f"{self.base}/api/nginx/redirection-hosts/{rid}",
                    headers=self._headers(token),
                    json={**red_existing, **red_body, "id": rid},
                )
            else:
                rres = await client.post(
                    f"{self.base}/api/nginx/redirection-hosts",
                    headers=self._headers(token),
                    json=red_body,
                )
            redirect_ok = rres.status_code < 400
            if not redirect_ok:
                logger.warning(
                    "NPM redirection upsert failed for %s: %s %s",
                    apex,
                    rres.status_code,
                    rres.text[:300],
                )

            return {
                "ok": True,
                "www": www,
                "apex": apex,
                "proxy_id": proxy.get("id") if isinstance(proxy, dict) else None,
                "redirect_ok": redirect_ok,
                "forward": f"{forward_host}:{forward_port}",
            }


async def upsert_npm_custom_domain(domain: str) -> dict[str, Any]:
    if edge_proxy_mode() != "npm":
        return {"ok": False, "skipped": True, "reason": "edge_not_npm"}
    if not npm_configured():
        return {"ok": False, "skipped": True, "reason": "npm_credentials_missing"}
    try:
        return await NpmClient().upsert_www_proxy(domain)
    except Exception as exc:
        logger.warning("NPM custom domain upsert error for %s: %s", domain, exc)
        return {"ok": False, "error": str(exc)[:240]}


async def sync_npm_custom_domains(domains: list[str]) -> list[dict[str, Any]]:
    if edge_proxy_mode() != "npm" or not npm_configured():
        return []
    results = []
    for raw in domains:
        apex = _normalize_domain(raw or "")
        if not apex:
            continue
        results.append(await upsert_npm_custom_domain(apex))
    return results
