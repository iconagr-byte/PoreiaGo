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
COMPOSE="docker compose --env-file $ENV_FILE -f $DEPLOY_DIR/docker-compose.prod.yml"
API_IMAGE="${API_IMAGE:-poreiago-api:latest}"

# Serialize deploys on the VM (GitHub cancel-in-progress still leaves racing SSH sessions).
DEPLOY_LOCK="${DEPLOY_LOCK:-/tmp/poreiago-vm-deploy.lock}"
exec 200>"$DEPLOY_LOCK"
echo "==> Waiting for deploy lock ($DEPLOY_LOCK)…"
if ! flock -w 2400 200; then
  echo "ERROR: timed out waiting for another deploy to finish ($DEPLOY_LOCK)"
  exit 1
fi
echo "==> Deploy lock acquired"

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
    -e 'deploy/.vapid_*.pem' || true
fi

bash "$DEPLOY_DIR/scripts/ensure-env-prod.sh"

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
if [[ -f "$ENV_FILE" ]]; then
  if grep -q "^OLYMPUS_BASE_DOMAIN=" "$ENV_FILE" 2>/dev/null; then
    PLATFORM_DOMAIN="$(grep "^OLYMPUS_BASE_DOMAIN=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r')"
  fi
  if grep -q "^OLYMPUS_INGRESS_CNAME=" "$ENV_FILE" 2>/dev/null; then
    INGRESS_CNAME="$(grep "^OLYMPUS_INGRESS_CNAME=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r')"
  fi
fi
# Empty VITE_API_BASE → browser uses same-origin www + nginx /api proxy (avoids flaky api.* Traefik).
VITE_API_BASE="${VITE_API_BASE:-}" \
VITE_OLYMPUS_BASE_DOMAIN="$PLATFORM_DOMAIN" \
VITE_OLYMPUS_INGRESS_CNAME="$INGRESS_CNAME" \
npm run build

echo "==> API Docker image"
docker build -t "$API_IMAGE" "$REPO_ROOT/backend"

echo "==> Pull Traefik (Docker 29 compat)"
docker pull traefik:v3.6.6

echo "==> Docker Compose up (recreate API + bounce Traefik routing)"
cd "$DEPLOY_DIR"
# Show the host Traefik will match — empty API_HOST previously broke public routing.
API_HOST_VAL="$(grep -E '^API_HOST=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"
echo "  API_HOST=${API_HOST_VAL:-<unset>}"
echo "  APP_HOST=$(grep -E '^APP_HOST=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"

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
# Recreate Traefik so docker provider reloads API router labels cleanly.
$COMPOSE --profile bundled-db up -d --force-recreate --no-deps traefik
# Recreate frontend so nginx picks up same-origin /api + /ws proxy config.
$COMPOSE --profile bundled-db up -d --force-recreate --no-deps frontend

echo "==> DB migrations (alembic → trip_coordinates / PostGIS GPS)"
# Entrypoint also runs this on uvicorn start; explicit step makes deploy logs clear.
$COMPOSE exec -T api-blue alembic upgrade head \
  || echo "WARNING: alembic upgrade failed — will retry ensure on API lifespan"

echo "==> Waiting for API health"
api_ok=0
APP_ORIGIN_HEALTH="${APP_ORIGIN:-https://www.poreiago.com}"
for i in $(seq 1 40); do
  # Prefer same-origin www /health (nginx → api-blue). Fall back to api.* host.
  if curl -sf "$APP_ORIGIN_HEALTH/health" >/dev/null 2>&1 || curl -sf "$API_BASE/health" >/dev/null 2>&1; then
    echo "  API healthy (public)"
    api_ok=1
    break
  fi
  if $COMPOSE exec -T api-blue python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" >/dev/null 2>&1; then
    echo "  API process up (Traefik/nginx catching up… try $i)"
  else
    echo "  waiting for api-blue… try $i"
  fi
  sleep 3
done

if [[ "$api_ok" -ne 1 ]]; then
  echo "ERROR: Public API health failed for $APP_ORIGIN_HEALTH/health and $API_BASE/health"
  echo "==> api-blue labels"
  docker inspect "$($COMPOSE ps -q api-blue)" --format '{{json .Config.Labels}}' 2>/dev/null | python3 -m json.tool || true
  echo "==> compose ps"
  $COMPOSE ps || true
  echo "==> api-blue logs"
  $COMPOSE logs api-blue --tail 80 || true
  echo "==> traefik logs"
  $COMPOSE logs traefik --tail 80 || true
  echo "==> frontend logs"
  $COMPOSE logs frontend --tail 40 || true
  exit 1
fi

echo "==> Custom domain / ACME check"
$COMPOSE logs traefik --tail 120 2>/dev/null | grep -iE 'acme|achillio|error|certificate' || true
curl -skI -H 'Host: www.achilliotravel.com' https://127.0.0.1/ 2>/dev/null | head -8 || true
docker inspect "$($COMPOSE ps -q frontend)" --format '{{index .Config.Labels "traefik.http.routers.app.rule"}}' 2>/dev/null || true

if [[ "${RUN_SEED:-0}" == "1" ]]; then
  echo "==> Seeding demo admin (RUN_SEED=1)"
  $COMPOSE exec -T api-blue python -m scripts.seed_saas_dev || true
fi

echo ""
echo "=============================================="
echo " DONE"
echo "  Back Office:  $APP_ORIGIN/admin/login"
echo "  Driver PWA:   $APP_ORIGIN/driver"
echo "  API docs:     $API_BASE/docs"
echo ""
echo " Driver push: enable on phone → /driver → Αρχική → Ενεργοποίηση push"
echo " Admin push:   Back Office → Ζωντανός Χάρτης → Ενεργοποίηση push"
echo " Notify driver: Dashboard → Master QR → Push οδηγού"
echo "=============================================="
