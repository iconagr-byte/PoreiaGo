# GitHub → Google Cloud — αυτόματο deploy

Κάθε **push στο `main`** στο GitHub → **Cloud Build** → **Cloud Run** (API) + **Firebase** (frontend).

---

## Ροή

```
git push origin main
       ↓
GitHub webhook
       ↓
Cloud Build (deploy/gcp/cloudbuild.yaml)
       ↓
├── tests (backend)
├── Docker build → Artifact Registry
├── Cloud Run deploy (API + WebSocket)
└── npm build → Firebase Hosting (app + /driver PWA)
```

---

## Βήμα 1 — Ανέβασε το project στο GitHub

Στον υπολογιστή σου (PowerShell):

```powershell
cd "c:\Booking Travel"
git init
git add .
git commit -m "Initial commit — Booking Travel"
git branch -M main
git remote add origin https://github.com/ΟΧΗΜΑΤΑΣΟΥ/booking-travel.git
git push -u origin main
```

Δημιούργησε πρώτα **κενό repo** στο GitHub (χωρίς README αν έχεις ήδη κώδικα).

**Μην ανεβάσεις secrets:** `.env`, `.env.local`, passwords — είναι ήδη στο `.gitignore`.

---

## Βήμα 2 — Σύνδεση GitHub με Google Cloud

1. [Cloud Console](https://console.cloud.google.com) → **Cloud Build** → **Repositories**
2. **Create host connection** → **GitHub**
3. Επίλεξε **Region:** `europe-west3`
4. **Authenticate** με GitHub → επέτρεψε πρόσβαση στο org/account σου
5. **Link repository** → διάλεξε το `booking-travel` repo

---

## Βήμα 3 — Υποδομή (μία φορά)

Στο **Cloud Shell**:

```bash
git clone https://github.com/ΟΧΗΜΑΤΑΣΟΥ/booking-travel.git
cd booking-travel
export GCP_PROJECT_ID=το-project-id-σου
./deploy/gcp/setup-infrastructure.sh
```

---

## Βήμα 4 — Firebase token (για auto-deploy frontend)

Τοπικά (μία φορά):

```bash
npm install -g firebase-tools
firebase login:ci
```

Αντίγραψε το token. Στο Cloud Shell:

```bash
echo -n "1//xxxx-firebase-token" | gcloud secrets create FIREBASE_TOKEN --data-file=-

PROJECT_NUMBER=$(gcloud projects describe $GCP_PROJECT_ID --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding FIREBASE_TOKEN \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Στο **Firebase Console** → πρόσθεσε το ίδιο GCP project → ενεργοποίησε **Hosting**.

---

## Βήμα 5 — Δημιουργία Trigger

### Μέσω Console (εύκολο)

1. **Cloud Build** → **Triggers** → **Create trigger**
2. **Name:** `deploy-main`
3. **Event:** Push to a branch
4. **Source:** το συνδεδεμένο GitHub repo
5. **Branch:** `^main$`
6. **Configuration:** Cloud Build configuration file  
   **Location:** `deploy/gcp/cloudbuild.yaml`
7. **Substitution variables** (προσθήκη):

| Variable | Value |
|----------|--------|
| `_REGION` | `europe-west3` |
| `_SERVICE` | `booking-travel-api` |
| `_AR_REPO` | `booking-travel` |
| `_CLOUDSQL_INSTANCE` | `PROJECT:europe-west3:booking-travel-db` |
| `_VPC_CONNECTOR` | `projects/PROJECT/locations/europe-west3/connectors/booking-travel-connector` |
| `_VITE_API_BASE` | `https://api.poreiago.com` |
| `_DEPLOY_FRONTEND` | `true` |

8. **Create**

### Μέσω script

```bash
export GCP_PROJECT_ID=...
export GITHUB_OWNER=...
export GITHUB_REPO=booking-travel
export VITE_API_BASE=https://api.yourdomain.gr
export CLOUDSQL_INSTANCE=$GCP_PROJECT_ID:europe-west3:booking-travel-db
chmod +x deploy/gcp/setup-cicd-triggers.sh
./deploy/gcp/setup-cicd-triggers.sh
```

---

## Βήμα 6 — Δοκιμή

```bash
git commit --allow-empty -m "test: trigger Cloud Build"
git push origin main
```

Παρακολούθηση: **Cloud Build** → **History** (2–5 λεπτά για πρώτο build).

Μετά:
- `https://api.yourdomain.gr/health`
- `https://app.yourdomain.gr/driver`

---

## Προαιρετικά — ξεχωριστά triggers (πιο γρήγορα)

| Trigger | Included files | Config |
|---------|----------------|--------|
| API only | `backend/**` | `deploy/gcp/cloudbuild.api.yaml` |
| Frontend only | `src/**`, `public/**`, `index.html` | `deploy/gcp/cloudbuild.frontend.yaml` |

Το **πλήρες** `cloudbuild.yaml` τρέχει και τα δύο σε κάθε push — απλούστερο για αρχή.

---

## GitHub Actions

Το `.github/workflows/production.yml` τρέχει **μόνο tests** σε push/PR.  
Το **deploy** γίνεται από **Cloud Build** (όχι SSH στο VPS).

---

## Troubleshooting

| Πρόβλημα | Λύση |
|----------|------|
| Trigger δεν τρέχει | Έλεγξε branch `main`, GitHub connection, webhook στο repo Settings |
| `FIREBASE_TOKEN` missing | Βήμα 4 |
| `_VITE_API_BASE` empty | Πρόσθεσε substitution στο trigger |
| Cloud Run deploy fails | `_CLOUDSQL_INSTANCE`, `_VPC_CONNECTOR` σωστά; infrastructure script |
| Permission denied | Cloud Build SA χρειάζεται `run.admin`, `secretmanager.secretAccessor` |

---

## Καθημερινή δουλειά

```bash
git add .
git commit -m "feat: ..."
git push origin main
# → αυτόματα deploy σε ~3–8 λεπτά
```
