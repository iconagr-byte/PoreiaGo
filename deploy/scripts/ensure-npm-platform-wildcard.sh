#!/usr/bin/env bash
# Ensure Nginx Proxy Manager routes all PoreiaGo office subdomains to the SPA.
# Customers never configure this — platform owns *.poreiago.com.
#
# NPM UI equivalent:
#   Proxy Host: *.poreiago.com  →  http://127.0.0.1:8003
#   SSL: wildcard cert for *.poreiago.com (DNS-01) or upload LE cert
#
# This script is advisory + Host-header smoke when NPM API creds are absent.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/deploy/.env.prod}"
PLATFORM_DOMAIN="${PLATFORM_DOMAIN:-poreiago.com}"
PLATFORM_DOMAIN="${PLATFORM_DOMAIN#www.}"
NPM_APP_PORT="${NPM_APP_PORT:-8003}"
PROBE_HOST="office-dns-probe.${PLATFORM_DOMAIN}"

echo "==> NPM platform wildcard check (*.${PLATFORM_DOMAIN} → :${NPM_APP_PORT})"

CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 \
  -H "Host: ${PROBE_HOST}" \
  -H "X-Forwarded-Host: ${PROBE_HOST}" \
  "http://127.0.0.1:${NPM_APP_PORT}/" 2>/dev/null || echo fail)"
echo "  localhost Host=${PROBE_HOST} → ${CODE}"

if echo "$CODE" | grep -qE '200|301|302|304'; then
  echo "  OK: frontend answers arbitrary office Host headers (server_name _)"
else
  echo "  WARN: frontend did not answer for ${PROBE_HOST} — check poreiago-frontend on :${NPM_APP_PORT}"
fi

# Optional NPM Admin API upsert (when token present in .env.prod)
NPM_URL="$(grep -E '^NPM_URL=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"
NPM_TOKEN="$(grep -E '^NPM_API_TOKEN=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"
NPM_EMAIL="$(grep -E '^NPM_EMAIL=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"
NPM_PASS="$(grep -E '^NPM_PASSWORD=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"
NPM_URL="${NPM_URL:-http://127.0.0.1:81}"

if [[ -z "$NPM_TOKEN" && -n "$NPM_EMAIL" && -n "$NPM_PASS" ]]; then
  NPM_TOKEN="$(curl -sS --max-time 10 -X POST "${NPM_URL}/api/tokens" \
    -H 'Content-Type: application/json' \
    -d "{\"identity\":\"${NPM_EMAIL}\",\"secret\":\"${NPM_PASS}\"}" \
    | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' || true)"
fi

if [[ -z "$NPM_TOKEN" ]]; then
  cat <<EOF
  TIP: In NPM UI add once (platform, not per customer):
    Domain names:  *.${PLATFORM_DOMAIN}
    Scheme:        http
    Forward:       127.0.0.1 : ${NPM_APP_PORT}
    SSL:           Request wildcard *.${PLATFORM_DOMAIN} (DNS challenge) or upload cert
  Optional automation: set NPM_EMAIL + NPM_PASSWORD (or NPM_API_TOKEN) in deploy/.env.prod
EOF
  exit 0
fi

DOMAIN_STAR="*.${PLATFORM_DOMAIN}"
LIST="$(curl -sS --max-time 15 -H "Authorization: Bearer ${NPM_TOKEN}" \
  "${NPM_URL}/api/nginx/proxy-hosts" || true)"
if echo "$LIST" | grep -Fq "$DOMAIN_STAR"; then
  echo "  OK: NPM already has proxy host ${DOMAIN_STAR}"
  exit 0
fi

echo "  creating NPM proxy host ${DOMAIN_STAR} → 127.0.0.1:${NPM_APP_PORT}"
curl -sS --max-time 20 -X POST "${NPM_URL}/api/nginx/proxy-hosts" \
  -H "Authorization: Bearer ${NPM_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"domain_names\": [\"${DOMAIN_STAR}\"],
    \"forward_scheme\": \"http\",
    \"forward_host\": \"127.0.0.1\",
    \"forward_port\": ${NPM_APP_PORT},
    \"access_list_id\": 0,
    \"certificate_id\": 0,
    \"ssl_forced\": false,
    \"caching_enabled\": false,
    \"block_exploits\": true,
    \"advanced_config\": \"\",
    \"meta\": {\"letsencrypt_agree\": false},
    \"allow_websocket_upgrade\": true,
    \"http2_support\": true,
    \"enabled\": true,
    \"locations\": [],
    \"websocket_support\": true
  }" | head -c 400 || true
echo
echo "  Done. Attach wildcard SSL in NPM when ready (DNS-01 for *.${PLATFORM_DOMAIN})."
