#!/usr/bin/env bash
# Ensure PoreiaGo platform wildcard DNS so every office subdomain resolves
# without any customer DNS action:
#   *.poreiago.com  A  → Contabo / edge IP
#
# Customers only ever open https://{office-slug}.poreiago.com
# Custom domains remain optional (their registrar → CNAME).
#
# Credentials (any one is enough), loaded from env or deploy/.env.prod:
#   GCP_PROJECT_ID          e.g. gnpc-cloud / the project that owns Cloud DNS
#   GCP_DNS_ZONE            Cloud DNS managed-zone name (e.g. poreiago-com)
#   PLATFORM_DOMAIN         default poreiago.com
#   PLATFORM_WILDCARD_IP    default 169.58.199.186 (Contabo)
#   GOOGLE_APPLICATION_CREDENTIALS  path to SA JSON  OR
#   GCP_SA_JSON             inline service-account JSON (dns.admin)
#
# Safe to re-run. Non-zero only when credentials exist but the upsert fails.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/deploy/.env.prod}"

load_kv() {
  local key="$1"
  if [[ -n "${!key:-}" ]]; then
    printf '%s' "${!key}"
    return 0
  fi
  if [[ -f "$ENV_FILE" ]] && grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//'
    return 0
  fi
  printf ''
}

PLATFORM_DOMAIN="${PLATFORM_DOMAIN:-$(load_kv PLATFORM_DOMAIN)}"
PLATFORM_DOMAIN="${PLATFORM_DOMAIN:-poreiago.com}"
PLATFORM_DOMAIN="${PLATFORM_DOMAIN#www.}"
PLATFORM_WILDCARD_IP="${PLATFORM_WILDCARD_IP:-$(load_kv PLATFORM_WILDCARD_IP)}"
PLATFORM_WILDCARD_IP="${PLATFORM_WILDCARD_IP:-169.58.199.186}"
GCP_PROJECT_ID="${GCP_PROJECT_ID:-$(load_kv GCP_PROJECT_ID)}"
GCP_DNS_ZONE="${GCP_DNS_ZONE:-$(load_kv GCP_DNS_ZONE)}"
GCP_SA_JSON="${GCP_SA_JSON:-$(load_kv GCP_SA_JSON)}"
GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-$(load_kv GOOGLE_APPLICATION_CREDENTIALS)}"

RRSET_NAME="*.${PLATFORM_DOMAIN}."
TTL="${PLATFORM_WILDCARD_TTL:-300}"

echo "==> Platform wildcard DNS"
echo "  domain=${PLATFORM_DOMAIN}  record=${RRSET_NAME}  ip=${PLATFORM_WILDCARD_IP}"

# Already live? (authoritative enough via public resolvers)
LIVE_IP="$(dig +short "@8.8.8.8" "test-wildcard-probe.${PLATFORM_DOMAIN}" A 2>/dev/null | tail -1 || true)"
# dig on a random label exercises the wildcard; empty means missing.
if [[ -z "$LIVE_IP" ]]; then
  LIVE_IP="$(dig +short "@8.8.8.8" "*.${PLATFORM_DOMAIN}" A 2>/dev/null | tail -1 || true)"
fi
# Probe a synthetic label under the platform domain (wildcard answer).
PROBE_HOST="office-dns-probe.${PLATFORM_DOMAIN}"
PROBE_IP="$(dig +short "@8.8.8.8" "$PROBE_HOST" A 2>/dev/null | grep -E '^[0-9.]+$' | head -1 || true)"
if [[ "$PROBE_IP" == "$PLATFORM_WILDCARD_IP" ]]; then
  echo "  OK: wildcard already resolves (${PROBE_HOST} → ${PROBE_IP})"
  exit 0
fi
echo "  probe ${PROBE_HOST} → ${PROBE_IP:-NONE} (want ${PLATFORM_WILDCARD_IP})"

have_creds=0
SA_FILE=""
cleanup() {
  if [[ -n "${SA_FILE}" && -f "${SA_FILE}" && "${SA_FILE}" == /tmp/poreiago-gcp-sa-* ]]; then
    rm -f "$SA_FILE"
  fi
}
trap cleanup EXIT

if [[ -n "$GCP_SA_JSON" ]]; then
  SA_FILE="$(mktemp /tmp/poreiago-gcp-sa-XXXXXX.json)"
  printf '%s' "$GCP_SA_JSON" >"$SA_FILE"
  export GOOGLE_APPLICATION_CREDENTIALS="$SA_FILE"
  have_creds=1
elif [[ -n "${GOOGLE_APPLICATION_CREDENTIALS}" && -f "${GOOGLE_APPLICATION_CREDENTIALS}" ]]; then
  have_creds=1
fi

if [[ "$have_creds" != "1" ]]; then
  cat <<EOF
  SKIP: no GCP DNS credentials on this host.
  PoreiaGo (not the customer) must publish one wildcard A record once:

    Name: *
    Type: A
    TTL:  ${TTL}
    Data: ${PLATFORM_WILDCARD_IP}

  Cloud DNS console (project that owns ${PLATFORM_DOMAIN}):
    https://console.cloud.google.com/net-services/dns/zones

  Or set in deploy/.env.prod (platform secrets, never customer-facing):
    GCP_PROJECT_ID=...
    GCP_DNS_ZONE=...          # managed-zone name
    GCP_SA_JSON={...}         # SA with roles/dns.admin
  Then re-run: bash deploy/scripts/ensure-platform-wildcard-dns.sh
EOF
  exit 0
fi

if [[ -z "$GCP_PROJECT_ID" || -z "$GCP_DNS_ZONE" ]]; then
  echo "ERROR: GCP_PROJECT_ID and GCP_DNS_ZONE required when credentials are set"
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "ERROR: gcloud CLI not installed (needed to upsert wildcard)"
  exit 1
fi

gcloud auth activate-service-account --key-file="$GOOGLE_APPLICATION_CREDENTIALS" --quiet
gcloud config set project "$GCP_PROJECT_ID" --quiet

EXISTING="$(gcloud dns record-sets list --zone="$GCP_DNS_ZONE" --name="$RRSET_NAME" --type=A --format='value(rrdatas[0])' 2>/dev/null || true)"
if [[ "$EXISTING" == "$PLATFORM_WILDCARD_IP" ]]; then
  echo "  OK: Cloud DNS already has ${RRSET_NAME} → ${PLATFORM_WILDCARD_IP}"
  exit 0
fi

echo "  upserting ${RRSET_NAME} A ${PLATFORM_WILDCARD_IP} (was: ${EXISTING:-none})"
TMP_TX="$(mktemp)"
gcloud dns record-sets transaction start --zone="$GCP_DNS_ZONE" --transaction-file="$TMP_TX"
if [[ -n "$EXISTING" ]]; then
  gcloud dns record-sets transaction remove \
    --zone="$GCP_DNS_ZONE" \
    --name="$RRSET_NAME" \
    --type=A \
    --ttl="$TTL" \
    "$EXISTING" \
    --transaction-file="$TMP_TX"
fi
gcloud dns record-sets transaction add \
  --zone="$GCP_DNS_ZONE" \
  --name="$RRSET_NAME" \
  --type=A \
  --ttl="$TTL" \
  "$PLATFORM_WILDCARD_IP" \
  --transaction-file="$TMP_TX"
gcloud dns record-sets transaction execute --zone="$GCP_DNS_ZONE" --transaction-file="$TMP_TX"
rm -f "$TMP_TX"

echo "  OK: wildcard published. New offices resolve as https://{slug}.${PLATFORM_DOMAIN}"
echo "  Tip: NPM needs a proxy host for *.${PLATFORM_DOMAIN} → frontend :8003 + wildcard SSL."
