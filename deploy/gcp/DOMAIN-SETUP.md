# Νέο domain + GCP — πλήρης οδηγός

Πώς να αγοράσεις domain και να το συνδέσεις με **Firebase Hosting** (frontend/PWA) και **Cloud Run** (API).

Αντικατέστησε `yourdomain.gr` με το domain που θα πάρεις.

---

## 1. Τι subdomains χρειάζεσαι

| Host | Υπηρεσία | Χρήση |
|------|----------|--------|
| `app.yourdomain.gr` | Firebase Hosting | Κράτησεις, wallet, **/driver** PWA, admin UI |
| `api.yourdomain.gr` | Cloud Run | REST API + WebSocket GPS |
| `www.yourdomain.gr` | redirect → `app` | Προαιρετικό marketing |
| `*.tenants.yourdomain.gr` | μελλοντικά | Multi-tenant SaaS (φάση 2) |

**Env μετά τη σύνδεση:**
```env
PUBLIC_APP_URL=https://app.yourdomain.gr
VITE_API_BASE=https://api.yourdomain.gr
API_HOST=api.yourdomain.gr
OLYMPUS_BASE_DOMAIN=yourdomain.gr
```

---

## 2. Πού να αγοράσεις domain

### Από Google (προτείνεται για GCP) — [DOMAIN-GOOGLE.md](./DOMAIN-GOOGLE.md)

**Cloud Domains** στο ίδιο GCP project: `.com`, `.app`, `.travel` κλπ.  
**Δεν υποστηρίζει `.gr`** — για `.gr` δες Papaki παρακάτω.

### Ελληνικό `.gr` (μόνο εκτός Google)
| Registrar | Σημειώσεις |
|-----------|------------|
| [Papaki](https://www.papaki.gr) | Δημοφιλές στην Ελλάδα, .gr ~15–25€/έτος |
| [Hostinger GR](https://www.hostinger.gr) | Φθηνό, εύκολο panel |
| [Online.gr](https://www.online.gr) | Ελληνικό registrar |

Χρειάζεσαι **ΑΦΜ** ή στοιχεία εταιρείας για `.gr` (ΕΕΤΤ/GR-NIC).

### Διεθνές `.com` / `.app` / `.travel`
| Registrar | Σημειώσεις |
|-----------|------------|
| [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) | Χωρίς markup, καλό DNS |
| [Google Cloud Domains](https://console.cloud.google.com/net-services/domains/registrations) | **Ίδιο GCP billing** — οδηγός [DOMAIN-GOOGLE.md](./DOMAIN-GOOGLE.md) |
| [Namecheap](https://www.namecheap.com) | Φθηνό `.com` |

**Πρόταση για εσάς:**  
- **Ελληνική επιχείρηση (Achillio κλπ.):** `achillio-travel.gr` ή `achillio-bus.gr`  
- **SaaS brand (OLYMPUS):** `olympus-travel.app` ή `olympusbus.com`  
- **Γενικό:** `booktravel.gr`, `smartbus.gr` (έλεγξε διαθεσιμότητα)

---

## 3. DNS — δύο τρόποι

### Τρόπος Α — Cloud DNS (προτείνεται με GCP)

Όλα τα records σε ένα μέρος, εύκολη διαχείριση SSL.

```bash
export GCP_PROJECT_ID=το-project-id-σου
export DOMAIN=yourdomain.gr

# Ζώνη DNS
gcloud dns managed-zones create booking-travel-zone \
  --dns-name="${DOMAIN}." \
  --description="Booking Travel production"

# Δες nameservers (4 γραμμές ns-cloud-*.googledomains.com)
gcloud dns managed-zones describe booking-travel-zone --format="value(nameServers)"
```

Στον **registrar** (Papaki κλπ.): άλλαξε nameservers → τα 4 του Cloud DNS.

Μετά προσθέτεις records (βήμα 4–5).

### Τρόπος Β — DNS στον registrar

Κράτας Papaki/Cloudflare panel και βάζεις A/CNAME records χειροκίνητα (ίδια values με παρακάτω).

---

## 4. Σύνδεση API → Cloud Run

### Console
1. [Cloud Run](https://console.cloud.google.com/run) → `booking-travel-api`
2. **Manage custom domains** → **Add mapping**
3. Domain: `api.yourdomain.gr`
4. Αν ζητήσει verification: πρόσθεσε TXT record
5. Σημείωσε τα **A / AAAA** records που δίνει το Google

### CLI
```bash
gcloud beta run domain-mappings create \
  --service=booking-travel-api \
  --domain=api.yourdomain.gr \
  --region=europe-west3
```

### DNS record (Cloud DNS)
```bash
# Αντικατέστησε με τα IPs που δίνει το domain mapping
gcloud dns record-sets create api.yourdomain.gr. \
  --zone=booking-travel-zone \
  --type=A \
  --ttl=300 \
  --rrdatas="34.x.x.x"
```

Το SSL (Let's Encrypt) εκδίδεται αυτόματα από το Google (~15–60 λεπτά).

**WebSocket:** Το custom domain στο Cloud Run υποστηρίζει `wss://api.yourdomain.gr/ws/telemetry/ingress` — χωρίς extra config.

---

## 5. Σύνδεση Frontend → Firebase Hosting

### Console
1. [Firebase Console](https://console.firebase.google.com) → το project σου
2. **Hosting** → **Add custom domain**
3. Domain: `app.yourdomain.gr`
4. Πρόσθεσε τα **TXT** (verification) και **A** records που δείχνει

### DNS (παράδειγμα — values από Firebase UI)
```bash
# Verification (μία φορά)
gcloud dns record-sets create app.yourdomain.gr. \
  --zone=booking-travel-zone \
  --type=TXT \
  --ttl=300 \
  --rrdatas='"firebase=xxxx"'

# A records — Firebase δίνει συνήθως 2 IPs
gcloud dns record-sets create app.yourdomain.gr. \
  --zone=booking-travel-zone \
  --type=A \
  --ttl=300 \
  --rrdatas="199.36.158.100"
```

### Rebuild frontend με σωστό API URL
```bash
export VITE_API_BASE=https://api.yourdomain.gr
npm run build
firebase deploy --only hosting --config deploy/gcp/firebase.json
```

---

## 6. Redirect www (προαιρετικό)

Στο Firebase μπορείς να προσθέσεις και `yourdomain.gr` → redirect σε `app.yourdomain.gr`.

Ή CNAME:
```
www.yourdomain.gr → app.yourdomain.gr
```

---

## 7. Ενημέρωση Cloud Run env

```bash
gcloud run services update booking-travel-api \
  --region=europe-west3 \
  --update-env-vars="PUBLIC_APP_URL=https://app.yourdomain.gr,OLYMPUS_BASE_DOMAIN=yourdomain.gr,ENVIRONMENT=production"
```

Secrets (JWT κλπ.) μένουν στο Secret Manager — δες `env.staging.example`.

---

## 8. Έλεγχος ότι όλα δουλεύουν

```bash
curl -s https://api.yourdomain.gr/health
curl -sI https://app.yourdomain.gr/driver | head -5
```

Στο κινητό:
1. `https://app.yourdomain.gr/driver`
2. Προσθήκη στην Αρχική (PWA)
3. Master QR → pre-trip → GPS → admin map

Track links στα emails:
`https://app.yourdomain.gr/track/trip/...`

---

## 9. Χρονοδιάγραμμα DNS

| Βήμα | Χρόνος |
|------|--------|
| Αγορά domain | άμεσα |
| Αλλαγή nameservers → Cloud DNS | 1–48 ώρες (συνήθως <4h) |
| Firebase / Cloud Run verification | 15–60 λεπτά |
| SSL active | έως 24h (συνήθως <1h) |

---

## 10. Κόστος domain

| TLD | Εκτίμηση / έτος |
|-----|-----------------|
| `.gr` | 15–30 € |
| `.com` | 10–15 € |
| `.app` | 15–20 € |
| Cloud DNS zone | ~0.20 €/μήνα |

---

## Checklist

- [ ] Αγορά domain
- [ ] Cloud DNS zone + nameservers στον registrar
- [ ] Cloud Run deploy + domain mapping `api.*`
- [ ] Firebase custom domain `app.*`
- [ ] `VITE_API_BASE` + rebuild + firebase deploy
- [ ] `PUBLIC_APP_URL` στο Cloud Run
- [ ] Δοκιμή `/health`, `/driver`, WebSocket GPS

---

## Φάση 2 — tenants `agency.tenants.yourdomain.gr`

Wildcard SSL + Certificate Manager — όταν ανέβεις multi-tenant production. Δες `docs/PROJECT-OLYMPUS-ENTERPRISE-BLUEPRINT.md`.
