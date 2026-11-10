# Native FCM Push (Capacitor Android)

Web browsers use **Web Push (VAPID)**. Native wallet / driver APKs use **Firebase Cloud Messaging (FCM)** via `@capacitor/push-notifications`.

## One-time Firebase setup

1. Open [Firebase Console](https://console.firebase.google.com) → project (or create one linked to your GCP project).
2. Add two Android apps:
   - Wallet: `com.poreiago.wallet`
   - Driver: `com.poreiago.driver`
3. Download each `google-services.json` and place:
   - `android/app/google-services.json` (wallet)
   - `android-driver/app/google-services.json` (driver)
4. Project settings → **Service accounts** → Generate new private key → save JSON securely.
5. On the Contabo/VPS API host, mount the service account and set **one** of:
   - `FIREBASE_SERVICE_ACCOUNT_FILE=/path/to/firebase-adminsdk.json`
   - `FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'`
   - or `GOOGLE_APPLICATION_CREDENTIALS=/path/to/firebase-adminsdk.json`

Without (5), devices can still **register** FCM tokens; delivery starts once credentials are present (`fcm: true` on `/api/driver/push/config` and `/api/push/config`).

## Rebuild APKs

```powershell
cd C:\Users\User\poreiago
git pull origin main
npm ci
npm run cap:driver:sync:packaged   # or cap:sync:packaged for wallet
# Android Studio → Run
```

Confirm `POST_NOTIFICATIONS` is in the manifest (already added) and Gradle applies `google-services` when the JSON file exists.

## App flow

1. Driver / wallet opens native app → **Ενεργοποίηση push**.
2. Android permission prompt → Allow.
3. Capacitor registers FCM token → `POST /api/.../push/subscribe` with `{ channel: "fcm", token }`.
4. Office events (shift invite, chat, bookings, receipts) send to Web Push **and** FCM subscriptions.

## Checklist

- [ ] `google-services.json` in wallet + driver Android apps
- [ ] Firebase Admin service account on API server
- [ ] Rebuild + install APKs
- [ ] Driver: Ενεργοποίηση push → Δοκιμή push
- [ ] Wallet: account → Push ειδοποιήσεις → Ενεργοποίηση
