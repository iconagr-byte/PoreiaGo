# Domain από Google Cloud Domains

Αγορά domain **μέσα στο Google Cloud Console** — ίδιο billing με το GCP project, εύκολη σύνδεση με Cloud DNS, Cloud Run και Firebase.

> **Σημαντικό:** Η Google **δεν πουλάει `.gr`** domains. Διαθέσιμα: `.com`, `.app`, `.travel`, `.eu`, `.net` κλπ.  
> Αν θέλεις **αποκλειστικά `.gr`**, χρησιμοποίησε Papaki και δες [DOMAIN-SETUP.md](./DOMAIN-SETUP.md).

---

## Προτεινόμενα ονόματα (έλεγξε διαθεσιμότητα στο Console)

| Domain | Τιμή ~ / έτος | Σημειώσεις |
|--------|---------------|------------|
| `achilliotravel.com` | ~12€ | Εμπορικό, διεθνές |
| `olympus-travel.app` | ~14€ | SaaS / tech brand |
| `smartbus.travel` | ~60€ | Travel industry TLD |
| `booktravel.app` | ~14€ | Γενικό booking |

---

## Βήμα 1 — Ενεργοποίηση APIs

Στο [Cloud Console](https://console.cloud.google.com):

1. **APIs & Services** → **Enable APIs**
2. Ενεργοποίησε:
   - **Cloud Domains API**
   - **Cloud DNS API**

Ή Cloud Shell:

```bash
gcloud services enable domains.googleapis.com dns.googleapis.com --project=ΤΟ_PROJECT_ID
```

---

## Βήμα 2 — Αγορά domain (Console)

1. Άνοιξε **[Cloud Domains](https://console.cloud.google.com/net-services/domains/registrations)**
2. **Register domain**
3. Αναζήτησε π.χ. `achilliotravel.com` ή `olympus-travel.app`
4. **Select** → προσθήκη στο cart
5. Συμπλήρωσε **Registrant contact** (όνομα, διεύθυνση, email, τηλέφωνο)
6. **Privacy protection:** πρότεινεται **Limit your info** ή **Privacy on**
7. **DNS provider:** επίλεξε **Set up DNS zone in Cloud DNS** (βολικό — δεν αλλάζεις nameservers χειροκίνητα)
8. Ολοκλήρωσε πληρωμή (ίδιος λογαριασμός billing με GCP)

Μετά από 1–2 λεπτά το domain γίνεται **ACTIVE**.

---

## Βήμα 3 — Έλεγχος DNS zone

**Network Services** → **[Cloud DNS](https://console.cloud.google.com/net-services/dns/zones)**

Θα υπάρχει zone με όνομα το domain σου (π.χ. `achilliotravel-com`).  
Τα nameservers είναι ήδη του Google — **δεν χρειάζεται Papaki**.

```bash
gcloud dns managed-zones list --project=ΤΟ_PROJECT_ID
```

---

## Βήμα 4 — Subdomains για την εφαρμογή

Θα χρησιμοποιήσεις:

| Host | Υπηρεσία |
|------|----------|
| `app.το-domain.com` | Firebase Hosting |
| `api.το-domain.com` | Cloud Run |

### 4α. API → Cloud Run

**Cloud Run** → `booking-travel-api` → **Manage custom domains** → **Add mapping**  
Domain: `api.το-domain.com`

Το Console δίνει **A records** (IP addresses). Πρόσθεσέ τα στο Cloud DNS:

```bash
export DOMAIN=achilliotravel.com   # το domain που αγόρασες
export ZONE=achilliotravel-com     # όνομα zone από Cloud DNS

# Αντικατέστησε με τα IPs από το Cloud Run domain mapping
gcloud dns record-sets create api.${DOMAIN}. \
  --zone="${ZONE}" \
  --type=A \
  --ttl=300 \
  --rrdatas="34.102.xxx.xxx,34.111.xxx.xxx"
```

### 4β. App → Firebase Hosting

1. [Firebase Console](https://console.firebase.google.com) → ίδιο GCP project
2. **Hosting** → **Add custom domain** → `app.το-domain.com`
3. Πρόσθεσε **TXT** (verification) και **A** records στο Cloud DNS — το Firebase σου δείχνει ακριβώς τι values

```bash
# Παράδειγμα TXT verification (value από Firebase UI)
gcloud dns record-sets create app.${DOMAIN}. \
  --zone="${ZONE}" \
  --type=TXT \
  --ttl=300 \
  --rrdatas='"firebase=xxxxxxxx"'

# A record — IP από Firebase
gcloud dns record-sets create app.${DOMAIN}. \
  --zone="${ZONE}" \
  --type=A \
  --ttl=300 \
  --rrdatas="199.36.158.100"
```

SSL (HTTPS) εκδίδεται αυτόματα (15–60 λεπτά).

---

## Βήμα 5 — Env + Cloud Build trigger

Ενημέρωσε substitutions στο **Cloud Build trigger**:

| Variable | Value |
|----------|--------|
| `_VITE_API_BASE` | `https://api.το-domain.com` |
| `PUBLIC_APP_URL` (Cloud Run env) | `https://app.το-domain.com` |
| `OLYMPUS_BASE_DOMAIN` | `το-domain.com` |

```bash
gcloud run services update booking-travel-api \
  --region=europe-west3 \
  --update-env-vars="PUBLIC_APP_URL=https://app.το-domain.com,OLYMPUS_BASE_DOMAIN=το-domain.com"
```

Κάνε push στο GitHub → auto deploy με σωστά URLs.

---

## Εναλλακτικά — αγορά από Cloud Shell (CLI)

```bash
export GCP_PROJECT_ID=το-project-id
gcloud config set project $GCP_PROJECT_ID

# Αναζήτηση διαθέσιμων
gcloud domains registrations search-domains achilliotravel

# Παράμετροι τιμής
gcloud domains registrations get-register-parameters achilliotravel.com

# Δημιούργησε πρώτα DNS zone (αν δεν τη δημιούργησε το Console)
gcloud dns managed-zones create achilliotravel-com \
  --dns-name="achilliotravel.com." \
  --description="Booking Travel"

# Εγγραφή domain + σύνδεση με Cloud DNS
gcloud domains registrations register achilliotravel.com \
  --cloud-dns-zone=achilliotravel-com \
  --contact-data-from-file=deploy/gcp/domain-contact.yaml \
  --contact-privacy=private-contact-data
```

Το `domain-contact.yaml` φτιάχνεις μία φορά (δες παράδειγμα παρακάτω).

---

## Παράδειγμα `domain-contact.yaml`

Αντίγραψε σε `deploy/gcp/domain-contact.yaml` (μην το ανεβάσεις στο GitHub — πρόσθεσε στο `.gitignore`):

```yaml
allContacts:
  email: you@company.gr
  phoneNumber: +30.2100000000
  postalAddress:
    regionCode: GR
    postalCode: "10431"
    administrativeArea: Attica
    locality: Athens
    addressLines:
      - "Οδός 1"
  organization: Achillio Travel
registrantContact:
  postalAddress:
    regionCode: GR
```

---

## Checklist

- [ ] Billing ενεργό στο GCP project
- [ ] Cloud Domains API enabled
- [ ] Domain purchased (ACTIVE)
- [ ] Cloud DNS zone υπάρχει
- [ ] Cloud Run mapping `api.*` + A records
- [ ] Firebase `app.*` + TXT/A records
- [ ] `_VITE_API_BASE` στο Cloud Build trigger
- [ ] `PUBLIC_APP_URL` στο Cloud Run
- [ ] Δοκιμή: `curl https://api.../health` και `https://app.../driver`

---

## Ανανέωση / τιμές

- **Auto-renew** ενεργό by default στο Cloud Domains
- Τιμές ανά TLD: [cloud.google.com/domains/pricing](https://cloud.google.com/domains/pricing)
- Διαχείριση: Console → **Cloud Domains** → το domain σου

---

## Αν θέλεις `.gr` αργότερα

Κράτα το `.com` από Google ως κύριο· μπορείς να αγοράσεις `.gr` από Papaki και να κάνεις **redirect** στο `app.*` — δες [DOMAIN-SETUP.md](./DOMAIN-SETUP.md).
