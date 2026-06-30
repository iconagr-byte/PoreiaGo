# PoreiaGo — ξεχωριστό project (GNPC CLOUD μένει ανέγγιχτο)

## Αρχιτεκτονική

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│  GNPC CLOUD (παλιό)         │     │  poreiago-prod (ΝΕΟ)        │
│  ─────────────────          │     │  ─────────────────          │
│  • poreiago.com domain      │     │  • Cloud Run (API)          │
│  • Cloud DNS zone           │     │  • Cloud SQL                │
│  • (τίποτα άλλο δεν        │     │  • Firebase Hosting         │
│     αλλάζουμε εδώ)          │     │  • GitHub → Cloud Build     │
└──────────────┬──────────────┘     └──────────────▲──────────────┘
               │  DNS A records μόνο:              │
               │  api.poreiago.com ────────────────┘
               │  www.poreiago.com ────────────────┘
               └────────────────────────────────────
```

**GNPC CLOUD:** Δεν διαγράφουμε, δεν αλλάζουμε services, δεν τρέχουμε scripts εκεί.  
**Μόνη επαφή:** 2–3 **DNS records** στο Cloud DNS (προσθήκη, όχι αλλαγή υπαρχόντων).

---

## Βήμα 1 — Νέο project (Cloud Shell)

**Τρέξε ΜΟΝΟ αυτό** — δεν αγγίζει το GNPC CLOUD:

```bash
export GCP_PROJECT_ID=poreiago-prod
export GCP_BILLING_ACCOUNT=01B9AA-66831C-77EEC1

gcloud projects create $GCP_PROJECT_ID --name="PoreiaGo" 2>/dev/null || echo "exists OK"

gcloud billing projects link $GCP_PROJECT_ID --billing-account=$GCP_BILLING_ACCOUNT

gcloud config set project $GCP_PROJECT_ID

gcloud services enable \
  run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com sqladmin.googleapis.com \
  secretmanager.googleapis.com firebase.googleapis.com

gcloud artifacts repositories create poreiago \
  --repository-format=docker --location=europe-west3 \
  --description="PoreiaGo" 2>/dev/null || true

gcloud auth configure-docker europe-west3-docker.pkg.dev --quiet

echo "✅ PoreiaGo project ready: $GCP_PROJECT_ID"
echo "GNPC CLOUD was NOT modified."
```

Αν `poreiago-prod` πιασμένο:
```bash
export GCP_PROJECT_ID=poreiago-gnpc-2026
```

---

## Βήμα 2 — Budget ΜΟΝΟ στο νέο project

1. **Billing** → **Budgets & alerts** → Create budget
2. **Projects:** μόνο **poreiago-prod** (όχι GNPC CLOUD)
3. Amount: **30 EUR**

---

## Βήμα 3 — Όλα τα επόμενα βήματα ΜΟΝΟ στο poreiago-prod

Πριν κάθε εντολή στο Cloud Shell:

```bash
gcloud config set project poreiago-prod
```

Ή επίλεξε **PoreiaGo** από το dropdown project πάνω αριστερά στο Console.

| Βήμα | Πού τρέχει |
|------|------------|
| Cloud SQL | poreiago-prod |
| Cloud Run | poreiago-prod |
| Firebase | poreiago-prod |
| GitHub trigger | poreiago-prod |
| Domain registration | **GNPC CLOUD** (ήδη εκεί — δεν το μετακινούμε) |
| DNS A records | **GNPC CLOUD** → Cloud DNS (μόνο πρόσθεση) |

---

## DNS — η μόνη αλλαγή στο GNPC CLOUD

Μόνο **προσθήκη** records (όχι διαγραφή τίποτα):

| Name | Type | Value |
|------|------|-------|
| `api` | A | IP από Cloud Run (**poreiago-prod**) |
| `www` | A | IP από Firebase (**poreiago-prod**) |

Console: με project **GNPC CLOUD** → **Cloud DNS** → zone `poreiago.com` → **Add record set**.

---

## Τι ΔΕΝ κάνουμε στο GNPC CLOUD

- ❌ Δεν τρέχουμε `setup-infrastructure.sh`
- ❌ Δεν δημιουργούμε Cloud SQL / Redis / Cloud Run εκεί
- ❌ Δεν αλλάζουμε budget του GNPC CLOUD
- ❌ Δεν μεταφέρουμε το domain (μένει registered εκεί)

---

## Επόμενο

Μετά τη δημιουργία project → **setup-cheap.sh** (μόνο στο poreiago-prod):

```bash
gcloud config set project poreiago-prod
export GCP_PROJECT_ID=poreiago-prod
# clone repo + ./deploy/gcp/setup-cheap.sh
```

Οδηγός: [STEP-BY-STEP.md](./STEP-BY-STEP.md)
