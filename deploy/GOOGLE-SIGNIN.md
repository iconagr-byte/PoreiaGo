# My Wallet — Google Sign-In

## Website (browser) — already works

Web OAuth client + Authorized JavaScript origins (`https://www.achilliotravel.com`, …).

## Android emulator / Capacitor app

Google **blocks OAuth inside WebView** (origin_mismatch / disallowed_useragent).
The Wallet app uses **native Credential Manager** (`@capgo/capacitor-social-login`), not the website GIS button.

### One-time Google Cloud setup

You need **two** OAuth clients in the **same** project:

| Type | Purpose |
|------|---------|
| **Web application** | Already exists — used as `webClientId` (same as website) |
| **Android** | Proves the APK is allowed — package + SHA-1 |

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
