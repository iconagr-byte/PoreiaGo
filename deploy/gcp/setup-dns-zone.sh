#!/usr/bin/env bash
# Create Cloud DNS zone for your new domain (run after purchase).
# Usage:
#   export GCP_PROJECT_ID=my-project
#   export DOMAIN=achillio-travel.gr
#   ./deploy/gcp/setup-dns-zone.sh

set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${DOMAIN:?Set DOMAIN e.g. achillio-travel.gr}"

ZONE_NAME="${DNS_ZONE_NAME:-booking-travel-zone}"

gcloud config set project "$GCP_PROJECT_ID"

if gcloud dns managed-zones describe "$ZONE_NAME" &>/dev/null; then
  echo "Zone $ZONE_NAME already exists."
else
  gcloud dns managed-zones create "$ZONE_NAME" \
    --dns-name="${DOMAIN}." \
    --description="Booking Travel — ${DOMAIN}"
  echo "Created zone: $ZONE_NAME"
fi

echo ""
echo "=== Nameservers — paste these at your registrar (Papaki, Cloudflare, etc.) ==="
gcloud dns managed-zones describe "$ZONE_NAME" --format="value(nameServers)"
echo ""
echo "Next: follow deploy/gcp/DOMAIN-SETUP.md sections 4–5 for api.* and app.* records."
