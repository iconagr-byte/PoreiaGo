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

echo "==> Ensure Rent modules (Achillio off / PoreiaGo platform on — never global wipe)"
$COMPOSE exec -T api-blue python - <<'PY' \
  || echo "WARNING: rent module policy sync failed (API lifespan will retry)"
from app.core.database import AsyncSessionLocal
from app.services.tenant_modules import ensure_known_office_rent_modules
import asyncio

async def main():
    async with AsyncSessionLocal() as session:
        result = await ensure_known_office_rent_modules(session)
        print(result)

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
  echo "  NPM owns TLS — check proxy hosts in NPM UI (api→:${NPM_API_PORT}, www→:${NPM_APP_PORT})"
  curl -sI "http://127.0.0.1:${NPM_APP_PORT}/" 2>/dev/null | head -5 || true
  curl -s "http://127.0.0.1:${NPM_API_PORT}/health" 2>/dev/null | head -c 200 || true
  echo
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
