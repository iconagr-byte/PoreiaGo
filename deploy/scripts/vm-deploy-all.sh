#!/usr/bin/env bash
# One-shot production deploy on poreiago-vm (run via SSH).
# Usage:
#   cd /opt/poreiago && bash deploy/scripts/vm-deploy-all.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/deploy"
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/.env.prod}"
API_BASE="${API_BASE:-https://api.poreiago.com}"
APP_ORIGIN="${APP_ORIGIN:-https://www.poreiago.com}"
API_IMAGE="${API_IMAGE:-poreiago-api:latest}"
NPM_COMPOSE_FILE="${NPM_COMPOSE_FILE:-$DEPLOY_DIR/docker-compose.npm.yml}"
# Localhost ports when Nginx Proxy Manager owns :80/:443 (see docker-compose.npm.yml).
NPM_API_PORT="${NPM_API_PORT:-8004}"
NPM_APP_PORT="${NPM_APP_PORT:-8003}"

# Serialize deploys on the VM (GitHub cancel-in-progress still leaves racing SSH sessions).
DEPLOY_LOCK="${DEPLOY_LOCK:-/tmp/poreiago-vm-deploy.lock}"
exec 200>"$DEPLOY_LOCK"
echo "==> Waiting for deploy lock ($DEPLOY_LOCK)…"
if ! flock -w 2400 200; then
  echo "ERROR: timed out waiting for another deploy to finish ($DEPLOY_LOCK)"
  exit 1
fi
echo "==> Deploy lock acquired"

# Edge proxy: Traefik (default) or Nginx Proxy Manager (Contabo / shared VPS).
# Prefer explicit .env.prod (USE_NPM=1 / EDGE_PROXY=npm); else auto-detect NPM.
detect_edge_proxy() {
  local explicit=""
  if [[ -f "$ENV_FILE" ]]; then
    if grep -qE '^USE_NPM=1([[:space:]]|$)' "$ENV_FILE" 2>/dev/null \
      || grep -qE '^EDGE_PROXY=npm([[:space:]]|$)' "$ENV_FILE" 2>/dev/null; then
      echo "npm"
      return 0
    fi
    if grep -qE '^USE_NPM=0([[:space:]]|$)' "$ENV_FILE" 2>/dev/null \
      || grep -qE '^EDGE_PROXY=traefik([[:space:]]|$)' "$ENV_FILE" 2>/dev/null; then
      echo "traefik"
      return 0
    fi
    explicit="$(grep -E '^EDGE_PROXY=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"
    if [[ "$explicit" == "npm" || "$explicit" == "traefik" ]]; then
      echo "$explicit"
      return 0
    fi
  fi
  # Container name / image: jc21 NPM, nginxproxymanager_*, npm-*, etc.
  if docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null \
    | grep -qiE 'nginx-proxy-manager|nginxproxymanager|jc21/nginx-proxy|npm[_-]|[_-]npm([[:space:]]|$)'; then
    echo "npm"
    return 0
  fi
  # Contabo / shared VPS: :80 already held by something other than Traefik → use NPM path.
  if host_port_in_use 80; then
    local who80=""
    who80="$(docker ps --filter publish=80 --format '{{.Names}}' 2>/dev/null | head -1 || true)"
    if [[ -z "$who80" ]] || ! grep -qiE 'traefik' <<<"$who80"; then
      echo "npm"
      return 0
    fi
  fi
  echo "traefik"
}

# True when host TCP port is already bound (e.g. legacy poreiago-frontend on 8003).
host_port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | grep -qE ":${port}\\b"
    return $?
  fi
  if command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | grep -qE ":${port}\\b"
    return $?
  fi
  return 1
}

# Refresh static assets into an external frontend container (not compose frontend).
refresh_external_frontend_dist() {
  local cid="$1"
  local dist="$REPO_ROOT/dist"
  [[ -n "$cid" && -d "$dist" ]] || return 0
  local mounts=""
  mounts="$(docker inspect "$cid" --format '{{range .Mounts}}{{.Source}} {{end}}' 2>/dev/null || true)"
  if grep -qF "$REPO_ROOT/dist" <<<"$mounts" 2>/dev/null \
    || grep -qE '/opt/poreiago/dist([[:space:]]|$)' <<<"$mounts" 2>/dev/null; then
    echo "  frontend bind-mounts dist/ — already refreshed by npm build"
    return 0
  fi
  echo "  copying dist/ into frontend container html root…"
  if docker exec "$cid" test -d /usr/share/nginx/html 2>/dev/null; then
    docker cp "$dist/." "$cid:/usr/share/nginx/html/" 2>/dev/null \
      || echo "  WARN: docker cp dist → /usr/share/nginx/html failed"
  else
    echo "  WARN: no /usr/share/nginx/html in frontend — skip dist copy"
  fi
}

# Contabo poreiago-frontend often only serves static files — POST /api → 405.
# Install repo frontend.conf so /api + /ws + /health proxy to api-blue,
# and so achilliotravel.com serves index.achillio.html (static SERP title).
repair_external_frontend_nginx() {
  local cid="$1"
  local conf="$DEPLOY_DIR/nginx/frontend.conf"
  local shared="$DEPLOY_DIR/nginx/frontend-shared.inc"
  [[ -n "$cid" && -f "$conf" ]] || return 0
  echo "==> Repair external frontend nginx (/api → api-blue + Achillio SPA shell)"
  docker network connect aerostride-prod_edge "$cid" 2>/dev/null || true

  local conf_src=""
  conf_src="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/nginx/conf.d/default.conf"}}{{.Source}}{{end}}{{end}}' "$cid" 2>/dev/null || true)"
  if [[ -n "$conf_src" && -d "$(dirname "$conf_src")" ]]; then
    echo "  force-sync frontend.conf → $conf_src"
    cp "$conf" "$conf_src" || echo "  WARN: could not write $conf_src"
    if [[ -f "$shared" ]]; then
      conf_dir="$(dirname "$conf_src")"
      cp "$shared" "$conf_dir/frontend-shared.inc" 2>/dev/null || true
      echo "  docker cp frontend-shared.inc → container conf.d"
      docker cp "$shared" "$cid:/etc/nginx/conf.d/frontend-shared.inc" 2>/dev/null \
        || echo "  WARN: could not docker cp frontend-shared.inc"
    fi
  else
    if ! docker cp "$conf" "$cid:/etc/nginx/conf.d/default.conf" 2>/dev/null; then
      echo "  WARN: could not copy frontend.conf into container — reload anyway"
    fi
    [[ -f "$shared" ]] && docker cp "$shared" "$cid:/etc/nginx/conf.d/frontend-shared.inc" 2>/dev/null || true
  fi

  if docker exec "$cid" nginx -t 2>/dev/null; then
    docker exec "$cid" nginx -s reload 2>/dev/null || true
    echo "  nginx reloaded with same-origin /api proxy"
  else
    echo "  WARN: nginx -t failed after conf sync — check container image"
    docker exec "$cid" nginx -t 2>&1 | sed 's/^/  /' || true
  fi

  # Ensure frontend can resolve api-blue (homepage seo-shell proxy).
  docker network connect aerostride-prod_edge "$cid" 2>/dev/null || true
  local api_cid=""
  api_cid="$(docker ps --filter "name=api-blue" --format '{{.ID}}' | head -1 || true)"
  if [[ -n "$api_cid" ]]; then
    local api_net=""
    api_net="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$api_cid" 2>/dev/null | head -1 || true)"
    if [[ -n "$api_net" ]]; then
      docker network connect "$api_net" "$cid" 2>/dev/null || true
    fi
  fi

  # If api-blue DNS fails from this frontend, point seo upstream at host-published API :8004.
  if ! docker exec "$cid" wget -qO- --timeout=4 http://api-blue:8000/health 2>/dev/null | grep -q '"status"'; then
    echo "  api-blue DNS unreachable from frontend — using host gateway :${NPM_API_PORT:-8004}"
    local gw="172.17.0.1"
    gw="$(docker network inspect bridge -f '{{(index .IPAM.Config 0).Gateway}}' 2>/dev/null || echo 172.17.0.1)"
    docker exec "$cid" sh -c \
      "sed -i 's/api-blue:8000/${gw}:${NPM_API_PORT:-8004}/g' /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/frontend-shared.inc 2>/dev/null || true"
    docker exec "$cid" nginx -t 2>/dev/null && docker exec "$cid" nginx -s reload 2>/dev/null || true
  fi

  # Prove default shell (no Host) is Achillio — Contabo often ignores server_name.
  local default_title=""
  local local_title=""
  if docker exec "$cid" sh -c 'command -v curl >/dev/null' 2>/dev/null; then
    default_title="$(docker exec "$cid" curl -sS --max-time 5 http://127.0.0.1/ 2>/dev/null \
      | tr '\n' ' ' | sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/p' || true)"
    local_title="$(docker exec "$cid" curl -sS --max-time 5 \
      -H 'Host: www.achilliotravel.com' http://127.0.0.1/ 2>/dev/null \
      | tr '\n' ' ' | sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/p' || true)"
  else
    default_title="$(docker exec "$cid" wget -qO- --timeout=5 http://127.0.0.1/ 2>/dev/null \
      | tr '\n' ' ' | sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/p' || true)"
    local_title="$(docker exec "$cid" wget -qO- --timeout=5 \
      --header='Host: www.achilliotravel.com' http://127.0.0.1/ 2>/dev/null \
      | tr '\n' ' ' | sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/p' || true)"
  fi
  echo "  localhost default <title> → ${default_title:-<empty>}"
  echo "  localhost Host=www.achilliotravel.com <title> → ${local_title:-<empty>}"
  local pg_title=""
  if docker exec "$cid" sh -c 'command -v curl >/dev/null' 2>/dev/null; then
    pg_title="$(docker exec "$cid" curl -sS --max-time 5 \
      -H 'Host: www.poreiago.com' -H 'X-Forwarded-Host: www.poreiago.com' \
      http://127.0.0.1/ 2>/dev/null \
      | tr '\n' ' ' | sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/p' || true)"
  fi
  echo "  localhost Host+XFH=poreiago.com <title> → ${pg_title:-<empty>}"
  if ! echo "$default_title" | grep -qi 'achillio'; then
    echo "  WARN: default index.html is not Achillio Travel — check ensure_achillio_spa_shell"
    docker exec "$cid" sh -c 'ls -la /usr/share/nginx/html/index*.html 2>/dev/null; rg -n "<title>" /usr/share/nginx/html/index.html | head -3' \
      2>/dev/null | sed 's/^/  /' || true
  fi

  if docker exec "$cid" wget -qO- --timeout=5 http://127.0.0.1/health 2>/dev/null | grep -q '"status"'; then
    echo "  frontend /health → api-blue OK"
  else
    echo "  WARN: frontend /health still not JSON — api-blue may be off the edge network"
  fi
}

# Googlebot reads static <title>. Contabo Host routing is unreliable, so:
# - index.poreiago.html = PoreiaGo marketing
# - index.html + index.achillio.html = Achillio Travel (default SERP-safe)
ensure_achillio_spa_shell() {
  local index="$REPO_ROOT/dist/index.html"
  local achillio="$REPO_ROOT/dist/index.achillio.html"
  local poreiago_out="$REPO_ROOT/dist/index.poreiago.html"
  local title="Achillio Travel — Εκδρομές με λεωφορείο"
  local poreiago="PoreiaGo — Πλατφόρμα για ταξιδιωτικά γραφεία"
  [[ -f "$index" ]] || { echo "  ERROR: missing $index"; return 1; }

  if grep -q "<title>${title}</title>" "$index" \
    && [[ -f "$achillio" ]] && [[ -f "$poreiago_out" ]]; then
    echo "  dist shells ready (index.html=Achillio, index.poreiago.html=PoreiaGo)"
    return 0
  fi

  echo "  writing Achillio default index + PoreiaGo shell"
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$index" "$achillio" "$poreiago_out" "$poreiago" "$title" <<'PY'
import sys
src, ach_path, por_path, old, new = sys.argv[1:6]
html = open(src, encoding="utf-8").read()
# Preserve PoreiaGo marketing shell first (before rewriting src).
if old in html:
    open(por_path, "w", encoding="utf-8").write(html)
elif not __import__("os").path.isfile(por_path):
    open(por_path, "w", encoding="utf-8").write(html)
ach = html.replace(old, new).replace(
    'name="application-name" content="PoreiaGo"',
    'name="application-name" content="Achillio Travel"',
)
if f"<title>{new}</title>" not in ach:
    raise SystemExit("failed to rewrite Achillio document title")
open(ach_path, "w", encoding="utf-8").write(ach)
open(src, "w", encoding="utf-8").write(ach)
PY
  else
    cp "$index" "$poreiago_out"
    cp "$index" "$achillio"
    sed -i "s/${poreiago}/${title}/g" "$achillio"
    sed -i 's/name="application-name" content="PoreiaGo"/name="application-name" content="Achillio Travel"/g' "$achillio"
    cp "$achillio" "$index"
  fi
  grep -q "<title>${title}</title>" "$index" \
    || { echo "  ERROR: index.html Achillio title rewrite failed"; return 1; }
}

configure_compose_for_edge() {
  EDGE_PROXY="$(detect_edge_proxy)"
  COMPOSE="docker compose --env-file $ENV_FILE -f $DEPLOY_DIR/docker-compose.prod.yml"
  if [[ "$EDGE_PROXY" == "npm" ]]; then
    if [[ ! -f "$NPM_COMPOSE_FILE" ]]; then
      echo "ERROR: NPM edge selected but missing $NPM_COMPOSE_FILE"
      exit 1
    fi
    COMPOSE="$COMPOSE -f $NPM_COMPOSE_FILE"
    # Persist so later deploys stay on NPM even if the container name changes.
    if [[ -f "$ENV_FILE" ]] && ! grep -qE '^USE_NPM=' "$ENV_FILE" 2>/dev/null; then
      echo "USE_NPM=1" >> "$ENV_FILE"
      echo "  + wrote USE_NPM=1 to $ENV_FILE"
    fi
    if [[ -f "$ENV_FILE" ]] && ! grep -qE '^EDGE_PROXY=' "$ENV_FILE" 2>/dev/null; then
      echo "EDGE_PROXY=npm" >> "$ENV_FILE"
      echo "  + wrote EDGE_PROXY=npm to $ENV_FILE"
    fi
  fi
}

echo "=============================================="
echo " PoreiaGo — full VM deploy"
echo " Repo: $REPO_ROOT"
echo "=============================================="

cd "$REPO_ROOT"

if [[ -d .git ]]; then
  echo "==> git sync (origin/main)"
  git fetch origin main
  # VM may have old hand-edits in deploy/*.yml — reset to repo; secrets stay in .env.prod (gitignored)
  git reset --hard origin/main
  git clean -fd \
    -e deploy/.env.prod \
    -e 'deploy/.env.prod.*' \
    -e deploy/.vapid_private.pem \
    -e deploy/.vapid_public.key \
    -e 'deploy/.vapid_*.pem' \
    -e deploy/docker-compose.npm-ports.yml || true
fi

# After git sync so docker-compose.npm.yml from origin/main is present.
configure_compose_for_edge
echo "==> Edge proxy: $EDGE_PROXY"

bash "$DEPLOY_DIR/scripts/ensure-env-prod.sh"

# P0: nightly local Postgres dump (idempotent crontab)
if [[ "${INSTALL_POSTGRES_BACKUP_CRON:-1}" == "1" ]]; then
  bash "$DEPLOY_DIR/scripts/install-postgres-backup-cron.sh" || \
    echo "WARN: postgres backup cron install skipped"
fi

export API_IMAGE
if ! grep -q "^API_IMAGE=" "$ENV_FILE" 2>/dev/null; then
  echo "API_IMAGE=$API_IMAGE" >> "$ENV_FILE"
else
  sed -i.bak "s|^API_IMAGE=.*|API_IMAGE=$API_IMAGE|" "$ENV_FILE"
fi

echo "==> Frontend build"
if [[ ! -d node_modules ]] || [[ package-lock.json -nt node_modules ]]; then
  npm ci
fi
PLATFORM_DOMAIN="${PLATFORM_DOMAIN:-poreiago.com}"
INGRESS_CNAME="${INGRESS_CNAME:-www.poreiago.com}"
GOOGLE_CLIENT_ID_VAL=""
if [[ -f "$ENV_FILE" ]]; then
  if grep -q "^OLYMPUS_BASE_DOMAIN=" "$ENV_FILE" 2>/dev/null; then
    PLATFORM_DOMAIN="$(grep "^OLYMPUS_BASE_DOMAIN=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r')"
  fi
  if grep -q "^OLYMPUS_INGRESS_CNAME=" "$ENV_FILE" 2>/dev/null; then
    INGRESS_CNAME="$(grep "^OLYMPUS_INGRESS_CNAME=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r')"
  fi
  # My Wallet Google Sign-In — bake client id into Vite (runtime API config is primary).
  if grep -q "^GOOGLE_CLIENT_ID=.\+" "$ENV_FILE" 2>/dev/null; then
    GOOGLE_CLIENT_ID_VAL="$(grep "^GOOGLE_CLIENT_ID=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r')"
  elif grep -q "^VITE_GOOGLE_CLIENT_ID=.\+" "$ENV_FILE" 2>/dev/null; then
    GOOGLE_CLIENT_ID_VAL="$(grep "^VITE_GOOGLE_CLIENT_ID=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r')"
  fi
fi
if [[ -n "$GOOGLE_CLIENT_ID_VAL" ]]; then
  echo "  Google Sign-In: client id present (frontend build + API)"
else
  echo "  Google Sign-In: not configured (set GOOGLE_CLIENT_ID in $ENV_FILE — see deploy/GOOGLE-SIGNIN.md)"
fi
# Empty VITE_API_BASE → browser uses same-origin www + nginx /api proxy (avoids flaky api.* Traefik).
VITE_API_BASE="${VITE_API_BASE:-}" \
VITE_OLYMPUS_BASE_DOMAIN="$PLATFORM_DOMAIN" \
VITE_OLYMPUS_INGRESS_CNAME="$INGRESS_CNAME" \
VITE_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID_VAL" \
npm run build

echo "==> Ensure Achillio Travel SPA shell (static SERP title)"
ensure_achillio_spa_shell

echo "==> API Docker image"
docker build -t "$API_IMAGE" "$REPO_ROOT/backend"

# P0: refuse deploy when production secrets are weak (uses built image + .env.prod)
if [[ "${RUN_PREDEPLOY_CHECK:-1}" == "1" ]]; then
  echo "==> Predeploy production guard"
  if ! docker run --rm --env-file "$ENV_FILE" --entrypoint python "$API_IMAGE" -c \
    "from app.core.production_guard import assert_production_safe_or_raise, collect_production_boot_warnings; assert_production_safe_or_raise();
[print('WARN:', w) for w in collect_production_boot_warnings()]; print('production_guard OK')"; then
    echo "ERROR: production_guard refused deploy — fix secrets in $ENV_FILE"
    exit 1
  fi
fi

echo "==> Docker Compose up (edge=$EDGE_PROXY)"
cd "$DEPLOY_DIR"
# Show the host Traefik/NPM will match — empty API_HOST previously broke public routing.
API_HOST_VAL="$(grep -E '^API_HOST=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"
echo "  API_HOST=${API_HOST_VAL:-<unset>}"
echo "  APP_HOST=$(grep -E '^APP_HOST=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"

if [[ "$EDGE_PROXY" == "npm" ]]; then
  echo "==> NPM edge — skip Traefik (ports 80/443 owned by Nginx Proxy Manager)"
  echo "  Publish API :${NPM_API_PORT}  frontend :${NPM_APP_PORT} (see docker-compose.npm.yml)"
  $COMPOSE --profile bundled-db stop traefik 2>/dev/null || true
  docker rm -f aerostride-prod-traefik-1 2>/dev/null || true
else
  echo "==> Pull Traefik (Docker 29 compat)"
  docker pull traefik:v3.6.6
fi

$COMPOSE --profile bundled-db up -d postgres redis
# Parallel GitHub deploys can leave rename-orphan containers that block recreate.
echo "==> Clearing stale api-blue rename orphans (if any)"
docker ps -a --format '{{.ID}} {{.Names}}' | awk '/aerostride-prod-api-blue/ {print $1}' | while read -r cid; do
  # Keep the currently compose-managed container; remove rename leftovers (*_aerostride-prod-api-blue-1).
  name="$(docker inspect -f '{{.Name}}' "$cid" 2>/dev/null | sed "s#^/##")"
  case "$name" in
    aerostride-prod-api-blue-1) ;;
    *aerostride-prod-api-blue*)
      echo "  removing orphan $name"
      docker rm -f "$cid" >/dev/null 2>&1 || true
      ;;
  esac
done
$COMPOSE --profile bundled-db up -d --force-recreate --no-deps api-blue
# Ensure API is on the edge network Traefik uses (recreate can drop attachments).
API_CID="$($COMPOSE ps -q api-blue)"
if [[ -n "$API_CID" ]]; then
  docker network connect aerostride-prod_edge "$API_CID" 2>/dev/null || true
  echo "  api-blue networks:"
  docker inspect "$API_CID" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
fi

# Contabo must allow outbound IMAP/SMTP so office mailboxes can sync.
if [[ -f "$REPO_ROOT/deploy/scripts/ensure-mail-egress.sh" ]]; then
  echo "==> Ensure outbound mail ports (993/465/587)"
  bash "$REPO_ROOT/deploy/scripts/ensure-mail-egress.sh" \
    || echo "  WARN: mail egress probe failed — Contabo panel / hosting whitelist may still block"
fi
# Sync host VAPID keys into the durable api_data volume (env often pointed here without a copy).
if [[ -n "$API_CID" && -f "$DEPLOY_DIR/.vapid_private.pem" && -f "$DEPLOY_DIR/.vapid_public.key" ]]; then
  echo "==> Syncing Web Push VAPID keys into api-blue:/app/data"
  docker cp "$DEPLOY_DIR/.vapid_private.pem" "$API_CID:/app/data/vapid_private.pem" || true
  docker cp "$DEPLOY_DIR/.vapid_public.key" "$API_CID:/app/data/vapid_public.key" || true
  docker exec "$API_CID" chmod 600 /app/data/vapid_private.pem 2>/dev/null || true
fi
# Fiscal MARK pipeline — worker + beat (stuck recovery / auto-retry).
echo "==> Starting Celery worker + beat"
$COMPOSE --profile bundled-db up -d --force-recreate --no-deps worker celery-beat

FE_CID=""
if [[ "$EDGE_PROXY" == "npm" ]]; then
  # Prefer existing host frontend on NPM_APP_PORT (e.g. poreiago-frontend); refresh dist into it.
  if host_port_in_use "$NPM_APP_PORT"; then
    echo "==> Port ${NPM_APP_PORT} already in use — keep existing frontend"
    FE_CID="$(docker ps --filter "publish=${NPM_APP_PORT}" --format '{{.ID}}' | head -1 || true)"
    if [[ -n "$FE_CID" ]]; then
      echo "  frontend container: $(docker inspect -f '{{.Name}}' "$FE_CID" | sed 's#^/##')"
      refresh_external_frontend_dist "$FE_CID"
      repair_external_frontend_nginx "$FE_CID"
    fi
  else
    echo "==> Starting compose frontend on :${NPM_APP_PORT}"
    $COMPOSE --profile bundled-db up -d --force-recreate --no-deps frontend
    FE_CID="$($COMPOSE ps -q frontend)"
  fi
else
  # Recreate Traefik so docker provider reloads API router labels cleanly.
  $COMPOSE --profile bundled-db up -d --force-recreate --no-deps traefik
  # Recreate frontend so nginx picks up same-origin /api + /ws proxy config.
  $COMPOSE --profile bundled-db up -d --force-recreate --no-deps frontend
  FE_CID="$($COMPOSE ps -q frontend)"
fi
# Frontend + API must share the edge network — otherwise /api → Failed to fetch (drivers list).
if [[ -n "${FE_CID:-}" ]]; then
  docker network connect aerostride-prod_edge "$FE_CID" 2>/dev/null || true
fi

echo "==> DB migrations (alembic → hybrid flights/meta, trip_coordinates / PostGIS GPS)"
# Entrypoint also runs this on uvicorn start; explicit step makes deploy logs clear.
# Applies through head (009 hybrid flights + 010 hybrid_trip_meta / nullable seats).
$COMPOSE exec -T api-blue alembic upgrade head \
  || echo "WARNING: alembic upgrade failed — will retry ensure on API lifespan"

echo "==> Ensure Achillio Travel office + Rent modules (Achillio off / PoreiaGo on)"
$COMPOSE exec -T api-blue python - <<'PY' \
  || echo "WARNING: office policy sync failed (API lifespan will retry)"
from app.core.database import AsyncSessionLocal
from app.services.tenant_modules import (
    ensure_achillio_travel_office,
    ensure_known_office_rent_modules,
)
import asyncio

async def main():
    async with AsyncSessionLocal() as session:
        print("achillio:", await ensure_achillio_travel_office(session))
        print("rent:", await ensure_known_office_rent_modules(session))

asyncio.run(main())
PY

echo "==> Waiting for API health"
api_ok=0
www_ok=0
APP_ORIGIN_HEALTH="${APP_ORIGIN:-https://www.poreiago.com}"
for i in $(seq 1 40); do
  # NPM: localhost publish port is the source of truth (NPM terminates TLS).
  if [[ "$EDGE_PROXY" == "npm" ]] \
    && curl -sf "http://127.0.0.1:${NPM_API_PORT}/health" >/dev/null 2>&1; then
    echo "  API healthy on localhost:${NPM_API_PORT} (NPM upstream)"
    api_ok=1
    break
  fi
  # Prefer same-origin www /health (nginx → api-blue). Fall back to api.* host.
  if curl -sf "$APP_ORIGIN_HEALTH/health" >/dev/null 2>&1; then
    echo "  API healthy via www (nginx → api-blue)"
    api_ok=1
    www_ok=1
    break
  fi
  if curl -sf "$API_BASE/health" >/dev/null 2>&1; then
    echo "  API healthy via api.* (www proxy still catching up… try $i)"
    api_ok=1
    if [[ "$EDGE_PROXY" == "npm" ]]; then
      break
    fi
  elif $COMPOSE exec -T api-blue python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" >/dev/null 2>&1; then
    echo "  API process up (edge proxy catching up… try $i)"
  else
    echo "  waiting for api-blue… try $i"
  fi
  sleep 3
done

# After API is up, prove the path offices use (www/nginx → api-blue). Reload nginx if stale.
# Skip deep nginx→api checks for external NPM frontends that only serve static dist/.
if [[ -n "${FE_CID:-}" && "$EDGE_PROXY" != "npm" ]]; then
  echo "==> Verify www nginx → api-blue (/health)"
  if docker exec "$FE_CID" wget -qO- --timeout=5 http://127.0.0.1/health >/dev/null 2>&1; then
    echo "  frontend /health → api-blue OK"
    www_ok=1
  else
    echo "  WARNING: frontend /health proxy failed — reconnect + nginx reload"
    docker network connect aerostride-prod_edge "${API_CID:-}" 2>/dev/null || true
    docker network connect aerostride-prod_edge "$FE_CID" 2>/dev/null || true
    docker exec "$FE_CID" nginx -s reload 2>/dev/null || true
    sleep 2
    if docker exec "$FE_CID" wget -qO- --timeout=5 http://127.0.0.1/health >/dev/null 2>&1; then
      echo "  frontend /health → api-blue OK after reload"
      www_ok=1
    else
      echo "  WARNING: frontend /health still failing — recreating frontend"
      $COMPOSE --profile bundled-db up -d --force-recreate --no-deps frontend
      FE_CID="$($COMPOSE ps -q frontend)"
      sleep 2
      docker exec "$FE_CID" wget -qO- --timeout=5 http://127.0.0.1/health >/dev/null 2>&1 \
        && echo "  frontend /health OK after recreate" \
        || echo "  ERROR: frontend /health still down"
    fi
  fi
elif [[ "$EDGE_PROXY" == "npm" ]]; then
  if curl -sfI "http://127.0.0.1:${NPM_APP_PORT}/" >/dev/null 2>&1; then
    echo "  frontend :${NPM_APP_PORT} → OK"
    www_ok=1
  else
    echo "  WARNING: frontend :${NPM_APP_PORT} not responding (NPM may still route via cached container)"
  fi
fi

if [[ "$api_ok" -ne 1 ]]; then
  echo "ERROR: Public API health failed for $APP_ORIGIN_HEALTH/health and $API_BASE/health"
  if [[ "$EDGE_PROXY" == "npm" ]]; then
    echo "  also checked http://127.0.0.1:${NPM_API_PORT}/health"
  fi
  echo "==> api-blue labels"
  docker inspect "$($COMPOSE ps -q api-blue)" --format '{{json .Config.Labels}}' 2>/dev/null | python3 -m json.tool || true
  echo "==> compose ps"
  $COMPOSE ps || true
  echo "==> api-blue logs"
  $COMPOSE logs api-blue --tail 80 || true
  if [[ "$EDGE_PROXY" != "npm" ]]; then
    echo "==> traefik logs"
    $COMPOSE logs traefik --tail 80 || true
    echo "==> frontend logs"
    $COMPOSE logs frontend --tail 40 || true
  fi
  exit 1
fi

echo "==> Ensure Achilleas home driver on PoreiaGo platform"
$COMPOSE exec -T api-blue python - <<'PY' \
  || echo "WARNING: Achilleas home ensure failed (API lifespan will retry)"
import asyncio
from travel_platform.settings.drivers_store import repair_poreiago_home_drivers

async def main():
    result = await repair_poreiago_home_drivers()
    print(result)

asyncio.run(main())
PY

echo "==> Custom domain / edge check"
if [[ "$EDGE_PROXY" == "npm" ]]; then
  echo "  NPM owns TLS — check proxy hosts in NPM UI (api→:${NPM_API_PORT}, www+achillio→:${NPM_APP_PORT})"
  curl -sI "http://127.0.0.1:${NPM_APP_PORT}/" 2>/dev/null | head -5 || true
  curl -s "http://127.0.0.1:${NPM_API_PORT}/health" 2>/dev/null | head -c 200 || true
  echo
  # Same-origin /api must return JSON — otherwise Achillio/PoreiaGo admin login 405s.
  if [[ -n "${FE_CID:-}" ]]; then
    if docker exec "$FE_CID" wget -qO- --timeout=5 http://127.0.0.1/health 2>/dev/null | grep -q '"status"'; then
      echo "  frontend /health → api-blue OK"
    else
      echo "  WARNING: frontend /health not proxying — re-running nginx repair"
      repair_external_frontend_nginx "$FE_CID"
    fi
  fi
else
  $COMPOSE logs traefik --tail 120 2>/dev/null | grep -iE 'acme|achillio|error|certificate' || true
  curl -skI -H 'Host: www.achilliotravel.com' https://127.0.0.1/ 2>/dev/null | head -8 || true
  docker inspect "$($COMPOSE ps -q frontend)" --format '{{index .Config.Labels "traefik.http.routers.app.rule"}}' 2>/dev/null || true
fi

if [[ "${RUN_SEED:-0}" == "1" ]]; then
  echo "==> Seeding demo admin (RUN_SEED=1)"
  $COMPOSE exec -T api-blue python -m scripts.seed_saas_dev || true
fi

echo "==> Live fleet diagnose"
bash "$DEPLOY_DIR/scripts/diagnose-live-fleet.sh" || true

echo "==> TLS / admin smoke"
for host in www.poreiago.com www.achilliotravel.com; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "https://${host}/admin" || echo "fail")
  echo "  https://${host}/admin → ${code}"
  echo | openssl s_client -connect "${host}:443" -servername "${host}" 2>/dev/null \
    | openssl x509 -noout -subject -issuer 2>/dev/null | sed "s/^/  /" || true
done

echo "==> Achillio SERP title (static HTML — Googlebot)"
ACH_HDR=$(mktemp)
ACH_HTML=$(curl -sS -A 'Googlebot' -D "$ACH_HDR" --max-time 15 "https://www.achilliotravel.com/" || true)
ACH_TITLE=$(printf '%s' "$ACH_HTML" | tr '\n' ' ' | sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/p' || true)
ACH_DESC=$(printf '%s' "$ACH_HTML" | tr '\n' ' ' | sed -n 's/.*name="description" content="\([^"]*\)".*/\1/p' || true)
echo "  www.achilliotravel.com <title> → ${ACH_TITLE:-<empty>}"
echo "  www.achilliotravel.com description → ${ACH_DESC:0:80}"
if grep -qi 'X-Office-SEO' "$ACH_HDR" 2>/dev/null; then
  echo "  OK: seo-shell header X-Office-SEO present"
else
  echo "  WARN: X-Office-SEO missing — homepage may still be static index"
fi
rm -f "$ACH_HDR"
if echo "$ACH_TITLE" | grep -qi 'achillio'; then
  echo "  OK: Achillio Travel static title"
elif echo "$ACH_TITLE" | grep -qi 'poreiago'; then
  echo "  ERROR: Achillio still serves PoreiaGo in <title> — check seo-shell / index.html"
  exit 1
else
  echo "  ERROR: unexpected Achillio title (${ACH_TITLE:-empty})"
  exit 1
fi
if echo "$ACH_DESC" | grep -qi 'poreiago'; then
  echo "  ERROR: Achillio meta description still mentions PoreiaGo"
  exit 1
fi
if echo "$ACH_HTML" | grep -qi 'application/ld+json'; then
  echo "  OK: JSON-LD present"
fi

echo "==> PoreiaGo SERP title (static HTML — Googlebot)"
PG_TITLE=$(curl -sS -A 'Googlebot' --max-time 15 "https://www.poreiago.com/" \
  | tr '\n' ' ' | sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/p' || true)
echo "  www.poreiago.com <title> → ${PG_TITLE:-<empty>}"
if echo "$PG_TITLE" | grep -qi 'poreiago'; then
  echo "  OK: PoreiaGo marketing static title"
else
  echo "  WARN: poreiago.com title is not PoreiaGo (Host/XFH routing may be missing)"
  # Probe with explicit forwarded host via localhost frontend if available.
  if curl -sS --max-time 5 -H 'Host: www.poreiago.com' -H 'X-Forwarded-Host: www.poreiago.com' \
      "http://127.0.0.1:${NPM_APP_PORT:-8003}/" 2>/dev/null \
      | tr '\n' ' ' | grep -qi 'PoreiaGo'; then
    echo "  OK: localhost + X-Forwarded-Host serves PoreiaGo (NPM Host rewrite issue)"
  fi
fi

echo ""
echo "=============================================="
echo " DONE"
echo "  Edge:         $EDGE_PROXY"
echo "  Back Office:  $APP_ORIGIN/admin/login"
echo "  Driver PWA:   $APP_ORIGIN/driver"
echo "  API docs:     $API_BASE/docs"
if [[ "$EDGE_PROXY" == "npm" ]]; then
  echo "  Local API:    http://127.0.0.1:${NPM_API_PORT}/health"
  echo "  Local app:    http://127.0.0.1:${NPM_APP_PORT}/"
fi
echo ""
echo " Driver push: enable on phone → /driver → Αρχική → Ενεργοποίηση push"
echo " Admin push:   Back Office → Ζωντανός Χάρτης → Ενεργοποίηση push"
echo " Notify driver: Dashboard → Master QR → Push οδηγού"
echo "=============================================="
