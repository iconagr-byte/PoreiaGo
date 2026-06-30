#!/usr/bin/env bash
# Create Cloud Build triggers after linking GitHub in Console.
# Prerequisites:
#   1. GitHub repo pushed (main branch)
#   2. Cloud Console → Cloud Build → Repositories → Connect GitHub
#   3. Run setup-infrastructure.sh once
#
# Usage:
#   export GCP_PROJECT_ID=my-project
#   export GITHUB_OWNER=myuser
#   export GITHUB_REPO=booking-travel
#   export VITE_API_BASE=https://api.yourdomain.gr
#   export CLOUDSQL_INSTANCE=my-project:europe-west3:booking-travel-db
#   ./deploy/gcp/setup-cicd-triggers.sh

set -euo pipefail

: "${GCP_PROJECT_ID:?}"
: "${GITHUB_OWNER:?}"
: "${GITHUB_REPO:?}"
: "${VITE_API_BASE:?}"
REGION="${GCP_REGION:-europe-west3}"
SERVICE="${GCP_SERVICE:-booking-travel-api}"
CONN_NAME="${CLOUDSQL_INSTANCE:-}"
VPC_CONNECTOR="${VPC_CONNECTOR:-projects/${GCP_PROJECT_ID}/locations/${REGION}/connectors/booking-travel-connector}"
CONNECTION_NAME="${CLOUD_BUILD_CONNECTION:-github}"
REPO_RESOURCE="${CONNECTION_NAME}/${GITHUB_REPO}"

gcloud config set project "$GCP_PROJECT_ID"

SUBS="_REGION=${REGION},_SERVICE=${SERVICE},_AR_REPO=booking-travel"
SUBS="${SUBS},_CLOUDSQL_INSTANCE=${CONN_NAME},_VPC_CONNECTOR=${VPC_CONNECTOR}"
SUBS="${SUBS},_VITE_API_BASE=${VITE_API_BASE},_DEPLOY_FRONTEND=true"

echo "==> Full deploy trigger (push main → API + frontend)"
gcloud builds triggers create github \
  --name="deploy-main-full" \
  --region="$REGION" \
  --repository="projects/${GCP_PROJECT_ID}/locations/${REGION}/connections/${CONNECTION_NAME}/repositories/${GITHUB_REPO}" \
  --branch-pattern="^main$" \
  --build-config="deploy/gcp/cloudbuild.yaml" \
  --substitutions="$SUBS" \
  2>/dev/null || echo "Trigger deploy-main-full may already exist — update in Console"

echo ""
echo "=== Optional: split triggers (faster on single-layer changes) ==="
echo "Create manually in Console with included files:"
echo "  backend/**     → deploy/gcp/cloudbuild.api.yaml"
echo "  src/**,public/** → deploy/gcp/cloudbuild.frontend.yaml"
echo ""
echo "=== FIREBASE_TOKEN secret (once) ==="
echo "  firebase login:ci"
echo "  echo -n 'TOKEN' | gcloud secrets create FIREBASE_TOKEN --data-file=-"
echo "  Grant Cloud Build SA access to secret (Secret Manager Secret Accessor)"

PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')"
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
gcloud secrets add-iam-policy-binding FIREBASE_TOKEN \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  2>/dev/null || echo "Create FIREBASE_TOKEN secret first, then re-run IAM binding"

echo ""
echo "Done. Push to main on GitHub → Cloud Build runs automatically."
