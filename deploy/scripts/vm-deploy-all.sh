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
VITE_API_BASE="$API_BASE" npm run build

echo "==> API Docker image"
docker build -t "$API_IMAGE" "$REPO_ROOT/backend"

echo "==> Pull Traefik (Docker 29 compat)"
docker pull traefik:v3.6.6

echo "==> Docker Compose up"
cd "$DEPLOY_DIR"
$COMPOSE --profile bundled-db up -d traefik api-blue frontend postgres redis

echo "==> Waiting for API health"
for i in $(seq 1 30); do
  if curl -sf "$API_BASE/health" >/dev/null 2>&1; then
    echo "  API healthy"
    break
  fi
  sleep 2
  if [[ "$i" -eq 30 ]]; then
    echo "WARN: API health check timeout — see: $COMPOSE logs api-blue --tail 40"
  fi
done

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
