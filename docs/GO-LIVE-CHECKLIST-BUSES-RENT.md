# Go-live checklist — Λεωφορεία vs Rent (+ υποδομή)

Τι χρειάζεται **από εδώ και πέρα** για να αγοράζει ο πελάτης και να παίρνει **νόμιμη απόδειξη**.  
Χωριστά για **λεωφορεία / εκδρομές** και **ενοικιάσεις (Rent)**.

---

## Σύνοψη σε μία ματιά

| | Λεωφορεία (εισιτήρια) | Rent (ενοικιάσεις) |
|--|----------------------|---------------------|
| Πληρωμή → απόδειξη (SoftOne/Impact/myDATA) | ✅ Υπάρχει end-to-end | ⚠️ Μόνο marker `PENDING_ISSUE` — **δεν** περνά ακόμα από το fiscal pipeline |
| Πάροχος ΥΠΑΗΕΣ | Απαραίτητος για live MARK | Ίδιος πάροχος όταν συνδεθεί το pipeline |
| Celery + Redis | Απαραίτητα σε production | Απαραίτητα όταν ενεργοποιηθεί fiscal |
| Wallet / PDF απόδειξης | ✅ `/wallet/receipt/:bookingId` | ❌ Δεν υπάρχει αντίστοιχο fiscal PDF ακόμα |
| Τι λύνει ο πάροχος | Νομιμότητα + αυτόματη έκδοση | Νομιμότητα **μετά** το wiring πληρωμή→πάροχο |

**Συμπέρασμα:** Για λεωφορεία, ο πάροχος + σωστή υποδομή φέρνουν το σενάριο «αγορά → απόδειξη». Για Rent, χρειάζεται **και** τεχνική διασύνδεση (ίδιο fiscal pipeline) πριν ο πάροχος «λύσει» τις αποδείξεις.

---

## Α. Λεωφορεία / εκδρομές — checklist

### Α1. Γραφείο (business / ρυθμίσεις)

- [ ] Ενεργό συμβόλαιο / tenant office (Achillio κ.λπ.)
- [ ] **Ρυθμίσεις → Φορολογία**
  - [ ] Επιλογή παρόχου: **SoftOne** ή **Impact** (συνιστάται) · ή myDATA απευθείας
  - [ ] ΑΦΜ εκδότη, επωνυμία, branch (αν ζητά ο πάροχος)
  - [ ] API URL (prod ή demo) + API Key
  - [ ] Σειρές παραστατικών: ΑΠΥ (απόδειξη) / ΤΠΥ (τιμολόγιο) / πιστωτικά
  - [ ] **Test connection** επιτυχές
  - [ ] Ενεργοποίηση παρόχου (όχι μόνο demo stub)
- [ ] **Πληρωμές**
  - [ ] Stripe (κάρτα) ενεργό για το office **ή** μετρητά / τράπεζα στο γκισέ
  - [ ] Τραπεζικοί λογαριασμοί (αν bank transfer)
  - [ ] SMTP / email ώστε να φεύγει η απόδειξη με MARK
- [ ] Εκδρομές δημοσιευμένες, τιμές, θέσεις
- [ ] (Προαιρετικά) Browser push στο Wallet για «βγήκε η απόδειξη»

### Α2. Ροή που πρέπει να δουλεύει

1. Πελάτης αγοράζει εισιτήριο (κάρτα / μετρητά / τράπεζα)
2. Δημιουργείται `FiscalInvoice` (PENDING)
3. Celery → πάροχος → **MARK**
4. Email + Wallet → λήψη / εκτύπωση PDF

**Triggers:** Stripe webhook · μετρητά γραφείου/οδηγού · επιβεβαίωση κατάθεσης · χειροκίνητο «Έκδοση» στο admin · ακύρωση → πιστωτικό

### Α3. Έλεγχος πριν live

- [ ] Test πληρωμή κάρτας → MARK μέσα σε ~1–2 λεπτά
- [ ] Test μετρητά από admin → MARK
- [ ] Ακύρωση κράτησης → πιστωτικό
- [ ] PDF στο Wallet εμφανίζει MARK
- [ ] Admin → Φορολογία / Payments: ουρά χωρίς κολλημένα PENDING

### Α4. Τι χρειάζεστε από τον πάροχο (SoftOne / Impact)

| Στοιχείο | SoftOne | Impact |
|----------|---------|--------|
| Σύμβαση ΥΠΑΗΕΣ | Ναι | Ναι |
| API Key + ΑΦΜ | Ναι | Ναι |
| Prod API URL | `https://einvoice.s1ecos.gr` | `https://einvoiceapi.impact.gr` |
| Demo/UAT | `einvoice-demo.s1ecos.gr` | `einvoiceapiuat.impact.gr` |
| Επωνυμία / branch / κωδ. είδους | Όπως δίνει ο πάροχος | Όπως δίνει ο πάροχος |

Οδηγός UI: [FISCAL-PROVIDER-SETUP.md](./FISCAL-PROVIDER-SETUP.md)

---

## Β. Rent (ενοικιάσεις) — checklist

### Β1. Γραφείο (business / ρυθμίσεις)

- [ ] Rent addon / πλάνο Rent ενεργό στο συμβόλαιο
- [ ] Στόλος οχημάτων (μάρκα, μοντέλο, πινακίδα, κατηγορία, φωτογραφίες)
- [ ] Τιμές / κατηγορίες / extras / καλύψεις
- [ ] Σημεία παραλαβής / επιστροφής
- [ ] Συμβόλαια ενοικίασης (πρότυπα, διπλή υπογραφή αν χρησιμοποιείτε)
- [ ] **Πληρωμές Rent**
  - [ ] Κάρτα (Stripe) και/ή μετρητά / τράπεζα στο desk
  - [ ] Προκαταβολή vs πλήρης πληρωμή (όπως το ρυθμίζετε)
- [ ] Ειδοποιήσεις πελάτη (email/SMS) για κράτηση / check-in
- [ ] Ίδιος **πάροχος φορολογίας** με το office (όταν ανοίξει το wiring)

### Β2. Τι υπάρχει σήμερα vs τι λείπει

| Δυνατότητα | Κατάσταση |
|------------|-----------|
| Κράτηση / πληρωμή / desk / συμβόλαιο / wallet Rent | ✅ Υπάρχει |
| `fiscal_status = PENDING_ISSUE` μετά επιβεβαίωση πληρωμής | ⚠️ Marker μόνο |
| `FiscalInvoice` + Celery + SoftOne/Impact MARK | ❌ Δεν είναι συνδεδεμένο ακόμα |
| PDF απόδειξης πελάτη για rental | ❌ Λείπει (αντίστοιχο bus wallet receipt) |

### Β3. Τι χρειάζεται από εδώ και πέρα (προϊόν / dev)

- [ ] Ίδιο capture path με λεωφορεία: πληρωμή Rent → `FiscalInvoice` → `dispatch_fiscal_receipt`
- [ ] Stripe webhook / desk confirm / bank confirm να πυροδοτούν έκδοση
- [ ] Ακύρωση ενοικίασης → πιστωτικό
- [ ] UI πελάτη: «Η απόδειξή σου» (PDF / email) μετά το MARK
- [ ] Admin ουρά αποδείξεων και για rental bookings
- [ ] (Προαιρετικά) τιμολόγιο αν ο ενοικιαστής δίνει ΑΦΜ εταιρείας

Μέχρι να κλείσουν αυτά, **ο πάροχος μόνος του δεν κόβει αποδείξεις Rent**.

### Β4. Έλεγχος όταν συνδεθεί το fiscal

- [ ] Online κράτηση κάρτας → MARK
- [ ] Desk μετρητά / τράπεζα → MARK
- [ ] Μερική προκαταβολή vs εξόφληση (αν κόβετε δύο παραστατικά)
- [ ] Ακύρωση → πιστωτικό
- [ ] Email + εκτύπωση στον πελάτη

---

## Γ. Κοινή υποδομή (VPS / platform) — και για τα δύο

Χωρίς αυτά, ούτε λεωφορεία ούτε (αργότερα) Rent κόβουν σωστά σε production.

### Γ1. Servers & services

- [ ] API + Postgres up
- [ ] Redis up (`CELERY_BROKER_URL`)
- [ ] **Celery worker** (`process_fiscal_receipt` + retries)
- [ ] **Celery beat** (auto-retry FAILED, stuck recovery)
- [ ] Frontend / nginx / TLS (domain office)
- [ ] SMTP (αποδείξεις / ειδοποιήσεις)
- [ ] `FISCAL_ENCRYPTION_KEY` (Fernet) για secrets παρόχου
- [ ] Stripe secrets + **webhook** `payment_intent.succeeded`
- [ ] (Προαιρετικά) `WEB_PUSH_VAPID_*` για push στο Wallet

### Γ2. Ops έλεγχοι

```bash
bash deploy/scripts/diagnose-fiscal.sh
# + health: Redis, Celery worker/beat, fiscal queue
```

- [ ] Δεν μένουν FiscalInvoice σε PENDING/QUEUED ώρες
- [ ] Alerts / admin retry δουλεύουν
- [ ] Backup Postgres + (όπου ισχύει) tenant data dirs

### Γ3. Ασφάλεια / συμμόρφωση

- [ ] ΑΦΜ & στοιχεία εκδότη σωστά ανά tenant (όχι διαρροή μεταξύ γραφείων)
- [ ] Secrets μόνο κρυπτογραφημένα στο `settings_json.fiscal`
- [ ] Demo/stub MARK απενεργοποιημένο σε production (`AADE_MODE` / πραγματικός πάροχος)

Λεπτομέρειες pipeline: [FISCAL-PIPELINE-RUNBOOK.md](./FISCAL-PIPELINE-RUNBOOK.md)

---

## Δ. Προτεραιότητα «από εδώ και πέρα»

### Τώρα (λεωφορεία — έτοιμο προϊόν)

1. Σύμβαση SoftOne **ή** Impact  
2. Ενεργοποίηση στο admin Φορολογία + test connection  
3. Επιβεβαίωση Celery worker/beat + Redis στο VPS  
4. 2–3 live δοκιμές (κάρτα + μετρητά + ακύρωση)  
5. Εκπαίδευση γραφείου: πού βλέπουν ουρά / retry / PDF

### Μετά (Rent — product gap)

1. Wiring πληρωμής Rent → ίδιο fiscal pipeline με εισιτήρια  
2. Customer receipt UX για Rent  
3. Ίδιες δοκιμές MARK με SoftOne/Impact  
4. Go-live Rent αποδείξεων

### Παράλληλα (υποδομή)

1. `diagnose-fiscal.sh` πράσινο σε κάθε deploy  
2. Παρακολούθηση FAILED invoices  
3. SMTP + Stripe webhooks σταθερά

---

## Ε. Συχνές ερωτήσεις

**«Αν πάρω πάροχο, λύνονται όλα;»**  
- **Λεωφορεία:** σχεδόν ναι — αρκεί ρύθμιση + Celery + Stripe/SMTP.  
- **Rent:** όχι ακόμα — χρειάζεται σύνδεση στο ίδιο σύστημα αποδείξεων.

**«Χρειάζομαι δύο παρόχους (έναν για λεωφορεία, έναν για Rent);»**  
Όχι. Ένας πάροχος ανά γραφείο (ΑΦΜ). Διαφορετικά είναι τα **παραστατικά / ροές**, όχι ο πάροχος.

**«Απόδειξη αμέσως στο checkout;»**  
Η έκδοση είναι ασύγχρονη (λίγα δευτερόλεπτα). Ο πελάτης παίρνει email / Wallet / PDF μόλις βγει το MARK — όχι μέσα στο HTTP response της πληρωμής.

---

## Σχετικά docs

- [FISCAL-PROVIDER-SETUP.md](./FISCAL-PROVIDER-SETUP.md) — ενεργοποίηση SoftOne / Impact / myDATA  
- [FISCAL-PIPELINE-RUNBOOK.md](./FISCAL-PIPELINE-RUNBOOK.md) — Celery, retries, ops  
- Admin: **Ρυθμίσεις → Φορολογία** · **Πληρωμές**
