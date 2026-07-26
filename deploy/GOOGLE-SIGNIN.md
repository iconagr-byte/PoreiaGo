# My Wallet — Google Sign-In

Χωρίς `GOOGLE_CLIENT_ID` το κουμπί «Σύνδεση με Google» δεν δουλεύει live
(το API απαντά `503 Google OAuth not configured`).

## 1) Δημιούργησε OAuth Web Client

1. Άνοιξε [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. **Create credentials → OAuth client ID → Web application**
3. **Authorized JavaScript origins** (όλα τα host που σερβίρουν το storefront):

   | Origin |
   |--------|
   | `https://www.poreiago.com` |
   | `https://www.achilliotravel.com` |
   | `https://achilliotravel.com` (αν χρησιμοποιείται apex) |
   | `http://localhost:5173` (dev) |

4. **Authorized redirect URIs** — για GIS button / One Tap συνήθως δεν χρειάζονται·
   αν το Console ζητήσει κάτι, βάλε τα ίδια origins με `/`.
5. Αντιγράψε το **Client ID** (`….apps.googleusercontent.com`).

## 2) Βάλε το στο VPS

Στο `/opt/poreiago/deploy/.env.prod`:

```bash
GOOGLE_CLIENT_ID=1234567890-xxxx.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=1234567890-xxxx.apps.googleusercontent.com
```

Μετά:

```bash
cd /opt/poreiago && bash deploy/scripts/vm-deploy-all.sh
```

Ή μόνο recreate API αν το frontend είναι ήδη νέο (runtime config):

```bash
cd /opt/poreiago/deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --force-recreate --no-deps api-blue
```

## 3) Εναλλακτικά: GitHub Actions secret

Repo → **Settings → Secrets → Actions** → `GOOGLE_CLIENT_ID` = το Client ID.

Το deploy workflow το γράφει αυτόματα στο `.env.prod` πριν το `vm-deploy-all.sh`.

## 4) Έλεγχος

```bash
curl -sS https://www.achilliotravel.com/api/auth/google/config
# {"enabled":true,"client_id":"….apps.googleusercontent.com"}
```

Στη σελίδα Login / My Wallet πρέπει να εμφανίζεται το επίσημο κουμπί Google
(όχι «Demo λειτουργία»).
