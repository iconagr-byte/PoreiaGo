#!/usr/bin/env bash
# Bootstrap GCP staging (cloud-native). Run in Google Cloud Shell.
#   chmod +x deploy/gcp/setup-infrastructure.sh
#   export GCP_PROJECT_ID=your-project-id
#   ./deploy/gcp/setup-infrastructure.sh

set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-europe-west3}"
SERVICE="${GCP_SERVICE:-booking-travel-api}"
AR_REPO="${GCP_AR_REPO:-booking-travel}"
DB_INSTANCE="${GCP_DB_INSTANCE:-booking-travel-db}"
DB_NAME="${GCP_DB_NAME:-aerostride}"
DB_USER="${GCP_DB_USER:-app_user}"
VPC_NETWORK="${GCP_VPC_NETWORK:-booking-travel-vpc}"
VPC_CONNECTOR="${GCP_VPC_CONNECTOR:-booking-travel-connector}"
REDIS_INSTANCE="${GCP_REDIS_INSTANCE:-booking-travel-redis}"

echo "==> Project: $GCP_PROJECT_ID | Region: $REGION"

gcloud config set project "$GCP_PROJECT_ID"

echo "==> Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  vpcaccess.googleapis.com \
  secretmanager.googleapis.com \
  servicenetworking.googleapis.com \
  compute.googleapis.com

echo "==> Artifact Registry..."
if ! gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" &>/dev/null; then
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Booking Travel containers"
fi

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

echo "==> VPC + Serverless connector (for Memorystore)..."
if ! gcloud compute networks describe "$VPC_NETWORK" &>/dev/null; then
  gcloud compute networks create "$VPC_NETWORK" --subnet-mode=auto
fi

if ! gcloud compute networks vpc-access connectors describe "$VPC_CONNECTOR" --region="$REGION" &>/dev/null; then
  gcloud compute networks vpc-access connectors create "$VPC_CONNECTOR" \
    --region="$REGION" \
    --network="$VPC_NETWORK" \
    --range=10.8.0.0/28 \
    --min-instances=2 \
    --max-instances=3
fi

echo "==> Cloud SQL PostgreSQL 15..."
if ! gcloud sql instances describe "$DB_INSTANCE" &>/dev/null; then
  DB_PASSWORD="$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)"
  gcloud sql instances create "$DB_INSTANCE" \
    --database-version=POSTGRES_15 \
    --tier=db-custom-1-3840 \
    --region="$REGION" \
    --storage-auto-increase \
    --root-password="$DB_PASSWORD"
  echo "SAVE root password: $DB_PASSWORD"
  gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE"
  APP_DB_PASSWORD="$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)"
  gcloud sql users create "$DB_USER" --instance="$DB_INSTANCE" --password="$APP_DB_PASSWORD"
  echo "SAVE app user password ($DB_USER): $APP_DB_PASSWORD"
  echo "Enable PostGIS after first connect: CREATE EXTENSION IF NOT EXISTS postgis;"
fi

CONN_NAME="$GCP_PROJECT_ID:$REGION:$DB_INSTANCE"
echo "Cloud SQL connection name: $CONN_NAME"

echo "==> Memorystore Redis..."
if ! gcloud redis instances describe "$REDIS_INSTANCE" --region="$REGION" &>/dev/null; then
  gcloud redis instances create "$REDIS_INSTANCE" \
    --size=1 \
    --region="$REGION" \
    --network="$VPC_NETWORK" \
    --redis-version=redis_7_0 \
    --tier=basic
fi

REDIS_HOST="$(gcloud redis instances describe "$REDIS_INSTANCE" --region="$REGION" --format='value(host)')"
REDIS_PORT="$(gcloud redis instances describe "$REDIS_INSTANCE" --region="$REGION" --format='value(port)')"
echo "Redis: redis://$REDIS_HOST:$REDIS_PORT/0"

echo "==> Cloud Build permissions..."
PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')"
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/run.admin" --quiet || true
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/iam.serviceAccountUser" --quiet || true

echo ""
echo "=== Done. Next steps ==="
echo "1. Store secrets in Secret Manager (AUTH_JWT_SECRET, DATABASE_URL, REDIS_URL, ...)"
echo "2. Deploy API:"
echo "   gcloud builds submit --config=deploy/gcp/cloudbuild.yaml \\"
echo "     --substitutions=_REGION=$REGION,_SERVICE=$SERVICE,_AR_REPO=$AR_REPO,_CLOUDSQL_INSTANCE=$CONN_NAME,_VPC_CONNECTOR=projects/$GCP_PROJECT_ID/locations/$REGION/connectors/$VPC_CONNECTOR"
echo "3. Map custom domain on Cloud Run (api.*) or use default *.run.app URL for first test"
echo "4. Build frontend: VITE_API_BASE=https://YOUR_API_URL npm run build"
echo "5. Firebase Hosting: firebase deploy --config deploy/gcp/firebase.json"
echo "6. Driver PWA test: https://YOUR_APP_URL/driver"
