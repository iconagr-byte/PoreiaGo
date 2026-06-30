# poreiaOS.com — domain + GCP (πλήρης ρύθμιση)

Brand: **poreiaOS** — travel / bus operating system (OLYMPUS stack).

> Τα domains είναι case-insensitive: `poreiaOS.com` = **`poreiaos.com`**

---

## URLs

| URL | Υπηρεσία | Χρήση |
|-----|----------|--------|
| **`https://www.poreiaos.com`** | Firebase Hosting | Site, wallet, admin, **`/driver`** PWA |
| **`https://api.poreiaos.com`** | Cloud Run | REST API + WebSocket GPS |
| `https://poreiaos.com` | redirect → `www` | Apex |
| `https://app.poreiaos.com` | (προαιρετικό) | Alias → ίδιο Firebase |

### Env

```env
PUBLIC_APP_URL=https://www.poreiaos.com
OLYMPUS_BASE_DOMAIN=poreiaos.com
API_HOST=api.poreiaos.com
VITE_API_BASE=https://api.poreiaos.com
```

### Cloud Build trigger

```
_VITE_API_BASE=https://api.poreiaos.com
```

---

## Βήμα 1 — Αγορά από Google Cloud Domains (~12€/έτος)

1. [Cloud Domains — Register](https://console.cloud.google.com/net-services/domains/registrations)
2. Αναζήτησε: **`poreiaos.com`**
3. **Select** → cart
4. Contact info (όνομα, διεύθυνση, email, τηλέφωνο)
5. Privacy: **Limit your info** ή **Privacy on**
6. **DNS:** ✅ **Set up DNS zone in Cloud DNS** (αυτόματο — χωρίς Papaki)
7. Πληρωμή → status **ACTIVE** σε 1–2 λεπτά

### CLI (Cloud Shell)

```bash
export GCP_PROJECT_ID=το-project-id
gcloud config set project $GCP_PROJECT_ID
gcloud services enable domains.googleapis.com dns.googleapis.com

gcloud domains registrations search-domains poreiaos

gcloud dns managed-zones create poreiaos-com \
  --dns-name="poreiaos.com." \
  --description="poreiaOS"

gcloud domains registrations register poreiaos.com \
  --cloud-dns-zone=poreiaos-com \
  --contact-data-from-file=deploy/gcp/domain-contact.yaml \
  --contact-privacy=private-contact-data
```

(`domain-contact.yaml` από `domain-contact.example.yaml` — μην το ανεβάσεις στο GitHub)

---

## Βήμα 2 — Επιβεβαίωση DNS zone

```bash
gcloud dns managed-zones list
# Zone: poreiaos-com → poreiaos.com.
```

---

## Βήμα 3 — API (`api.poreiaos.com`)

**Cloud Run** → `booking-travel-api` → **Manage custom domains** → **Add mapping**  
Domain: `api.poreiaos.com`

Πρόσθεσε A records στο Cloud DNS:

```bash
export ZONE=poreiaos-com
# IPs από το Cloud Run domain mapping UI:
gcloud dns record-sets create api.poreiaos.com. \
  --zone="${ZONE}" \
  --type=A \
  --ttl=300 \
  --rrdatas="34.xxx.xxx.xxx,34.xxx.xxx.xxx"
```

```bash
curl https://api.poreiaos.com/health
```

---

## Βήμα 4 — Frontend (`www.poreiaos.com`)

1. [Firebase Console](https://console.firebase.google.com) → ίδιο GCP project → **Hosting**
2. **Add custom domain** → `www.poreiaos.com`
3. Πρόσθεσε records στο Cloud DNS:

```bash
# TXT verification (από Firebase)
gcloud dns record-sets create www.poreiaos.com. \
  --zone="${ZONE}" \
  --type=TXT \
  --ttl=300 \
  --rrdatas='"firebase=xxxxxxxx"'

# A record(s) από Firebase
gcloud dns record-sets create www.poreiaos.com. \
  --zone="${ZONE}" \
  --type=A \
  --ttl=300 \
  --rrdatas="199.36.158.100"
```

4. **Add custom domain** → `poreiaos.com` → redirect to `www.poreiaos.com` (στο Firebase UI)

---

## Βήμα 5 — Cloud Run env

```bash
gcloud run services update booking-travel-api \
  --region=europe-west3 \
  --update-env-vars="PUBLIC_APP_URL=https://www.poreiaos.com,OLYMPUS_BASE_DOMAIN=poreiaos.com,ENVIRONMENT=production"
```

---

## Βήμα 6 — GitHub → auto deploy

Cloud Build trigger substitutions:

| Variable | Value |
|----------|--------|
| `_VITE_API_BASE` | `https://api.poreiaos.com` |
| `_CLOUDSQL_INSTANCE` | `PROJECT:europe-west3:booking-travel-db` |
| `_VPC_CONNECTOR` | `projects/PROJECT/locations/europe-west3/connectors/booking-travel-connector` |

```bash
git push origin main
```

---

## Βήμα 7 — Δοκιμές

| URL | Έλεγχος |
|-----|---------|
| `https://api.poreiaos.com/health` | Backend |
| `https://www.poreiaos.com` | Frontend |
| `https://www.poreiaos.com/driver` | Driver PWA (κινητό) |
| `https://www.poreiaos.com/admin` | Admin login |

Track links στα emails:
```
https://www.poreiaos.com/track/trip/{id}?tenant_id=...&token=...
```

---

## Tenant subdomains (μελλοντικά)

```
agency1.tenants.poreiaos.com
```

Wildcard SSL + Certificate Manager — φάση 2 SaaS.

---

## Checklist

- [ ] `poreiaos.com` purchased (Cloud Domains ACTIVE)
- [ ] Cloud DNS zone `poreiaos-com`
- [ ] Infrastructure: `./deploy/gcp/setup-infrastructure.sh`
- [ ] GitHub connected → Cloud Build trigger
- [ ] `FIREBASE_TOKEN` στο Secret Manager
- [ ] `api.poreiaos.com` → Cloud Run
- [ ] `www.poreiaos.com` → Firebase
- [ ] `_VITE_API_BASE` + `PUBLIC_APP_URL` σωστά
- [ ] Driver PWA + GPS test

---

## Σχετικά

- [DOMAIN-GOOGLE.md](./DOMAIN-GOOGLE.md) — γενικός οδηγός Google Domains
- [CICD-GITHUB.md](./CICD-GITHUB.md) — GitHub auto-deploy
- [domain-poreia.gr.md](./domain-poreia.gr.md) — εναλλακτικό `.gr` (αν χρειαστεί αργότερα)
