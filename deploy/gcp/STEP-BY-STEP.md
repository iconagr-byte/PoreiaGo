# poreiago.com — Βήμα-βήμα (φθηνό GCP)

Ξεκινάς με **μόνο το domain**. Σε κάθε βήμα βλέπεις **τι κοστίζει**.

> **Στόχος:** ~15–25€/μήνα (+ δωρεάν μήνες με $300 credit)

---

## Επισκόπηση κόστους

| Βήμα | Τι φτιάχνεις | Κόστος/μήνα |
|------|--------------|-------------|
| 0 | GCP project + billing alert | **0€** |
| 1 | APIs + Artifact Registry | **~0€** |
| 2 | Cloud SQL (μικρό) | **~7–12€** |
| 3 | Upstash Redis (free) | **0€** |
| 4 | Secrets (JWT) | **~0€** |
| 5 | Cloud Run (scale-to-zero) | **0–10€** |
| 6 | Firebase Hosting | **0€** |
| 7 | DNS api + www | **~0€** |
| 8 | GitHub auto-deploy | **~0€** |
| | **Σύνολο (εκτίμηση)** | **~10–25€** |

⚠️ **Δεν** ενεργοποιούμε: Memorystore (~30€), μεγάλο SQL (~50€), min-instances=1 (~30€).

---

# Βήμα 0 — Project + billing alert

**Κόστος: 0€**

1. [console.cloud.google.com](https://console.cloud.google.com)
2. Επίλεξε ή δημιούργησε project (π.χ. `poreiago-prod`)
3. **Billing** → σύνδεση κάρτας (νέοι: **$300 credit**)
4. **Billing** → **Budgets & alerts** → Create budget:
   - Amount: **30 EUR**
   - Alert at: 50%, 90%, 100%

📝 Σημείωσε το **Project ID** (όχι το display name).

---

# Βήμα 1 — APIs + Artifact Registry

**Κόστος: ~0€** (χρεώνεται μόνο αν ανεβάσεις πολλά GB images)

### Cloud Shell (`>_` πάνω δεξιά)

```bash
export GCP_PROJECT_ID=το-project-id-σου

git clone https://github.com/ΟΧΗΜΑΣΟΥ/booking-travel.git
cd booking-travel
chmod +x deploy/gcp/setup-cheap.sh
./deploy/gcp/setup-cheap.sh
```

Το script ενεργοποιεί APIs και δημιουργεί **Artifact Registry**.

✅ Έλεγχος κόστους: **Billing** → **Reports** → σήμερα πρέπει να είναι ~0€.

---

# Βήμα 2 — Cloud SQL (μικρή βάση)

**Κόστος: ~7–12€/μήνα** ← **πρώτο πραγματικό κόστος**

Το `setup-cheap.sh` το δημιουργεί αυτόματα:
- Instance: `poreiago-db`
- Tier: **db-f1-micro** (το φθηνότερο)
- Region: `europe-west3`

**Σημείωσε** τα passwords που τυπώνει στο terminal.

✅ Έλεγχος: Console → **SQL** → `poreiago-db` → Running  
✅ Billing → Reports → θα δεις ~**$8–10/month** projected για SQL.

---

# Βήμα 3 — Redis (δωρεάν — Upstash)

**Κόστος: 0€**

Δεν χρησιμοποιούμε Google Memorystore (~30€). Χρησιμοποιούμε **Upstash**:

1. [console.upstash.com](https://console.upstash.com) → Sign up (free)
2. **Create database** → Region **EU-West-1** (κοντά Frankfurt)
3. Αντίγραψε το **Redis URL** (μορφή `rediss://default:xxx@xxx.upstash.io:6379`)

Αποθήκευση στο Google Secret Manager:

```bash
echo -n "rediss://default:PASSWORD@HOST:6379" | \
  gcloud secrets create REDIS_URL --data-file=-

echo -n "rediss://default:PASSWORD@HOST:6379" | \
  gcloud secrets create CELERY_BROKER_URL --data-file=-
```

(Ή ίδιο URL και στα δύο για staging.)

✅ Κόστος Upstash free: 10K commands/day — αρκετό για δοκιμές.

---

# Βήμα 4 — Secrets (JWT)

**Κόστος: ~0€**

```bash
# Δημιούργησε τυχαία secrets (32+ chars)
echo -n "$(openssl rand -base64 32)" | gcloud secrets create AUTH_JWT_SECRET --data-file=-
echo -n "$(openssl rand -base64 32)" | gcloud secrets create TICKET_JWT_SECRET --data-file=-
echo -n "$(openssl rand -base64 32)" | gcloud secrets create MASTER_QR_SECRET --data-file=-
```

DATABASE_URL (αντικατέστησε PASS και PROJECT):

```bash
echo -n "postgresql+asyncpg://app_user:APP_PASS@/poreiago?host=/cloudsql/PROJECT:europe-west3:poreiago-db" | \
  gcloud secrets create DATABASE_URL --data-file=-
```

---

# Βήμα 5 — Deploy API (Cloud Run)

**Κόστος: 0–10€/μήνα** (scale-to-zero — πληρώνεις όταν τρέχει)

```bash
CONN_NAME="$GCP_PROJECT_ID:europe-west3:poreiago-db"

gcloud builds submit --config=deploy/gcp/cloudbuild.cheap.yaml \
  --substitutions=_REGION=europe-west3,_SERVICE=poreiago-api,_AR_REPO=poreiago,_CLOUDSQL_INSTANCE=$CONN_NAME,_VITE_API_BASE=https://api.poreiago.com
```

Μετά σύνδεσε secrets στο Cloud Run:

```bash
gcloud run services update poreiago-api \
  --region=europe-west3 \
  --add-cloudsql-instances=$CONN_NAME \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest,AUTH_JWT_SECRET=AUTH_JWT_SECRET:latest,TICKET_JWT_SECRET=TICKET_JWT_SECRET:latest,MASTER_QR_SECRET=MASTER_QR_SECRET:latest" \
  --update-env-vars="PUBLIC_APP_URL=https://www.poreiago.com,OLYMPUS_BASE_DOMAIN=poreiago.com,ENVIRONMENT=staging"
```

Δοκιμή (προσωρινό URL):

```bash
gcloud run services describe poreiago-api --region=europe-west3 --format='value(status.url)'
curl $(gcloud run services describe poreiago-api --region=europe-west3 --format='value(status.url)')/health
```

✅ Billing: Cloud Run με **min-instances=0** → σχεδόν 0€ αν δεν το χρησιμοποιείς.

---

# Βήμα 6 — Firebase Hosting (frontend)

**Κόστος: 0€** (free tier)

1. [Firebase Console](https://console.firebase.google.com) → **Add project** → διάλεξε **το ίδιο GCP project**
2. **Build** → **Hosting** → Get started
3. Τοπικά ή Cloud Shell:

```bash
npm install -g firebase-tools
firebase login
firebase use --add   # διάλεξε project

npm ci
export VITE_API_BASE=https://api.poreiago.com
npm run build
firebase deploy --only hosting --config deploy/gcp/firebase.json
```

Θα πάρεις URL: `https://poreiago-prod.web.app` (προσωρινό).

Για **auto-deploy** μετά (Βήμα 8):

```bash
firebase login:ci
echo -n "TOKEN" | gcloud secrets create FIREBASE_TOKEN --data-file=-

PROJECT_NUMBER=$(gcloud projects describe $GCP_PROJECT_ID --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding FIREBASE_TOKEN \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

# Βήμα 7 — Domain DNS (poreiago.com)

**Κόστος: ~0€** (domain ήδη πληρωμένο ~12€/έτος)

### 7α. API → `api.poreiago.com`

1. **Cloud Run** → `poreiago-api` → **Manage custom domains**
2. Add mapping: `api.poreiago.com`
3. **Cloud DNS** → zone `poreiago.com` → πρόσθεσε **A records** (IPs από Cloud Run)

### 7β. Frontend → `www.poreiago.com`

1. **Firebase** → Hosting → **Add custom domain** → `www.poreiago.com`
2. **Cloud DNS** → πρόσθεσε **TXT** + **A** (από Firebase)
3. Πρόσθεσε `poreiago.com` → redirect → `www`

Δοκιμές (μετά 15–60 λεπτά SSL):

```
https://api.poreiago.com/health
https://www.poreiago.com/driver
```

---

# Βήμα 8 — GitHub auto-deploy

**Κόστος: ~0€** (Cloud Build: 120 free min/day)

1. Ανέβασε κώδικα στο GitHub (`main`)
2. **Cloud Build** → **Repositories** → Connect GitHub
3. **Triggers** → Create:
   - Branch: `^main$`
   - Config: `deploy/gcp/cloudbuild.cheap.yaml`
   - Substitutions:

| Name | Value |
|------|--------|
| `_REGION` | `europe-west3` |
| `_SERVICE` | `poreiago-api` |
| `_AR_REPO` | `poreiago` |
| `_CLOUDSQL_INSTANCE` | `PROJECT:europe-west3:poreiago-db` |
| `_VITE_API_BASE` | `https://api.poreiago.com` |

4. `git push` → δες **Cloud Build → History**

---

# Παρακολούθηση κόστους (κάθε βήμα)

**Billing** → **Reports** → Group by **Service**

| Service | Τι περιμένεις |
|---------|---------------|
| Cloud SQL | ~7–12€ (σταθερό) |
| Cloud Run | 0–10€ (ανά χρήση) |
| Cloud Build | 0€ (συνήθως μέσα στο free) |
| Cloud Domains | ~1€/μήνα (domain) |
| Memorystore | **0€** — δεν το φτιάξαμε ✅ |

**Billing** → **Budget alerts** → email όταν πλησιάζεις 30€.

---

# Checklist

- [ ] Βήμα 0: Project + budget alert
- [ ] Βήμα 1: `setup-cheap.sh`
- [ ] Βήμα 2: SQL passwords saved
- [ ] Βήμα 3: Upstash REDIS_URL secret
- [ ] Βήμα 4: JWT secrets
- [ ] Βήμα 5: Cloud Run `/health` OK
- [ ] Βήμα 6: Firebase deploy
- [ ] Βήμα 7: api + www DNS
- [ ] Βήμα 8: GitHub trigger
- [ ] Δοκιμή `/driver` στο κινητό

---

# Αν θες GPS χωρίς καθυστέρηση αργότερα

```bash
gcloud run services update poreiago-api \
  --region=europe-west3 \
  --min-instances=1
```

→ +~25–35€/μήνα. Κάντο όταν έχεις πραγματικούς οδηγούς live.

---

# Επόμενο βήμα ΤΩΡΑ

**Βήμα 0:** Άνοιξε Console → βεβαιώσου ότι έχεις **Project ID** + **Billing**.  
Πες μου το Project ID (π.χ. `poreiago-prod-123456`) και πάμε **Βήμα 1** μαζί.
