#!/usr/bin/env bash
# One-time fix for failed Cloud Build deploys on poreiago.
# Paste in Cloud Shell (project poreiago):

set -euo pipefail

GCP_PROJECT_ID="${GCP_PROJECT_ID:-poreiago}"
REGION="${GCP_REGION:-europe-west3}"
AR_REPO="${GCP_AR_REPO:-poreiago}"

gcloud config set project "$GCP_PROJECT_ID"

echo "==> Enable APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com

echo "==> Artifact Registry repo..."
if ! gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" &>/dev/null; then
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="PoreiaGo containers"
fi

echo "==> Cloud Build service account permissions..."
PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')"
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

for ROLE in roles/run.admin roles/iam.serviceAccountUser roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:${CB_SA}" \
    --role="$ROLE" --quiet
done

echo ""
echo "=== DONE ==="
echo "Cloud Build SA: ${CB_SA}"
echo ""
echo "NEXT:"
echo "1. Triggers -> deploy-main -> Edit -> Service account = Default (Cloud Build)"
echo "2. Substitutions: _DEPLOY_FRONTEND=false"
echo "3. RUN trigger again on branch main"
