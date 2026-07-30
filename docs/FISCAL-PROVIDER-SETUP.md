# Fiscal issuance setup

Οδηγός ενεργοποίησης έκδοσης παραστατικών στο PoreiaGo (πληρωμή → Celery → κανάλι → MARK).

Admin: **Ρυθμίσεις → Φορολογία**

## Τι είναι «πάροχος»

Στην ορολογία ΑΑΔΕ, **πάροχος ΥΠΑΗΕΣ** = αδειοδοτημένο λογισμικό ηλεκτρονικής τιμολόγησης
([λίστα ΑΑΔΕ](https://www.aade.gr/mydata/adeiodotimena-logismika-parohon-ilektronikis-timologisis)).

| Admin card | Id | Κατηγορία |
|------------|----|-----------|
| SoftOne EINVOICING | `softone` | **Πάροχος ΥΠΑΗΕΣ** (ENTERSOFTONE) |
| Impact eINVOICING | `impact` | **Πάροχος ΥΠΑΗΕΣ** (IMPACT) |
| myDATA απευθείας | `native_aade` | Όχι πάροχος — απευθείας myDATA |
| Prosvasis GO (ERP) | `prosvasis` | ERP κανάλι S1 Cloud (όχι το PROSVASISGO eInvoicing ΥΠΑΗΕΣ) |
| Epsilon Smart (ERP) | `epsilon` | ERP κανάλι (όχι το EPSILONDIGITAL ΥΠΑΗΕΣ) |

---

### SoftOne / Impact wizard

Admin → Φορολογία → **Ενεργοποίηση παρόχου**, ή βήμα «Πάροχος» στο Office setup μετά την αγορά συμβολαίου.

1. Επιλογή SoftOne ή Impact  
2. API URL · API Key · ΑΦΜ  
3. `POST /api/v1/settings/fiscal/test-connection` (login μόνο)  
4. Ενεργοποίηση = `PATCH /settings/fiscal` με `provider=softone|impact`

---

## SoftOne EINVOICING / Impact (πάροχοι)

Shared API ([developers.s1ecos.com](https://developers.s1ecos.com/)):

1. `POST /Authentication/login` with `{ vat, key }`
2. `POST /Invoice/json?sendMethod=A` with Bearer token

### SoftOne
- Prod: `https://einvoice.s1ecos.gr`
- Demo: `https://einvoice-demo.s1ecos.gr`

### Impact
- Prod: `https://einvoiceapi.impact.gr`
- UAT: `https://einvoiceapiuat.impact.gr`

Fields: API URL · API Key · Επωνυμία εκδότη · Branch · Κωδικός είδους · ΑΦΜ εκδότη

---

## myDATA απευθείας

Admin: ΑΦΜ. Server env: `AADE_MODE=production`, `AADE_USER_ID`, `AADE_SUBSCRIPTION_KEY`, `AADE_VAT_NUMBER`.

---

## Prosvasis GO / Epsilon Smart (ERP)

Τεχνικές διασυνδέσεις ERP για πελάτες που ήδη εκδίδουν από αυτά τα συστήματα.
Δεν αντικαθιστούν επιλογή αδειοδοτημένου παρόχου ΥΠΑΗΕΣ.

- Prosvasis: App ID, S1, Bearer, series — `https://go.s1cloud.net`
- Epsilon Smart: Smart URL, JWT, item codes

---

## VPS

```bash
FISCAL_ENCRYPTION_KEY=<fernet>
CELERY_BROKER_URL=redis://redis:6379/0
bash deploy/scripts/diagnose-fiscal.sh
```

## Credentials για live MARK

- SoftOne / Impact: API key + ΑΦΜ
- Native AADE: user id + subscription key + ΑΦΜ
- Prosvasis / Epsilon ERP: τα αντίστοιχα ERP secrets
