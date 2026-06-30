# poreiago.com — domain + GCP (ΕΝΕΡΓΟ)

Domain κατοχυρωμένο στο **Google Cloud Domains** — status **Active**, DNS: **Cloud DNS**, auto-renew.

> `poreiago.com` = Go / Πορεία — travel & bus platform

---

## URLs

| URL | Υπηρεσία | Χρήση |
|-----|----------|--------|
| **`https://www.poreiago.com`** | Firebase Hosting | Site, wallet, admin, **`/driver`** PWA |
| **`https://api.poreiago.com`** | Cloud Run | REST API + WebSocket GPS |
| `https://poreiago.com` | redirect → `www` | Apex |

### Env (Cloud Run + Cloud Build)

```env
PUBLIC_APP_URL=https://www.poreiago.com
OLYMPUS_BASE_DOMAIN=poreiago.com
API_HOST=api.poreiago.com
VITE_API_BASE=https://api.poreiago.com
```

### Cloud Build trigger substitution

```
_VITE_API_BASE=https://api.poreiago.com
```

---

## Βήμα 1 — Βρες το DNS zone

**Network Services** → **[Cloud DNS](https://console.cloud.google.com/net-services/dns/zones)**

Θα υπάρχει zone για `poreiago.com` (π.χ. `poreiago-com`).

```bash
export GCP_PROJECT_ID=το-project-id-σου
gcloud dns managed-zones list
# Σημείωσε το ZONE name, π.χ. poreiago-com
export ZONE=poreiago-com
```

---

## Βήμα 2 — Υποδομή GCP (αν δεν τρέχει ακόμα)

Cloud Shell:

```bash
git clone https://github.com/USER/booking-travel.git
cd booking-travel
export GCP_PROJECT_ID=το-project-id
chmod +x deploy/gcp/setup-infrastructure.sh
./deploy/gcp/setup-infrastructure.sh
```

---

## Βήμα 3 — Deploy API (Cloud Run)

```bash
CONN_NAME="$GCP_PROJECT_ID:europe-west3:booking-travel-db"
CONNECTOR="projects/$GCP_PROJECT_ID/locations/europe-west3/connectors/booking-travel-connector"

gcloud builds submit --config=deploy/gcp/cloudbuild.yaml \
  --substitutions=_REGION=europe-west3,_SERVICE=booking-travel-api,_AR_REPO=booking-travel,_CLOUDSQL_INSTANCE=$CONN_NAME,_VPC_CONNECTOR=$CONNECTOR,_VITE_API_BASE=https://api.poreiago.com
```

---

## Βήμα 4 — Custom domain API

1. **[Cloud Run](https://console.cloud.google.com/run)** → `booking-travel-api`
2. **Manage custom domains** → **Add mapping**
3. Domain: **`api.poreiago.com`**
4. Αντίγραψε τα **A record IPs** → πρόσθεσέ τα στο Cloud DNS:

```bash
gcloud dns record-sets create api.poreiago.com. \
  --zone="${ZONE}" \
  --type=A \
  --ttl=300 \
  --rrdatas="IP1,IP2"
```

Ή **Console** → Cloud DNS → zone `poreiago.com` → **Add record set**:
- Name: `api`
- Type: `A`
- TTL: `300`
- IP: (από Cloud Run mapping)

Δοκιμή (μετά από 5–30 λεπτά + SSL):
```bash
curl https://api.poreiago.com/health
```

---

## Βήμα 5 — Frontend (`www.poreiago.com`)

1. **[Firebase Console](https://console.firebase.google.com)** → ίδιο GCP project
2. **Build** → **Hosting** → **Get started** (αν πρώτη φορά)
3. **Add custom domain** → `www.poreiago.com`
4. Πρόσθεσε στο **Cloud DNS** τα records που δείχνει το Firebase:

**TXT** (verification):
```
Name: www
Type: TXT
Value: firebase=xxxx (από Firebase UI)
```

**A** (hosting):
```
Name: www
Type: A
Value: 199.36.158.100 (ή ό,τι δίνει το Firebase)
```

5. **Add custom domain** → `poreiago.com` → **Redirect** to `www.poreiago.com`

### Firebase token + deploy frontend

```bash
firebase login:ci
echo -n "TOKEN" | gcloud secrets create FIREBASE_TOKEN --data-file=-
# IAM για Cloud Build SA — δες CICD-GITHUB.md

npm ci
export VITE_API_BASE=https://api.poreiago.com
npm run build
firebase deploy --only hosting --config deploy/gcp/firebase.json
```

---

## Βήμα 6 — Cloud Run env

```bash
gcloud run services update booking-travel-api \
  --region=europe-west3 \
  --update-env-vars="PUBLIC_APP_URL=https://www.poreiago.com,OLYMPUS_BASE_DOMAIN=poreiago.com,ENVIRONMENT=production"
```

---

## Βήμα 7 — GitHub auto-deploy

Cloud Build trigger substitutions:

| Variable | Value |
|----------|--------|
| `_VITE_API_BASE` | `https://api.poreiago.com` |
| `_CLOUDSQL_INSTANCE` | `PROJECT:europe-west3:booking-travel-db` |
| `_VPC_CONNECTOR` | `projects/PROJECT/locations/europe-west3/connectors/booking-travel-connector` |

Μετά: `git push origin main` → αυτόματο deploy.

---

## Δοκιμές

| URL | Τι ελέγχεις |
|-----|-------------|
| `https://api.poreiago.com/health` | Backend |
| `https://www.poreiago.com` | Frontend |
| `https://www.poreiago.com/driver` | Driver PWA (κινητό) |
| `https://www.poreiago.com/admin/login` | Admin |

Emails / track links:
```
https://www.poreiago.com/track/trip/{id}?tenant_id=...&token=...
```

---

## Checklist

- [x] `poreiago.com` — **Active** (Cloud DNS)
- [ ] Infrastructure (SQL, Redis, Cloud Run)
- [ ] `api.poreiago.com` → Cloud Run + A records
- [ ] `www.poreiago.com` → Firebase + TXT/A records
- [ ] `poreiago.com` redirect → www
- [ ] `PUBLIC_APP_URL` + `_VITE_API_BASE`
- [ ] GitHub → Cloud Build trigger
- [ ] Driver PWA test

---

## Domain info (από Console)

| | |
|--|--|
| Domain | poreiago.com |
| Status | Active |
| DNS | Cloud DNS |
| Renewal | Automatic — June 29, 2027 |
