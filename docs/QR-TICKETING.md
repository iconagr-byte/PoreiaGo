# QR Ticketing & Driver Validation

## Architecture Overview

```
[Booking Paid] → issueSignedQrToken() → QR string (bt1.payload.sig)
                        ↓
              Customer wallet (render on-the-fly)
                        ↓
[Driver Scan] → POST /api/admin/scan → verify HMAC → DB check-in
```

### Token format (`bt1`)

| Part | Content |
|------|---------|
| Prefix | `bt1` (versioned wire format) |
| Payload (base64url) | `{ v, bid, tripId, seat, exp, nonce }` |
| Signature (base64url) | HMAC-SHA256 over canonical string |

Canonical message: `v|bid|tripId|seat|exp|nonce`

**Forgery protection:** Without `TICKET_SIGNING_SECRET`, an attacker cannot produce a valid signature.

---

## 1. Ticket generation (on successful booking)

```javascript
import { issueSignedQrToken } from './lib/ticketing/qrToken.js';
import { isBookingPaid } from './lib/ticketing/bookingStore.js';

async function onPaymentSuccess(booking) {
  if (!isBookingPaid(booking)) throw new Error('Unpaid');
  const qrPayload = await issueSignedQrToken(booking, { ttlHours: 72 });
  // Do NOT store qrPayload in DB in production — regenerate on demand
  await db.bookings.update(booking.id, {
    boardingPassIssued: true,
    qrIssuedAt: new Date().toISOString(),
  });
  return qrPayload;
}
```

Implementation: `src/lib/ticketing/qrToken.js`, `src/services/ticketingApi.js` → `generateTicketOnBookingConfirmed()`.

---

## 2. Driver validation — `POST /api/admin/scan`

**Auth:** `Authorization: Bearer <driverAuthToken>` (demo: set on admin/driver login).

**Body:**

```json
{ "qr": "bt1.eyJ2IjoxLCJiaWQiOiJCLTEwMjkiLC4uLn0.xYz..." }
```

**Server flow** (`server/scanHandler.js`):

1. Verify Bearer token
2. `verifySignedQrToken(qr)` — signature + expiry
3. Load booking by `payload.bid`
4. Reject if not `PAID`
5. Reject if already `CHECKED_IN`
6. Update status → `CHECKED_IN`
7. Return green/red JSON

**Success (200):**

```json
{
  "result": "SUCCESS",
  "passengerName": "John Doe",
  "seat": "4A",
  "bookingId": "B-1029",
  "pnr": "MET26JDOE8A",
  "message": "Επιτυχής επιβίβαση"
}
```

**Failure (4xx):**

```json
{
  "result": "FAILURE",
  "reason": "INVALID_SIGNATURE",
  "message": "Πλαστό ή τροποποιημένο QR."
}
```

**UI:** `/driver/scan` (mobile camera) or Admin → **Scan QR**.

---

## 3. Offline-ready strategy

| Layer | Approach |
|-------|----------|
| **Crypto offline** | HMAC verifies without network (same secret in driver PWA for demo). **Production:** use **Ed25519/RS256** — driver app holds **public key only**. |
| **Anti-replay offline** | Before departure, sync `GET /api/admin/offline-manifest?tripId=1&date=2026-06-15` → list of `{ bookingId, token, passengerName, seat }`. |
| **Local state** | Mark `bookingId` as used in IndexedDB/localStorage; queue scan for sync when online. |
| **Sync** | On reconnect, `POST /api/admin/scan` for each queued token (idempotent server). |

Code: `src/lib/ticketing/offlineManifest.js`, **Λήψη Offline Manifest** on Driver Scan page.

---

## 4. Integration — how to show QR to the user

| Strategy | Pros | Cons |
|----------|------|------|
| **On-the-fly (recommended)** | No stale QR in DB; secret rotation safe | Requires client crypto |
| Base64 PNG in DB | Works in email attachments | Storage, rotation pain |
| Short URL | Tiny QR | Extra hop, online needed |

This project uses **on-the-fly** via `TicketQrCode` + `useTicketQr` hook.

---

## 5. Driver camera snippet

See `public/driver-scan-snippet.html` for a minimal HTML/JS example using `getUserMedia` + `jsQR` and `fetch('/api/admin/scan')`.

---

## Environment

Copy `.env.example` → `.env` and set the same secret for:

- `VITE_TICKET_SIGNING_SECRET` (browser signing for wallet QR)
- `TICKET_SIGNING_SECRET` (Node API in dev middleware)

---

## Production checklist

- [ ] Rotate signing secret via KMS; never commit production secret
- [ ] Move to asymmetric signatures for offline driver apps
- [ ] Rate-limit `/api/admin/scan` per driver device
- [ ] Audit log: `bookingId`, `driverId`, `scannedAt`, `gps`
- [ ] Idempotent check-in (duplicate scan = 409 with passenger info)
