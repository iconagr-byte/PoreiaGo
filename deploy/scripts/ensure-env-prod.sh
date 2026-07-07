#!/usr/bin/env bash
# Ensure deploy/.env.prod has push + public URL vars (idempotent).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/.env.prod}"
API_HOST_DEFAULT="${API_HOST_DEFAULT:-api.poreiago.com}"
APP_HOST_DEFAULT="${APP_HOST_DEFAULT:-www.poreiago.com}"
ACME_EMAIL_DEFAULT="${ACME_EMAIL_DEFAULT:-iconagr@gmail.com}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Missing $ENV_FILE — copy from .env.prod.example first."
  exit 1
fi

set_kv() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    return 0
  fi
  echo "${key}=${value}" >> "$ENV_FILE"
  echo "  + added ${key}"
}

replace_kv() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

echo "==> Ensuring domain vars in $ENV_FILE"
set_kv "API_HOST" "$API_HOST_DEFAULT"
set_kv "APP_HOST" "$APP_HOST_DEFAULT"
set_kv "ACME_EMAIL" "$ACME_EMAIL_DEFAULT"
set_kv "DRIVER_APP_PUBLIC_URL" "https://${APP_HOST_DEFAULT}"
set_kv "FRONTEND_PUBLIC_URL" "https://${APP_HOST_DEFAULT}"
set_kv "CELERY_BROKER_URL" "redis://redis:6379/0"
set_kv "CELERY_RESULT_BACKEND" "redis://redis:6379/1"

if ! [[ -f "$DEPLOY_DIR/.vapid_private.pem" ]]; then
  echo "==> Generating Web Push VAPID keys"
  REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
  if ! python3 -c "import py_vapid" 2>/dev/null; then
    pip3 install --user py-vapid cryptography >/dev/null 2>&1 || true
  fi
  python3 "$REPO_ROOT/deploy/scripts/generate_vapid_keys.py" || {
    echo "WARN: VAPID generation failed — pip3 install py-vapid cryptography"
  }
fi

if [[ -f "$DEPLOY_DIR/.vapid_private.pem" ]]; then
  set_kv "WEB_PUSH_VAPID_PRIVATE_KEY_FILE" "/run/secrets/vapid_private.pem"
  if [[ -f "$DEPLOY_DIR/.vapid_public.key" ]]; then
    pub="$(tr -d '\n' < "$DEPLOY_DIR/.vapid_public.key")"
    replace_kv "WEB_PUSH_VAPID_PUBLIC_KEY" "$pub"
  fi
  set_kv "WEB_PUSH_VAPID_SUBJECT" "mailto:${ACME_EMAIL_DEFAULT}"
fi

if grep -q "^WEB_PUSH_VAPID_PUBLIC_KEY=.\+" "$ENV_FILE" 2>/dev/null; then
  :
elif [[ -f "$DEPLOY_DIR/.vapid_public.key" ]]; then
  pub="$(tr -d '\n' < "$DEPLOY_DIR/.vapid_public.key")"
  set_kv "WEB_PUSH_VAPID_PUBLIC_KEY" "$pub"
fi

if grep -q 'email: "\${ACME_EMAIL}"' "$DEPLOY_DIR/traefik/traefik.yml" 2>/dev/null; then
  echo "==> Fixing Traefik ACME email"
  sed -i.bak "s|email: \"\${ACME_EMAIL}\"|email: \"${ACME_EMAIL_DEFAULT}\"|" \
    "$DEPLOY_DIR/traefik/traefik.yml"
fi

for f in olympus-on-demand-tls.yml tenants.example.yml; do
  if [[ -f "$DEPLOY_DIR/traefik/dynamic/$f" ]]; then
    mv "$DEPLOY_DIR/traefik/dynamic/$f" "$DEPLOY_DIR/traefik/dynamic/${f}.disabled"
    echo "  disabled traefik/dynamic/$f"
  fi
done

echo "==> .env.prod ready"
