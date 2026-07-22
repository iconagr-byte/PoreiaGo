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
set_kv "BILLING_SUCCESS_URL" "https://${APP_HOST_DEFAULT}/admin?billing=success"
set_kv "BILLING_CANCEL_URL" "https://${APP_HOST_DEFAULT}/admin?billing=cancel"
set_kv "BILLING_SIGNUP_SUCCESS_URL" "https://${APP_HOST_DEFAULT}/grafeia/signup/success?billing=success"
set_kv "BILLING_SIGNUP_CANCEL_URL" "https://${APP_HOST_DEFAULT}/grafeia/signup?billing=cancel"
# Demo office signup without real Stripe charge (set to 0 when going live with Stripe).
set_kv "BILLING_DEMO_MODE" "true"

PLATFORM_DOMAIN="${PLATFORM_DOMAIN:-poreiago.com}"
if grep -q "^APP_HOST=" "$ENV_FILE" 2>/dev/null; then
  _app_host="$(grep "^APP_HOST=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r')"
  _app_host="${_app_host#https://}"
  _app_host="${_app_host#http://}"
  _app_host="${_app_host%%/*}"
  if [[ -n "$_app_host" ]]; then
    PLATFORM_DOMAIN="${_app_host#www.}"
    INGRESS_CNAME="${_app_host}"
  fi
fi
INGRESS_CNAME="${INGRESS_CNAME:-www.poreiago.com}"
replace_kv "OLYMPUS_BASE_DOMAIN" "$PLATFORM_DOMAIN"
replace_kv "OLYMPUS_INGRESS_CNAME" "$INGRESS_CNAME"
replace_kv "VITE_OLYMPUS_BASE_DOMAIN" "$PLATFORM_DOMAIN"
replace_kv "VITE_OLYMPUS_INGRESS_CNAME" "$INGRESS_CNAME"

if ! [[ -f "$DEPLOY_DIR/.vapid_private.pem" ]]; then
  echo "==> Generating Web Push VAPID keys"
  REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
  # Docker may have created a directory here if the compose bind-mount was missing a file.
  if [[ -d "$DEPLOY_DIR/.vapid_private.pem" ]]; then
    echo "  removing ghost directory deploy/.vapid_private.pem"
    rm -rf "$DEPLOY_DIR/.vapid_private.pem"
  fi
  if ! python3 -c "from cryptography.hazmat.primitives.asymmetric import ec" 2>/dev/null; then
    pip3 install --user cryptography >/dev/null 2>&1 || true
  fi
  python3 "$REPO_ROOT/deploy/scripts/generate_vapid_keys.py" || {
    echo "WARN: host VAPID generation failed — API will auto-generate into /app/data on startup"
  }
fi

if [[ -f "$DEPLOY_DIR/.vapid_private.pem" ]]; then
  set_kv "WEB_PUSH_VAPID_PRIVATE_KEY_FILE" "/app/data/vapid_private.pem"
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

# Traefik static YAML does not expand ${ACME_EMAIL:-...} — bake a real address.
ACME_EMAIL_VALUE="$ACME_EMAIL_DEFAULT"
if grep -q "^ACME_EMAIL=" "$ENV_FILE" 2>/dev/null; then
  ACME_EMAIL_VALUE="$(grep "^ACME_EMAIL=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r')"
fi
if [[ -f "$DEPLOY_DIR/traefik/traefik.yml" ]]; then
  echo "==> Baking ACME email into Traefik config ($ACME_EMAIL_VALUE)"
  sed -i.bak -E "s|email: \".*\"|email: \"${ACME_EMAIL_VALUE}\"|" \
    "$DEPLOY_DIR/traefik/traefik.yml"
fi

for f in olympus-on-demand-tls.yml tenants.example.yml; do
  if [[ -f "$DEPLOY_DIR/traefik/dynamic/$f" ]]; then
    mv "$DEPLOY_DIR/traefik/dynamic/$f" "$DEPLOY_DIR/traefik/dynamic/${f}.disabled"
    echo "  disabled traefik/dynamic/$f"
  fi
done

# Keep custom-domains.yml active (tenant Host → frontend + Let's Encrypt).
replace_kv "TRAEFIK_DYNAMIC_DIR" "/etc/traefik/dynamic"

echo "==> .env.prod ready"
