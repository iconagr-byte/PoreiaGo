# Fiscal provider setup — Prosvasis / Epsilon / Native AADE

Οδηγός ενεργοποίησης παρόχου τιμολόγησης στο PoreiaGo. Η έκδοση γίνεται από το **Python fiscal pipeline** (πληρωμή → Celery → provider → MARK), όχι από το frontend facade.

---

## Live VPS snapshot (checked 2026-07-30)

| Check | Result |
|-------|--------|
| Redis | **ok** (`redis://redis:6379/0`) |
| Database | **ok** |
| Fiscal pipeline | **degraded** — 1 stuck `PENDING` invoice, 0 issued |
| Celery workers | Verify with `diagnose-fiscal` / `/health` → `celery` block after this PR |

Endpoint: `GET https://api.poreiago.com/health`

---

## Recommended path: Prosvasis GO

### 1) VPS env (once)

On the VPS (`deploy/.env.prod`), ensure:

```bash
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1
FISCAL_ENCRYPTION_KEY=<fernet-key>   # auto-added by ensure-env-prod.sh
```

`AADE_MODE=stub` affects **only** the legacy native gateway demo path.  
For Prosvasis/Epsilon the tenant provider settings in Admin drive issuance.

Restart after env changes:

```bash
cd /opt/poreiago
docker compose --env-file deploy/.env.prod -f deploy/docker-compose.prod.yml \
  up -d --force-recreate --no-deps worker celery-beat api-blue
```

### 2) Prosvasis credentials (from SoftOne / Prosvasis portal)

Enter in **Admin → Ρυθμίσεις → Φορολογία → Prosvasis GO**:

| Field | Where |
|-------|--------|
| ΑΦΜ εκδότη | Company VAT |
| API URL | usually `https://go.s1cloud.net` |
| App ID | S1 application id |
| S1 code | secret |
| Bearer token | secret |
| Series retail / invoice | numeric series ids |
| Branch | e.g. `1000` |
| Service MTRL code | service item code for travel/rent lines |
| Payment codes | cash / card / bank |

Save → confirm green «Ρυθμισμένο» on secrets.

### 3) Smoke test

1. Confirm `/health` shows `celery.status=ok` and workers listed.
2. Take a paid booking (or cash at desk).
3. Or: BackOffice → booking → **Έκδοση** fiscal.
4. Expect MARK on booking + fiscal stats `issued` increments.
5. If FAILED: check worker logs + retry from Πληρωμές reconciliation.

```bash
docker compose --env-file deploy/.env.prod -f deploy/docker-compose.prod.yml logs --tail=100 worker
```

---

## Alternative: Epsilon Smart

Same Admin panel → **Epsilon Smart**:

- Smart URL (default `https://epsilonsmart.epsilonnet.gr/`)
- JWT (+ optional subscription key)
- Retail / wholesale item codes

Requires `FISCAL_ENCRYPTION_KEY` on VPS (same as Prosvasis).

---

## Alternative: Native AADE

Admin selects **myDATA (Native AADE)** + issuer VAT.  
Server env (not UI secrets):

```bash
AADE_MODE=production
AADE_USER_ID=...
AADE_SUBSCRIPTION_KEY=...
AADE_VAT_NUMBER=...
AADE_API_URL=https://mydataapi.aade.gr/myDATA/SendInvoices
AADE_SECRETS_BACKEND=env
```

Sandbox E2E: `make fiscal-aade-e2e-live` (see `backend/scripts/fiscal_aade_e2e.py`).

---

## Diagnose commands

```bash
# From repo on VPS
bash deploy/scripts/diagnose-fiscal.sh

# Or GitHub Actions → "Diagnose fiscal (VPS)"
```

---

## What you must send to go live

Για Prosvasis: **App ID + S1 code + Bearer + series/branch/MTRL + ΑΦΜ**.  
Χωρίς αυτά δεν μπορεί να ολοκληρωθεί live δοκιμή παρόχου από το agent.
