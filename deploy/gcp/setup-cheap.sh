#!/usr/bin/env bash
# Cheap GCP bootstrap — NO Memorystore, NO VPC connector (~7-12 EUR/mo SQL only at start)
# Run in Cloud Shell AFTER: billing enabled, poreiago.com purchased
#
#   export GCP_PROJECT_ID=your-project-id
#   chmod +x deploy/gcp/setup-cheap.sh
#   ./deploy/gcp/setup-cheap.sh

set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-europe-west3}"
AR_REPO="${GCP_AR_REPO:-poreiago}"
DB_INSTANCE="${GCP_DB_INSTANCE:-poreiago-db}"
DB_NAME="${GCP_DB_NAME:-poreiago}"
DB_USER="${GCP_DB_USER:-app_user}"

echo "==> Project: $GCP_PROJECT_ID | Region: $REGION"
gcloud config set project "$GCP_PROJECT_ID"

echo "==> Enabling APIs (no charge)..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  firebase.googleapis.com

echo "==> Artifact Registry (~0 EUR until you store images)..."
if ! gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" &>/dev/null; then
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="poreiago containers"
fi
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

echo "==> Cloud SQL db-f1-micro (~7-12 EUR/month)..."
if ! gcloud sql instances describe "$DB_INSTANCE" &>/dev/null; then
  DB_ROOT_PASS="$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 20)"
  gcloud sql instances create "$DB_INSTANCE" \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region="$REGION" \
    --storage-size=10GB \
    --storage-auto-increase \
    --root-password="$DB_ROOT_PASS"
  echo ""
  echo ">>> SAVE root password: $DB_ROOT_PASS"
  gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE"
  APP_DB_PASS="$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 20)"
  gcloud sql users create "$DB_USER" --instance="$DB_INSTANCE" --password="$APP_DB_PASS"
  echo ">>> SAVE app password ($DB_USER): $APP_DB_PASS"
fi

CONN_NAME="$GCP_PROJECT_ID:$REGION:$DB_INSTANCE"
echo "Cloud SQL connection: $CONN_NAME"

echo "==> Billing budget reminder..."
echo "Set alert: Console → Billing → Budgets → e.g. 30 EUR/month"

echo ""
echo "=== DONE (cheap infra) ==="
echo "Monthly cost so far: ~7-12 EUR (Cloud SQL db-f1-micro only)"
echo ""
echo "NEXT STEPS — see deploy/gcp/STEP-BY-STEP.md"
echo "  1. Upstash free Redis → REDIS_URL secret"
echo "  2. JWT secrets in Secret Manager"
echo "  3. Connect GitHub → Cloud Build trigger (cloudbuild.cheap.yaml)"
echo "  4. Firebase Hosting → www.poreiago.com"
echo "  5. Cloud Run domain → api.poreiago.com"
echo ""
echo "Cloud SQL connection for later:"
echo "  _CLOUDSQL_INSTANCE=$CONN_NAME"
