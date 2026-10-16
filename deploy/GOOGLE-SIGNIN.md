# My Wallet — Google Sign-In

## Website (browser) — already works

Web OAuth client + Authorized JavaScript origins (`https://www.achilliotravel.com`, …).

## Android emulator / Capacitor app

Google **blocks OAuth inside WebView** (origin_mismatch / disallowed_useragent).
The Wallet app uses **native Credential Manager** (`@capgo/capacitor-social-login`), not the website GIS button.

### One-time Google Cloud setup

You need **two** OAuth clients in the **same** Google Cloud project:

| Type | Purpose |
|------|---------|
| **Web application** | Used as `webClientId` in the app (and website) |
| **Android** | Proves the APK is allowed — package + SHA-1 |

**Common 28444 cause:** Android client in project `PoreiaGo` (`967076454927-…`) but app still uses Web client from another project (`838114974488-…`). Fix: create a **Web application** client in the **same** project as the Android client (or create the Android client next to the existing Web client).

#### If Android is already correct in project PoreiaGo

Package `com.poreiago.wallet` + SHA-1 `CA:AE:18:B1:…` is fine. Next:

1. Stay in project **PoreiaGo**
2. **+ Create credentials → OAuth client ID → Application type: Web application**
3. Name: `PoreiaGo Wallet Web`
4. Authorized JavaScript origins:
   - `https://www.achilliotravel.com`
   - `https://achilliotravel.com`
   - `https://www.poreiago.com`
   - `http://localhost:5173`
5. **Create** → copy the new Web Client ID
6. Put that ID in the app as `webClientId` / `GOOGLE_CLIENT_ID` (never the Android client ID `967076454927-nlak…`)

1. On Windows, after a build (or anytime):

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\User\poreiago\scripts\wallet-google-sha1.ps1
```

2. Copy the printed **SHA-1**.
3. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
   → **Create credentials → OAuth client ID → Android**
4. Package name: `com.poreiago.wallet`
5. SHA-1: paste from the script
6. **Create** → wait 5–10 minutes (sometimes longer)
7. Rebuild / reopen Wallet → **Σύνδεση με Google** (native account picker)

Do **not** put the Android client ID in the app. Keep using the Web client ID:
`838114974488-8q36brogbldig001k9n88qrnciqle1j1.apps.googleusercontent.com`

If the OAuth consent screen is in **Testing**, add `iconagr@gmail.com` under **Test users**.

### Rebuild (required after any Google/native change)

```powershell
cd C:\Users\User\poreiago; git fetch origin cursor/wallet-native-theme-isolate-5ffb; git reset --hard origin/cursor/wallet-native-theme-isolate-5ffb; powershell -ExecutionPolicy Bypass -File C:\Users\User\poreiago\scripts\wallet-go.ps1
```

Look for these green lines before the app opens:

- `OK: SocialLogin in capacitor.settings.gradle`
- `OK: SocialLoginPlugin inside APK`
- `SHA-1 (gradle signingReport debug): …` ← copy this into Google Console

Do **not** press Android Studio **Run** — it can install an older APK without the native plugin.

Emulator must be a **Google Play** system image (Play Store icon). After first boot: open Play Store → Update.

### Error `"SocialLogin" plugin is not implemented on android`

The APK on the emulator was built **without** `@capgo/capacitor-social-login`. Fix: pull latest + `wallet-go.ps1`. Website Google Sign-In is unrelated.

### Error `You CANNOT use scopes without modifying the main activity`

Do **not** pass a `scopes` array to `SocialLogin.login` on Android unless `MainActivity` implements Capgo’s `ModifiedMainActivityForSocialLoginPlugin`. Wallet auth only needs the default ID token (email/profile/openid are built-in).

### Error `[28444] Developer console is not set up correctly`

Google Credential Manager rejected **package + signing SHA-1 + webClientId**.

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\User\poreiago\scripts\wallet-google-sha1.ps1
```

Checklist:

1. `webClientId` in the app = **Web** OAuth client (never the Android client ID).
2. Android OAuth client in the **same** GCP project: package `com.poreiago.wallet` + **exact** SHA-1 from the script (prefer APK signing cert).
3. If SHA-1 changed (new machine / new debug.keystore), update or recreate the Android client.
4. Consent screen **Testing** → add your Gmail under Test users.
5. Propagation can take **minutes to a few hours** — then retry in the Wallet app.

Filter Logcat: `GoogleProvider` → compare `signingSha1=` with Console.

## Web client origins (website only)

| Origin |
|--------|
| `https://www.poreiago.com` |
| `https://www.achilliotravel.com` |
| `https://achilliotravel.com` |
| `http://localhost:5173` (dev) |

`https://localhost` is **not** required when using native Credential Manager.

## VPS env

```bash
GOOGLE_CLIENT_ID=….apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=….apps.googleusercontent.com
```

```bash
curl -sS https://www.achilliotravel.com/api/auth/google/config
```
