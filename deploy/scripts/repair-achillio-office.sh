#!/usr/bin/env bash
# Repair Achillio Travel backoffice on Contabo / NPM edge (non-destructive).
#
# Fixes:
#   1) Ensure tenant admin-achillio-gr owns custom_domain=achilliotravel.com
#   2) Clear poisoned achilliotravel.com from PoreiaGo platform seed (slug=achillio)
#   3) Refresh frontend nginx.conf so /api + /ws proxy to api-blue (fixes 405/SPA HTML)
#   4) Optional admin upsert via ACHILLIO_ADMIN_EMAIL + ACHILLIO_ADMIN_PASSWORD
#
# Usage (on the VPS):
#   cd /opt/poreiago
#   # optional — set once in shell, do not commit:
#   # export ACHILLIO_ADMIN_EMAIL='you@example.com'
#   # export ACHILLIO_ADMIN_PASSWORD='…'
#   bash deploy/scripts/repair-achillio-office.sh
#
# Safe for www.poreiago.com — only heals Achillio domain mapping + nginx /api.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/deploy"
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/.env.prod}"
NPM_APP_PORT="${NPM_APP_PORT:-8003}"
NPM_API_PORT="${NPM_API_PORT:-8004}"
NGINX_CONF="$DEPLOY_DIR/nginx/frontend.conf"

echo "=============================================="
echo " Achillio Travel — office + /api repair"
echo "=============================================="

cd "$REPO_ROOT"

# --- 1) Tenant + custom_domain via API container ---
API_CID="$(docker ps --filter name=api-blue --format '{{.ID}}' | head -1 || true)"
if [[ -z "$API_CID" ]]; then
  API_CID="$(docker ps --filter publish="${NPM_API_PORT}" --format '{{.ID}}' | head -1 || true)"
fi
if [[ -z "$API_CID" ]]; then
  echo "ERROR: api-blue container not found — start the stack first"
  exit 1
fi
echo "==> API container: $(docker inspect -f '{{.Name}}' "$API_CID" | sed 's#^/##')"

# Schema drift heal (subscriptions.plan missing → login/ensure 500).
echo "==> Heal subscriptions.plan if missing"
docker exec -i "$API_CID" python - <<'PY' || echo "WARN: schema heal skipped"
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as session:
        await session.execute(text(
            "ALTER TABLE IF EXISTS subscriptions "
            "ADD COLUMN IF NOT EXISTS plan VARCHAR(32) NOT NULL DEFAULT 'starter'"
        ))
        await session.commit()
        print("subscriptions.plan: ok")

asyncio.run(main())
PY

# Prefer host checkout of ensure logic (API image may lag behind git pull).
echo "==> Sync ensure modules from host git into API container"
for rel in \
  app/services/tenant_modules.py \
  travel_platform/settings/office_host_guard.py \
  app/api/auth.py \
  app/services/auth_service.py
do
  src="$REPO_ROOT/backend/$rel"
  if [[ -f "$src" ]]; then
    docker cp "$src" "$API_CID:/app/$rel" 2>/dev/null \
      || echo "WARN: could not docker cp $rel into API (using image copy)"
  fi
done

# Pass optional admin credentials into the one-shot python (not logged).
# IMPORTANT: docker exec -i so the heredoc reaches python stdin.
echo "==> ensure_achillio_travel_office (slug=admin-achillio-gr)"
docker exec -i \
  -e ACHILLIO_ADMIN_EMAIL="${ACHILLIO_ADMIN_EMAIL:-}" \
  -e ACHILLIO_ADMIN_PASSWORD="${ACHILLIO_ADMIN_PASSWORD:-}" \
  "$API_CID" python - <<'PY'
import asyncio
from app.core.database import AsyncSessionLocal
from app.services.tenant_modules import ensure_achillio_travel_office, ensure_known_office_rent_modules

async def main():
    async with AsyncSessionLocal() as session:
        ensured = await ensure_achillio_travel_office(session)
        print("ensure_achillio_travel_office:", ensured)
        rent = await ensure_known_office_rent_modules(session)
        print("ensure_known_office_rent_modules:", rent)

asyncio.run(main())
PY

echo
echo "Login as Achillio Travel OFFICE (not PoreiaGo superadmin seed):"
echo "  URL:  https://www.achilliotravel.com/admin/login"
echo "  Company code: admin-achillio-gr   (or leave empty on www.achilliotravel.com)"
echo "  Do NOT use company code 'achillio' — that is the PoreiaGo platform seed."
echo
# --- 2) Frontend nginx /api proxy ---
FE_CID="$(docker ps --filter publish="${NPM_APP_PORT}" --format '{{.ID}}' | head -1 || true)"
if [[ -z "$FE_CID" ]]; then
  FE_CID="$(docker ps --filter name=frontend --format '{{.ID}}' | head -1 || true)"
fi
if [[ -z "$FE_CID" ]]; then
  echo "WARN: no frontend on :${NPM_APP_PORT} — skip nginx repair"
else
  echo "==> Frontend container: $(docker inspect -f '{{.Name}}' "$FE_CID" | sed 's#^/##')"
  # Same Docker network so nginx can resolve api-blue.
  docker network connect aerostride-prod_edge "$FE_CID" 2>/dev/null || true
  docker network connect aerostride-prod_edge "$API_CID" 2>/dev/null || true

  if [[ -f "$NGINX_CONF" ]]; then
    echo "==> Installing frontend.conf (same-origin /api → api-blue)"
    # Compose mounts frontend.conf:ro — docker cp → "device or resource busy".
    if docker inspect -f '{{range .Mounts}}{{println .Destination}}{{end}}' "$FE_CID" \
      | grep -qx '/etc/nginx/conf.d/default.conf'; then
      echo "  conf is bind-mounted from host — skip docker cp, reload only"
    else
      if ! docker cp "$NGINX_CONF" "$FE_CID:/etc/nginx/conf.d/default.conf"; then
        echo "WARN: docker cp failed (busy/ro mount?) — will still try nginx reload"
      fi
    fi
    if docker exec "$FE_CID" nginx -t; then
      docker exec "$FE_CID" nginx -s reload
      echo "  nginx reloaded"
    else
      echo "WARN: nginx -t failed — check $NGINX_CONF and container image"
    fi
  else
    echo "WARN: missing $NGINX_CONF"
  fi

  # Refresh static SPA if dist exists (does not replace nginx.conf).
  if [[ -d "$REPO_ROOT/dist" ]]; then
    echo "==> Refreshing dist/ into frontend html root"
    docker cp "$REPO_ROOT/dist/." "$FE_CID:/usr/share/nginx/html/" 2>/dev/null \
      || echo "WARN: dist copy failed"
  fi
fi

# --- 3) Smoke checks (localhost — NPM terminates TLS) ---
echo "==> Smoke checks"
if curl -sf "http://127.0.0.1:${NPM_API_PORT}/health" >/dev/null; then
  echo "  API :${NPM_API_PORT}/health OK"
else
  echo "  WARN: API :${NPM_API_PORT}/health failed"
fi

if [[ -n "${FE_CID:-}" ]]; then
  if docker exec "$FE_CID" wget -qO- --timeout=5 http://127.0.0.1/health 2>/dev/null | grep -q '"status"'; then
    echo "  frontend /health → api-blue OK"
  else
    echo "  WARN: frontend /health still not proxying — check edge network + nginx.conf"
  fi
fi

echo
echo "Done. Verify from your laptop:"
echo "  curl -sI https://www.achilliotravel.com/admin/login"
echo "  curl -sk https://www.achilliotravel.com/health   # should be JSON, not HTML"
echo "  curl -sk -X POST https://api.poreiago.com/api/v1/auth/login \\"
echo "    -H 'Content-Type: application/json' -H 'Origin: https://www.achilliotravel.com' \\"
echo "    -d '{\"email\":\"…\",\"password\":\"…\"}'"
echo
echo "DNS: apex A for achilliotravel.com must be 169.58.199.186 (not old GCP)."
echo "NPM: Proxy Host www.achilliotravel.com → 127.0.0.1:${NPM_APP_PORT}"
