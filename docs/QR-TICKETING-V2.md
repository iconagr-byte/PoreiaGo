# QR Ticketing V2 — Rotating JWT, FastAPI, Driver Manifest

## 1. Rotating QR (TOTP-style, 30s)

- **Window:** `step = floor(unix_time / 30)`
- **JWT claims (no PII):** `ref` (opaque UUID), `tid` (trip_id), `step`, `exp`, `iss`
- **Anti-screenshot:** Wallet polls `GET /api/tickets/{booking_id}/qr` every 25s
- **Anti-replay:** Server stores `last_scan_step` per booking; rejects duplicate step

```python
# backend/ticketing/qr_rotating.py
payload = {"ref": ticket_ref, "tid": trip_id, "step": step, "exp": window_end}
token = jwt.encode(payload, SECRET, algorithm="HS256")
```

## 2. POST `/admin/scan`

**Headers:** `Authorization: Bearer <DRIVER_API_KEY>`

**Body:**
```json
{ "qr": "<jwt>", "trip_id": 1 }
```

**Flow (<200ms target):**
1. Decode & verify JWT signature + time window
2. Resolve `ref` → booking (indexed SQLite)
3. Validate `booking.trip_id == trip_id`
4. Validate `PAID`, not already `BOARDED`
5. `BEGIN IMMEDIATE` → `UPDATE … SET check_in_status='BOARDED'`
6. Return structured JSON:

```json
{
  "result": "SUCCESS",
  "passenger_name": "John Doe",
  "seat_number": "4A",
  "special_requirements": {
    "needs_assistance": false,
    "allergies": [],
    "notes": "Window seat"
  },
  "elapsed_ms": 12.4
}
```

## 3. Live Boarding Manifest

`GET /admin/boarding/{trip_id}`

- `progress_label`: `35/45`
- `missing_passengers`: no-shows
- `boarded_passengers`: conflicts / already scanned
- `alerts`: capacity & no-show warnings

Driver UI: `/driver/scan` → tab **Live Boarding** (polls every 3s).

## 4. Offline PKI (optional)

`GET /admin/offline-manifest?trip_id=1`

- Manifest signed with **Ed25519** (`backend/ticketing/offline_pki.py`)
- Driver app stores **public key only**
- Offline: verify manifest signature + validate rotating JWT cryptographically
- On reconnect: replay scans to `POST /admin/scan` for authoritative `BOARDED` state

## 5. Pre-departure SMS

`POST /admin/sms/pre-departure/{trip_id}`

Logic (`sms_jobs.py`): 5 minutes before `departure_at`, if `check_in_status != BOARDED` → queue SMS *"Where are you?"*

Production: Celery + Twilio; this repo returns stub `targets[]`.

## 6. WordPress «My Trips» (canvas QR)

Do **not** embed PII in QR. In PHP:

```php
$response = wp_remote_get( REST_URL . '/api/tickets/' . $booking_id . '/qr' );
$body = json_decode( wp_remote_retrieve_body( $response ), true );
$token = esc_js( $body['token'] );
```

Render with **qrcode.js** on `<canvas>`; refresh every 25s:

```javascript
async function renderTicketQr(bookingId) {
  const res = await fetch(`/wp-json/aerostride/v1/tickets/${bookingId}/qr`);
  const { token, expires_in } = await res.json();
  QRCode.toCanvas(document.getElementById('qr'), token, { width: 200 });
  setTimeout(() => renderTicketQr(bookingId), Math.max(15000, (expires_in - 5) * 1000));
}
```

Proxy the FastAPI route through a WordPress REST plugin with user auth.

## 7. Run stack

```bash
# Terminal 1 — FastAPI
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — React
npm run dev
```

Login: `driver@aerostride.com` → scan QR from wallet (`B-1029`, trip 1).

## 8. Security checklist

| Rule | Implementation |
|------|----------------|
| No PII in QR | Only `ref` + `tid` + `step` |
| Rotating 30s | JWT `step` window |
| Trip binding | `trip_id` in scan body |
| Atomic board | SQLite `BEGIN IMMEDIATE` |
| Driver auth | `DRIVER_API_KEYS` env |
| Production | RS256/Ed25519 for JWT; KMS secrets |
