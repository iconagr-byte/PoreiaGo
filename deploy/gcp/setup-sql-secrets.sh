#!/usr/bin/env bash
# Cloud SQL + secrets + Cloud Run wiring for poreiago
# Run once in Cloud Shell: bash deploy/gcp/setup-sql-secrets.sh

set -euo pipefail

GCP_PROJECT_ID="${GCP_PROJECT_ID:-poreiago}"
REGION="${GCP_REGION:-europe-west3}"
DB_INSTANCE="${GCP_DB_INSTANCE:-poreiago-db}"
DB_NAME="${GCP_DB_NAME:-poreiago}"
DB_USER="${GCP_DB_USER:-app_user}"
SERVICE="${GCP_SERVICE:-poreiago-api}"

gcloud config set project "$GCP_PROJECT_ID"

echo "==> APIs..."
gcloud services enable sqladmin.googleapis.com secretmanager.googleapis.com run.googleapis.com

CONN_NAME="${GCP_PROJECT_ID}:${REGION}:${DB_INSTANCE}"

echo "==> Cloud SQL db-f1-micro (~7-12 EUR/month)..."
if ! gcloud sql instances describe "$DB_INSTANCE" &>/dev/null; then
  DB_ROOT_PASS="$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 20)"
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
  APP_DB_PASS="$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 20)"
  gcloud sql users create "$DB_USER" --instance="$DB_INSTANCE" --password="$APP_DB_PASS"
  echo ">>> SAVE app password ($DB_USER): $APP_DB_PASS"
else
  echo "Instance $DB_INSTANCE already exists."
  read -r -p "Enter existing app_user password (or Enter to skip DATABASE_URL secret): " APP_DB_PASS
fi

echo "==> JWT secrets..."
create_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "$name" &>/dev/null; then
    echo "Secret $name exists — skip"
  else
    echo -n "$value" | gcloud secrets create "$name" --data-file=-
    echo "Created secret $name"
  fi
}

create_secret AUTH_JWT_SECRET "$(openssl rand -base64 32)"
create_secret TICKET_JWT_SECRET "$(openssl rand -base64 32)"
create_secret MASTER_QR_SECRET "$(openssl rand -base64 32)"

if [ -n "${APP_DB_PASS:-}" ]; then
  DB_URL="postgresql+asyncpg://${DB_USER}:${APP_DB_PASS}@/${DB_NAME}?host=/cloudsql/${CONN_NAME}"
  if gcloud secrets describe DATABASE_URL &>/dev/null; then
    echo -n "$DB_URL" | gcloud secrets versions add DATABASE_URL --data-file=-
    echo "Updated DATABASE_URL secret"
  else
    echo -n "$DB_URL" | gcloud secrets create DATABASE_URL --data-file=-
    echo "Created DATABASE_URL secret"
  fi
else
  echo "Skipped DATABASE_URL — set manually later"
fi

echo "==> IAM for Cloud Run + secrets..."
PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')"
RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for ROLE in roles/cloudsql.client roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:${RUN_SA}" \
    --role="$ROLE" \
    --condition=None \
    --quiet
done

echo "==> Cloud Run: attach SQL + secrets..."
SECRETS="DATABASE_URL=DATABASE_URL:latest,AUTH_JWT_SECRET=AUTH_JWT_SECRET:latest,TICKET_JWT_SECRET=TICKET_JWT_SECRET:latest,MASTER_QR_SECRET=MASTER_QR_SECRET:latest"

gcloud run services update "$SERVICE" \
  --region="$REGION" \
  --add-cloudsql-instances="$CONN_NAME" \
  --set-secrets="$SECRETS" \
  --update-env-vars="ENVIRONMENT=staging,PUBLIC_APP_URL=https://www.poreiago.com,OLYMPUS_BASE_DOMAIN=poreiago.com"

echo ""
echo "=== DONE ==="
echo "Cloud SQL: $CONN_NAME"
echo "Update trigger substitution: _CLOUDSQL_INSTANCE=$CONN_NAME"
echo "Test: curl \$(gcloud run services describe $SERVICE --region=$REGION --format='value(status.url)')/health"
echo ""
echo "Optional next: Upstash free Redis -> REDIS_URL secret"
