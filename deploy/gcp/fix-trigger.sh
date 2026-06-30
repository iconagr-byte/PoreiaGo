# Cloud Build trigger fix (run in Cloud Shell)

PROJECT_ID=poreiago
TRIGGER_NAME=deploy-main
REGION=europe-west3

gcloud config set project "$PROJECT_ID"

# Point trigger at the correct GitHub repo + build file
gcloud builds triggers update "$TRIGGER_NAME" \
  --region="$REGION" \
  --repo-name=PoreiaGo \
  --repo-owner=iconagr-byte \
  --build-config=cloudbuild.yaml \
  --substitutions=_REGION=europe-west3,_SERVICE=poreiago-api,_AR_REPO=poreiago,_CLOUDSQL_INSTANCE=poreiago:europe-west3:poreiago-db,_VITE_API_BASE=https://api.poreiago.com,_DEPLOY_FRONTEND=false

# Run build now (optional)
gcloud builds triggers run "$TRIGGER_NAME" --region="$REGION" --branch=main
