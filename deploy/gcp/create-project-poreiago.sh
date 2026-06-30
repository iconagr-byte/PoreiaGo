#!/usr/bin/env bash
# Create ISOLATED PoreiaGo project — does NOT modify GNPC CLOUD
# Run ONLY in Cloud Shell. See deploy/gcp/SEPARATE-FROM-GNPC.md

set -euo pipefail

# --- Config (edit if needed) ---
PROJECT_ID="${GCP_PROJECT_ID:-poreiago-prod}"
PROJECT_NAME="${GCP_PROJECT_NAME:-PoreiaGo}"
REGION="${GCP_REGION:-europe-west3}"
# From Billing → Account management (your screenshot)
BILLING_ACCOUNT="${GCP_BILLING_ACCOUNT:-01B9AA-66831C-77EEC1}"

echo "==> Creating project: $PROJECT_ID ($PROJECT_NAME)"

if gcloud projects describe "$PROJECT_ID" &>/dev/null; then
  echo "Project $PROJECT_ID already exists — skipping create."
else
  gcloud projects create "$PROJECT_ID" --name="$PROJECT_NAME"
  echo "Created project $PROJECT_ID"
fi

echo "==> Linking billing account $BILLING_ACCOUNT ..."
gcloud billing projects link "$PROJECT_ID" \
  --billing-account="$BILLING_ACCOUNT"

gcloud config set project "$PROJECT_ID"

echo "==> Enabling APIs (no charge until you use services)..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  firebase.googleapis.com \
  dns.googleapis.com \
  domains.googleapis.com

echo "==> Artifact Registry..."
if ! gcloud artifacts repositories describe poreiago --location="$REGION" &>/dev/null; then
  gcloud artifacts repositories create poreiago \
    --repository-format=docker \
    --location="$REGION" \
    --description="PoreiaGo containers"
fi
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

echo ""
echo "============================================"
echo "  PoreiaGo project READY"
echo "============================================"
echo "  Project ID:     $PROJECT_ID"
echo "  Region:         $REGION"
echo "  Billing:        $BILLING_ACCOUNT"
echo ""
echo "  Console URL:"
echo "  https://console.cloud.google.com/home/dashboard?project=$PROJECT_ID"
echo ""
echo "  GNPC CLOUD was NOT modified."
echo "  Domain poreiago.com stays in old project — DNS records only."
echo ""
echo "  See: deploy/gcp/SEPARATE-FROM-GNPC.md"
echo ""
echo "  NEXT: ./deploy/gcp/setup-cheap.sh"
echo "        (export GCP_PROJECT_ID=$PROJECT_ID first)"
echo "============================================"
