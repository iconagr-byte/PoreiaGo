# Fiscal provider setup — all supported providers

Οδηγός ενεργοποίησης παρόχου τιμολόγησης στο PoreiaGo. Η έκδοση γίνεται από το **Python fiscal pipeline** (πληρωμή → Celery → provider → MARK).

## Supported providers

| Admin card | Provider id | Notes |
|------------|-------------|--------|
| myDATA (Native AADE) | `native_aade` | Server env credentials |
| Prosvasis GO | `prosvasis` | SoftOne S1 Cloud (`go.s1cloud.net`) |
| Epsilon Smart | `epsilon` | Epsilon InsertDocuments JWT |
| SoftOne eINVOICING | `softone` | SoftOne ECOS Invoice/json |
| Impact EINVOICING | `impact` | Impact / SoftOne Impact Invoice/json |

Admin: **Ρυθμίσεις → Φορολογία**

---

## SoftOne eINVOICING / Impact

Shared API family ([developers.s1ecos.com](https://developers.s1ecos.com/)):

1. `POST /Authentication/login` with `{ vat, key }`
2. `POST /Invoice/json?sendMethod=A` with Bearer token

### SoftOne defaults
- Prod: `https://einvoice.s1ecos.gr`
- Demo: `https://einvoice-demo.s1ecos.gr`

### Impact defaults
- Prod: `https://einvoiceapi.impact.gr`
- UAT: `https://einvoiceapiuat.impact.gr`

### Fields in Admin
API URL · API Key · Επωνυμία εκδότη · Branch · Κωδικός είδους · ΑΦΜ εκδότη

---

## Prosvasis GO

App ID, S1 code, Bearer, series, branch, MTRL — API `https://go.s1cloud.net`

---

## Epsilon Smart

Smart URL, JWT, optional subscription key, item codes.

---

## Native AADE

Admin: ΑΦΜ. Server env: `AADE_MODE=production`, `AADE_USER_ID`, `AADE_SUBSCRIPTION_KEY`, `AADE_VAT_NUMBER`.

`AADE_MODE=stub` affects only native demo stubs.

---

## VPS

```bash
FISCAL_ENCRYPTION_KEY=<fernet>
CELERY_BROKER_URL=redis://redis:6379/0
bash deploy/scripts/diagnose-fiscal.sh
```

## Credentials needed for live MARK

- SoftOne / Impact: API key + ΑΦΜ
- Prosvasis: App ID + S1 + Bearer + series
- Epsilon: JWT
- Native AADE: user id + subscription key + ΑΦΜ
