# Growth (White-label + Webhooks) & Celery Beat

## 1. White-label

**Admin → Ρυθμίσεις → Growth → White-label**

| Πεδίο | Ρόλος |
|--------|------|
| Primary color | CSS variables στο site |
| Custom domain | Host resolver (`GET /api/branding/current?host=`) |
| CSS inline | `<style id="tenant-branding-css">` |
| Checkout base URL | Links σε abandoned recovery emails |

Αποθήκευση: `backend/data/tenant_branding.json`

## 2. Partner webhooks

**Admin → Growth → Partner webhooks**

- Εγγραφή URL + event types (`booking.confirmed`, …)
- Υπογραφή: `HMAC-SHA256` header `X-AeroStride-Signature`
- Μετά checkout → αυτόματο `booking.confirmed`
- Log: `backend/data/partner_webhooks.log`

Secret: `WEBHOOK_SIGNING_SECRET` (ή `dev-webhook-secret`)

## 3. Celery — abandoned recovery αυτόματα

Απαιτεί **Redis** (`redis://localhost:6379`).

```bash
# Terminal 1 — API
make dev-api

# Terminal 2 — worker
make celery-worker

# Terminal 3 — scheduler (κάθε 15 λεπτά file carts)
make celery-beat
```

| Beat task | Συχνότητα |
|-----------|-----------|
| `scan_pre_departure_sms` | */5 min |
| `scan_abandoned_file_carts` | */15 min |
| `scan_abandoned_bookings_all_tenants` | :05, :35 (Postgres SaaS) |
| `retry_failed_fiscal_receipts` | :10, :25, :40, :55 |
| `recover_stuck_fiscal_receipts` | */10 min |
| `send_fiscal_pipeline_alert_task` | καθημερινά (default 08:00) |

Χειροκίνητα (χωρίς Celery): Admin → Ρυθμίσεις → **Recovery (κανόνας)** / **Δοκιμή άμεσα**

**Local Docker:** `make dev` (hybrid) ή `make stack-full` (όλα σε containers) — βλ. [LOCAL-DEV.md](./LOCAL-DEV.md)

**Fiscal pipeline (MARK, auto-retry, reconciliation):** βλ. [FISCAL-PIPELINE-RUNBOOK.md](./FISCAL-PIPELINE-RUNBOOK.md)

## Maintenance mode

Admin → Ρυθμίσεις → **Λειτουργία συντήρησης** — μπλοκάρει B2C (όχι `/admin`, `/driver`).

## Partner event: passenger.boarded

Αυτόματα μετά επιτυχές scan (`POST /admin/scan`) — event `passenger.boarded`.

## Δοκιμή webhook

1. [webhook.site](https://webhook.site) → copy URL  
2. Admin → Growth → προσθήκη webhook `booking.confirmed`  
3. Checkout μια κράτηση ή **Test event**  
4. Δες delivery στο webhook.site + log file
