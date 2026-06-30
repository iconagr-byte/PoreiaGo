# Ticketing — Rotating QR, Scan & Boarding

## Architecture

| Layer | Role |
|-------|------|
| **SQLite** (`data/ticketing.db`) | Ticket registry for scan + manifest (indexed, &lt;200ms target) |
| **Rotating JWT** | QR refreshes every **30s** (TOTP-style `step`); payload: `ref`, `tid` only — no PII |
| **bt1.\*** HMAC tokens | Offline wallet fallback when API unreachable |
| **Ed25519 PKI pack** | Signed offline manifest for mountain routes |
| **Postgres SaaS** | Bookings + myDATA; mirrored via `POST /api/tickets/sync` |

## API (FastAPI)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/tickets/sync` | Public | Register checkout booking |
| GET | `/api/tickets/{id}/qr` | Public | Issue rotating JWT |
| POST | `/admin/scan` | `Bearer` driver key | Scan QR → board passenger |
| POST | `/admin/scan/offline-sync` | Driver key | Replay offline scan queue |
| GET | `/admin/boarding/{trip_id}` | Driver key | Live manifest |
| GET | `/admin/offline-manifest?trip_id=` | Driver key | PKI pack |
| POST | `/admin/sms/pre-departure/{trip_id}` | Driver key | SMS stub |

Driver portal (session from Master QR): `/api/driver/manifest`, `/api/driver/session/master-qr`.

## Environment

```env
# Backend
TICKET_JWT_SECRET=change-me-min-32-chars
TICKET_SIGNING_SECRET=dev-only-aerostride-ticket-secret-change-in-production
DRIVER_API_KEYS=dev-driver-key
TICKETING_DB_PATH=data/ticketing.db
SMS_ENABLED=false

# Frontend (.env.local)
VITE_API_BASE=http://localhost:8000
VITE_TICKET_JWT_SECRET=<same as TICKET_JWT_SECRET>
VITE_DRIVER_API_KEY=dev-driver-key
```

## User flows

### Passenger (Wallet)

1. Checkout → `sync` → SQLite row + `ticket_ref`
2. Wallet polls `GET /api/tickets/{bookingId}/qr` every 25s
3. On API failure → local **bt1** signed token

### Driver

- **Admin scan:** `/driver/scan` or `/admin` — uses `DRIVER_API_KEY`
- **Command center:** `/driver` — Master QR session + `ScannerPanel`
- **Offline:** `processScanLocal` verifies JWT or bt1; queue syncs via `/admin/scan/offline-sync`

### Test scan (seed data)

```bash
# Backend running on :8000
curl -s http://localhost:8000/api/tickets/B-1029/qr | jq .token
# Use token in Driver Scan with Trip ID = 1
```

Seed bookings: `B-1029`, `B-1030` (trip 1, PAID).

## Security notes

- Never put passenger name/email in QR — only opaque `ticket_ref`
- Replay protection: same JWT `step` cannot board twice
- Lookup B2C requires email **and** reference code (separate feature)

## Files

- `backend/ticketing/` — DB, QR, scan, boarding, PKI, SMS stub
- `backend/api/ticketing_router.py` — HTTP routes
- `src/hooks/useRotatingTicketQr.js` — wallet polling
- `src/services/ticketingApi.js` — driver scan + offline sync
- `src/lib/ticketing/scanLocal.js` — offline verification
- `public/driver-sw.js` — manifest cache for PWA
