# Booking Travel — GCP Cloud Native (Staging)

Οδηγός για λογαριασμό **Google Cloud Console** — Cloud Run, Cloud SQL, Memorystore, Firebase Hosting.

## Τι θα φτιάξεις

| Υπηρεσία | Ρόλος |
|----------|--------|
| **Cloud Run** | FastAPI + WebSocket (οδηγός GPS, admin map) |
| **Cloud SQL** | PostgreSQL |
| **Memorystore** | Redis (telemetry, sessions) |
| **Artifact Registry** | Docker images |
| **Firebase Hosting** | React/Vite frontend + Driver PWA |
| **Secret Manager** | JWT, DB passwords |

**Region προτεινόμενη:** `europe-west3` (Frankfurt)

**Νέο domain:** δες **[DOMAIN-SETUP.md](./DOMAIN-SETUP.md)** (αγορά `.gr`/`.com`, DNS, `app.*` + `api.*`).

**GitHub → auto deploy:** δες **[CICD-GITHUB.md](./CICD-GITHUB.md)** (push `main` → Cloud Build → Cloud Run + Firebase).

**Domain:** **[domain-poreiago.com.md](./domain-poreiago.com.md)** — `poreiago.com` ✅ Active.

**Φθηνό deploy (~5€/μήνα):** **[../cheap/README.md](../cheap/README.md)** — Hetzner VPS.

**Ξεχωριστό από GNPC CLOUD:** **[SEPARATE-FROM-GNPC.md](./SEPARATE-FROM-GNPC.md)** — νέο project, παλιό ανέγγιχτο.

**Βήμα-βήμα GCP (~10–25€/μήνα):** **[STEP-BY-STEP.md](./STEP-BY-STEP.md)**

---

## Βήμα 1 — Στο Cloud Console (browser)

1. [console.cloud.google.com](https://console.cloud.google.com)
2. **Select project** ή **New Project** (π.χ. `booking-travel-staging`)
3. **Billing** → σύνδεση κάρτας (νέοι λογαριασμοί: $300 credit)
4. Αντιγράψε το **Project ID** (όχι το display name)

---

## Βήμα 2 — Cloud Shell

Πάνω δεξιά στο Console → εικονίδιο **>_** (Cloud Shell).

```bash
# Clone (ή upload zip)
git clone <your-repo-url> booking-travel
cd booking-travel

export GCP_PROJECT_ID=το-project-id-σου
chmod +x deploy/gcp/setup-infrastructure.sh
./deploy/gcp/setup-infrastructure.sh
```

Το script δημιουργεί: VPC, Cloud SQL, Redis, Artifact Registry.

**Σημείωσε** τα passwords που τυπώνει για DB.

---

## Βήμα 3 — Secrets

```bash
# Παράδειγμα — επανάλαβε για κάθε secret
echo -n "your-32-char-jwt-secret-here" | \
  gcloud secrets create AUTH_JWT_SECRET --data-file=-

# DATABASE_URL — δες deploy/gcp/env.staging.example
```

Μετά το πρώτο deploy, σύνδεσε secrets στο Cloud Run:

```bash
gcloud run services update booking-travel-api \
  --region=europe-west3 \
  --set-secrets=AUTH_JWT_SECRET=AUTH_JWT_SECRET:latest,TICKET_JWT_SECRET=TICKET_JWT_SECRET:latest
```

---

## Βήμα 4 — Deploy API

```bash
CONN_NAME="$GCP_PROJECT_ID:europe-west3:booking-travel-db"
CONNECTOR="projects/$GCP_PROJECT_ID/locations/europe-west3/connectors/booking-travel-connector"

gcloud builds submit --config=deploy/gcp/cloudbuild.yaml \
  --substitutions=_REGION=europe-west3,_SERVICE=booking-travel-api,_AR_REPO=booking-travel,_CLOUDSQL_INSTANCE=$CONN_NAME,_VPC_CONNECTOR=$CONNECTOR
```

Πάρε το URL:

```bash
gcloud run services describe booking-travel-api --region=europe-west3 --format='value(status.url)'
```

Δοκίμασε: `curl https://XXXX.run.app/health`

---

## Βήμα 5 — Frontend (Firebase Hosting)

Στο Cloud Shell ή τοπικά (με Node.js):

```bash
npm ci
export VITE_API_BASE=https://api.yourdomain.gr   # μετά το domain setup
npm run build

# Firebase CLI (μία φορά)
npm install -g firebase-tools
firebase login
firebase use --add   # διάλεξε το GCP project

firebase deploy --only hosting --config deploy/gcp/firebase.json
```

Θα πάρεις URL τύπου `https://booking-travel-staging.web.app`.

---

## Βήμα 6 — Δοκιμή Driver PWA

1. Άνοιξε `https://<hosting-url>/driver` στο κινητό
2. Master QR → pre-trip → **αυτόματα GPS tab**
3. «ΕΝΑΡΞΗ ΒΑΡΔΙΑΣ» → έλεγχος admin live map

Για production domain: **[DOMAIN-SETUP.md](./DOMAIN-SETUP.md)** — `app.yourdomain.gr` (Firebase) + `api.yourdomain.gr` (Cloud Run).

---

## Ρύθμιση CORS / env

Στο Cloud Run πρόσθεσε:

```
PUBLIC_APP_URL=https://your-app.web.app
ENVIRONMENT=staging
REDIS_URL=redis://<memorystore-ip>:6379/0
DATABASE_URL=postgresql+asyncpg://...
```

Πλήρη λίστα: `deploy/gcp/env.staging.example`

---

## Κόστος staging (εκτίμηση)

~100–150 €/μήνα (Cloud Run min=1, SQL db-custom-1-3840, Redis 1GB).

Για να μειώσεις κόστος σε δοκιμές: `min-instances=0` (αλλά WebSocket/GPS θα έχουν cold start).

---

## Τι μένει για πλήρες cloud native

- [ ] Uploads → **Cloud Storage** (τώρα local disk)
- [ ] Celery → **Cloud Scheduler + Cloud Run Jobs**
- [ ] Custom tenant domains → **Certificate Manager**
- [ ] Migrations / seed: `python -m scripts.seed_saas_dev` μέσω Cloud Run Job

---

## Troubleshooting

| Πρόβλημα | Λύση |
|----------|------|
| Redis connection refused | Έλεγξε VPC connector στο Cloud Run service |
| DB connection failed | `--add-cloudsql-instances` + σωστό `DATABASE_URL` με `/cloudsql/...` |
| WebSocket κλείνει | `min-instances=1`, `session-affinity`, `timeout=3600` |
| 404 στο /driver | Firebase rewrite → `index.html` (ήδη στο firebase.json) |
