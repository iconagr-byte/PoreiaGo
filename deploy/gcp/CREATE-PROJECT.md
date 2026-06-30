# Δημιουργία project PoreiaGo — copy-paste στο Cloud Shell

Αν το `poreiago-prod` είναι πιασμένο globally, άλλαξε σε `poreiago-app-2026` κλπ.

---

## Τρόπος Α — Script (1 λεπτό)

1. [Cloud Console](https://console.cloud.google.com) → **Cloud Shell** (`>_`)
2. Ανέβασε repo ή τρέξε:

```bash
# Αν έχεις repo στο GitHub:
git clone https://github.com/USER/booking-travel.git
cd booking-travel
chmod +x deploy/gcp/create-project-poreiago.sh
./deploy/gcp/create-project-poreiago.sh
```

**Ή copy-paste απευθείας:**

```bash
export GCP_PROJECT_ID=poreiago-prod
export GCP_BILLING_ACCOUNT=01B9AA-66831C-77EEC1

gcloud projects create $GCP_PROJECT_ID --name="PoreiaGo" 2>/dev/null || echo "exists"
gcloud billing projects link $GCP_PROJECT_ID --billing-account=$GCP_BILLING_ACCOUNT
gcloud config set project $GCP_PROJECT_ID

gcloud services enable \
  run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com sqladmin.googleapis.com \
  secretmanager.googleapis.com firebase.googleapis.com \
  dns.googleapis.com domains.googleapis.com

gcloud artifacts repositories create poreiago \
  --repository-format=docker --location=europe-west3 \
  --description="PoreiaGo" 2>/dev/null || true

gcloud auth configure-docker europe-west3-docker.pkg.dev --quiet

echo "DONE: https://console.cloud.google.com/home/dashboard?project=$GCP_PROJECT_ID"
```

---

## Τρόπος Β — Console (χειροκίνητα)

1. [Resource Manager](https://console.cloud.google.com/cloud-resource-manager) → **Create project**
2. **Project name:** `PoreiaGo`
3. **Project ID:** `poreiago-prod` (ή auto-generated)
4. **Create**
5. **Billing** → Link billing account **My Billing Account**
6. Επίλεξε το νέο project από dropdown πάνω

---

## Domain poreiago.com

Το domain μπορεί να μείνει στο **παλιό project** (GNPC CLOUD).  
Δεν πειράζει — τα **DNS records** στο Cloud DNS δείχνουν στο Cloud Run του **νέου** project.

| Πού | Τι |
|-----|-----|
| Παλιό project | Domain registration + Cloud DNS zone |
| **poreiago-prod** | Cloud Run, SQL, Firebase, GitHub deploy |

---

## Μετά τη δημιουργία

```bash
export GCP_PROJECT_ID=poreiago-prod
./deploy/gcp/setup-cheap.sh
```

Οδηγός: [STEP-BY-STEP.md](./STEP-BY-STEP.md)
