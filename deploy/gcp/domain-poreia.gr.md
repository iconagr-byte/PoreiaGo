# poreia.gr — ρύθμιση για Booking Travel / OLYMPUS

Brand: **ΠΟΡΕΙΑ** (πορεία = δρομολόγιο / ταξίδι) — ιδανικό για travel & bus SaaS.

---

## ⚠️ Διαθεσιμότητα

Το **`poreia.gr` είναι ήδη κατοχυρωμένο** (ενεργό DNS, mail servers).  
**Δεν μπορείς να το αγοράσεις σαν καινούργιο** εκτός αν:

- **Το κατέχεις ήδη** → συνέχισε παρακάτω (DNS → GCP)
- **Δεν είναι δικό σου** → επιλογές:
  - Διαπραγμάτευση με τον τρέχοντα ιδιοκτήτη
  - Εναλλακτικά: `poreia-travel.gr`, `poreia-bus.gr`, `getporeia.gr` (Papaki)
  - Από Google: `poreia.app` ή `poreia.travel` ([DOMAIN-GOOGLE.md](./DOMAIN-GOOGLE.md))

Έλεγχος: [whois.gr](https://whois.gr) ή Papaki → αναζήτηση `poreia.gr`

---

## Αρχιτεκτονική URLs (αν έχεις το poreia.gr)

| URL | Υπηρεσία | Χρήση |
|-----|----------|--------|
| **`https://www.poreia.gr`** | Firebase Hosting | Κύριο site, wallet, admin, **`/driver`** PWA |
| **`https://api.poreia.gr`** | Cloud Run | API + WebSocket GPS |
| `https://poreia.gr` | redirect → `www` | Apex domain |
| `mail.poreia.gr` | **μην το πειράξεις** | Κράτα υπάρχον email αν χρησιμοποιείται |

### Env (Cloud Run + Cloud Build)

```env
PUBLIC_APP_URL=https://www.poreia.gr
OLYMPUS_BASE_DOMAIN=poreia.gr
API_HOST=api.poreia.gr
VITE_API_BASE=https://api.poreia.gr
```

### Cloud Build trigger substitutions

```
_VITE_API_BASE=https://api.poreia.gr
```

---

## Βήμα 1 — `.gr` από Papaki (αν δεν το έχεις)

Η Google **δεν πουλάει `.gr`**. Για `poreia.gr` ή παρόμοιο:

1. [papaki.gr](https://www.papaki.gr) → αναζήτηση `poreia.gr`
2. Εγγραφή ή **μεταφορά** (transfer) αν το έχεις αλλού
3. Χρειάζονται στοιχεία επιχείρησης / ΑΦΜ

---

## Βήμα 2 — DNS (δύο τρόποι)

### Α) Cloud DNS (προτείνεται με GCP)

```bash
export GCP_PROJECT_ID=το-project-id-σου

gcloud dns managed-zones create poreia-gr \
  --dns-name="poreia.gr." \
  --description="Poreia Booking Travel"

gcloud dns managed-zones describe poreia-gr --format="value(nameServers)"
```

Στο **Papaki** (ή όπου είναι το domain): άλλαξε nameservers → τα 4 του Cloud DNS.

### Β) DNS μέσα στο Papaki

Κράτας Papaki nameservers και προσθέτεις records χειροκίνητα (βήμα 3–4).

---

## Βήμα 3 — API (`api.poreia.gr`)

1. **Cloud Run** → `booking-travel-api` → **Manage custom domains**
2. **Add mapping** → `api.poreia.gr`
3. Πρόσθεσε τα **A records** που δίνει το Google:

```bash
export ZONE=poreia-gr   # ή Papaki panel

gcloud dns record-sets create api.poreia.gr. \
  --zone="${ZONE}" \
  --type=A \
  --ttl=300 \
  --rrdatas="34.xxx.xxx.xxx,34.xxx.xxx.xxx"
```

Δοκιμή: `curl https://api.poreia.gr/health`

---

## Βήμα 4 — Frontend (`www.poreia.gr`)

1. **Firebase Console** → Hosting → **Add custom domain**
2. Domain: `www.poreia.gr`
3. Πρόσθεσε στο DNS:

```bash
# TXT verification (τιμή από Firebase UI)
gcloud dns record-sets create www.poreia.gr. \
  --zone="${ZONE}" \
  --type=TXT \
  --ttl=300 \
  --rrdatas='"firebase=xxxx"'

# A record(s) από Firebase
gcloud dns record-sets create www.poreia.gr. \
  --zone="${ZONE}" \
  --type=A \
  --ttl=300 \
  --rrdatas="199.36.158.100"
```

### Apex `poreia.gr` → redirect στο www

Στο Firebase: πρόσθεσε και `poreia.gr` με redirect σε `www.poreia.gr`  
Ή CNAME/A όπως δείχνει το Firebase για apex.

---

## Βήμα 5 — Cloud Run env

```bash
gcloud run services update booking-travel-api \
  --region=europe-west3 \
  --update-env-vars="PUBLIC_APP_URL=https://www.poreia.gr,OLYMPUS_BASE_DOMAIN=poreia.gr,ENVIRONMENT=production"
```

---

## Βήμα 6 — GitHub auto-deploy

Ενημέρωσε Cloud Build trigger:

| Variable | Value |
|----------|--------|
| `_VITE_API_BASE` | `https://api.poreia.gr` |

```bash
git push origin main
```

---

## Βήμα 7 — Δοκιμές

| URL | Τι ελέγχεις |
|-----|-------------|
| `https://api.poreia.gr/health` | Backend OK |
| `https://www.poreia.gr` | Frontend |
| `https://www.poreia.gr/driver` | Driver PWA (κινητό) |
| `https://www.poreia.gr/track/trip/...` | Passenger track links |

---

## Email (προσοχή)

Το `poreia.gr` έχει ήδη **MX** records (`mail.poreia.gr`).  
Όταν αλλάζεις nameservers σε Cloud DNS, **αντιγράψε τα MX** στο νέο zone:

```
poreia.gr.    MX  10  mail.poreia.gr.
poreia.gr.    MX  20  mail2.poreia.gr.
```

Αλλιώς σταματά το email του domain.

---

## Track links & emails

Με `PUBLIC_APP_URL=https://www.poreia.gr` τα links στα email tickets θα είναι:

```
https://www.poreia.gr/track/trip/{id}?tenant_id=...&token=...
https://www.poreia.gr/wallet
```

---

## Εναλλακτικό αν δεν πάρεις το poreia.gr

| Domain | Πού |
|--------|-----|
| `poreia-travel.gr` | Papaki |
| `poreia.app` | Google Cloud Domains |
| `poreia.travel` | Google Cloud Domains |

Ίδια δομή: `www.` + `api.` subdomain.
