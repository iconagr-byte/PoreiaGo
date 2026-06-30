# PoreiaGo.com — domain + GCP

Brand: **PoreiaGo** (Πορεία + Λεωφορείο) — bus & travel platform.

> Case-insensitive: `PoreiaGo.com` = **`poreiago.com`**

---

## URLs

| URL | Υπηρεσία | Χρήση |
|-----|----------|--------|
| **`https://www.poreiago.com`** | Firebase Hosting | Site, wallet, admin, **`/driver`** PWA |
| **`https://api.poreiago.com`** | Cloud Run | REST API + WebSocket GPS |
| `https://poreiago.com` | redirect → `www` | Apex |

### Env

```env
PUBLIC_APP_URL=https://www.poreiago.com
OLYMPUS_BASE_DOMAIN=poreiago.com
API_HOST=api.poreiago.com
VITE_API_BASE=https://api.poreiago.com
```

### Cloud Build trigger

```
_VITE_API_BASE=https://api.poreiago.com
```

---

## Βήμα 1 — Αγορά από Google Cloud Domains

Το `poreiago.com` φαίνεται **διαθέσιμο** — επιβεβαίωσε στο Console.

1. [Cloud Domains → Register](https://console.cloud.google.com/net-services/domains/registrations)
2. Αναζήτησε: **`poreiago.com`**
3. **Select** → συμπλήρωσε contact info
4. Privacy: **Limit your info**
5. DNS: ✅ **Set up DNS zone in Cloud DNS**
6. Πληρωμή (~12€/έτος) → **ACTIVE**

### CLI

```bash
export GCP_PROJECT_ID=το-project-id
gcloud config set project $GCP_PROJECT_ID
gcloud services enable domains.googleapis.com dns.googleapis.com

gcloud domains registrations search-domains poreiago

gcloud dns managed-zones create poreiago-com \
  --dns-name="poreiago.com." \
  --description="PoreiaGo"

gcloud domains registrations register poreiago.com \
  --cloud-dns-zone=poreiago-com \
  --contact-data-from-file=deploy/gcp/domain-contact.yaml \
  --contact-privacy=private-contact-data
```

---

## Βήμα 2 — API (`api.poreiago.com`)

**Cloud Run** → `booking-travel-api` → **Manage custom domains** → `api.poreiago.com`

```bash
export ZONE=poreiago-com
# IPs από Cloud Run UI:
gcloud dns record-sets create api.poreiago.com. \
  --zone="${ZONE}" \
  --type=A \
  --ttl=300 \
  --rrdatas="34.xxx.xxx.xxx,34.xxx.xxx.xxx"

curl https://api.poreiago.com/health
```

---

## Βήμα 3 — Frontend (`www.poreiago.com`)

**Firebase** → Hosting → **Add custom domain** → `www.poreiago.com`

```bash
gcloud dns record-sets create www.poreiago.com. \
  --zone="${ZONE}" \
  --type=TXT \
  --ttl=300 \
  --rrdatas='"firebase=xxxxxxxx"'

gcloud dns record-sets create www.poreiago.com. \
  --zone="${ZONE}" \
  --type=A \
  --ttl=300 \
  --rrdatas="199.36.158.100"
```

Πρόσθεσε `poreiago.com` → redirect → `www.poreiago.com` (Firebase UI).

---

## Βήμα 4 — Cloud Run + CI/CD

```bash
gcloud run services update booking-travel-api \
  --region=europe-west3 \
  --update-env-vars="PUBLIC_APP_URL=https://www.poreiago.com,OLYMPUS_BASE_DOMAIN=poreiago.com,ENVIRONMENT=production"
```

Cloud Build trigger: `_VITE_API_BASE=https://api.poreiago.com`

```bash
git push origin main   # → auto deploy
```

---

## Δοκιμές

| URL |
|-----|
| `https://api.poreiago.com/health` |
| `https://www.poreiago.com` |
| `https://www.poreiago.com/driver` |

Track links: `https://www.poreiago.com/track/trip/...`

---

## Checklist

- [ ] `poreiago.com` purchased (ACTIVE)
- [ ] `setup-infrastructure.sh` + GitHub trigger
- [ ] `api.poreiago.com` + `www.poreiago.com`
- [ ] `FIREBASE_TOKEN` secret
- [ ] Driver PWA test

---

## Σχετικά

- [DOMAIN-GOOGLE.md](./DOMAIN-GOOGLE.md)
- [CICD-GITHUB.md](./CICD-GITHUB.md)
