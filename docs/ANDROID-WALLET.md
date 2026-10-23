# PoreiaGo Wallet — customer path inside the native app

> **Canonical native doc:** [`ANDROID-NATIVE.md`](./ANDROID-NATIVE.md)  
> Package `com.poreiago.wallet` is now the **one** PoreiaGo Android app (driver + My Wallet + rent).  
> This page covers customer wallet tenant sealing / Google Sign-In.

One My Wallet surface for **λεωφορεία** (rent customers open `/rent/wallet` after role detection).  
Office binding comes from the **customer account** (`wallet_tenant_id` + JWT `tenant_id`), not from a directory of offices.

App id: `com.poreiago.wallet` · name: **PoreiaGo** (display)

## How office isolation works

1. First login/register must happen on an **office Host** (or magic link tied to that office’s booking).
2. Backend binds `customer_accounts.wallet_tenant_id` once — never overwritten by another office.
3. JWT always carries `tenant_id` (Host, home office, or booking office).
4. Native / platform Host re-login uses the **home office** seal (no Host required after bind).
5. Wallet APIs reject Host ≠ JWT office (403).
6. Bookings sync / rentals only accept same-office rows.
7. Client stores `wallet_tenant_id`, namespaces caches, and drops foreign/unscoped rows.

No office picker. No “scan QR to find office” as the main path.

## Product rules

- One login → one sealed office
- Tabs: tickets (bus) + rentals (when office has Rent) + account
- Marketing site / admin stay blocked in Capacitor; **driver** is reachable in the same app after driver login (`/driver`)
- Native visual theme is separate (`src/styles/wallet-native-theme.css`, loaded only in Capacitor) — website `/wallet` keeps its own blue-card look
- Google Sign-In always on login/register; native API → office host (`VITE_NATIVE_API_BASE` or `https://www.achilliotravel.com`)
- API CORS must allow `https://localhost` / `capacitor://localhost` (Capacitor WebView origin) or login shows «σύνδεση με τον server απέτυχε»
- Packaged app enables `CapacitorHttp` so native `fetch` bypasses WebView CORS until/while API CORS is deployed
- Switching offices requires a different account (or logout + first bind elsewhere is blocked if home already set)

## Windows rebuild

Rebuild native whenever Wallet UI/nav changes land on `main` (e.g. remove Κράτηση tab, multi-ticket stack, PWA v4). Stale `android/app/src/main/assets/public` is gitignored — only a fresh `npm run build` + `npx cap sync android` (or `wallet-run.ps1`) picks up the new WebView bundle. Current packaged app version: **1.0.10** (`versionCode` 10).

**Always build from `main`.** Do not use old feature branches (e.g. `cursor/wallet-splash-apple-5ffb` = stale v1.0.9). `wallet-run.ps1` defaults to `-Branch main`.

### Steps (PowerShell)

1. **Close** Android Studio (optional but avoids Gradle fights).
2. **Start a device first** (or the script will wait / fail with a clear message):
   - Android Studio → **Device Manager** → Play on an AVD (e.g. Medium Phone) → wait until you see the **home screen**, **or**
   - Plug a phone with **USB debugging** on (Developer options → USB debugging), accept the RSA prompt.
3. Pull `main` and run the script:

```powershell
cd C:\Users\User\poreiago
git fetch origin main
git checkout main
git pull origin main
powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1
```

Optional flags:

```powershell
# Auto-start first AVD if adb devices is empty
powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1 -StartEmulator

# Longer wait (minutes) for slow cold boots
powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1 -WaitMinutes 5
```

What the script does: `git reset` to **`main`** (default) → wipe stale `dist`/assets → `npm install` + `cap:sync:packaged` → Gradle `assembleDebug` → uninstall old app → install new APK → launch.

### If build succeeds but install hangs / “waiting for emulator”

`adb devices` is empty — nothing to install onto.

```powershell
# Check
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices

# Start AVD + install already-built APK
powershell -ExecutionPolicy Bypass -File .\scripts\wallet-boot-and-install.ps1

# Or install manually after Device Manager Play + home screen
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r .\android\app\build\outputs\apk\debug\app-debug.apk
```

### Linux / CI (assets only — no APK without Android SDK)

```bash
npm ci   # or npm install
npm run cap:sync:packaged   # vite build + npx cap sync android
# Then on a machine with SDK:
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Πρέπει να εμφανίσει και: `OK: Google Sign-In present in packaged assets`.

Πρέπει να εμφανίσει: `OK: new My Wallet login assets (no ticket/QR subtitle)` και μετά `DONE`.

**Μην πατήσεις Run στο Studio** μετά — ξαναβάζει παλιό cache. Άνοιξε μόνο για να δεις logs αν χρειάζεται.

## Android Studio Gradle (important)

If Studio shows:
`Plugin ... InternalProblems ... removed in Gradle 9.6.0`

Studio is using **Gradle 9.6** instead of the project wrapper (**8.14.3**).

Fix:
1. Settings → Build, Execution, Deployment → Build Tools → **Gradle**
2. **Use Gradle from** = `gradle-wrapper.properties` (not a local Gradle install)
3. **Gradle JDK** = `jbr-21` (17 or 21 only)
4. File → Sync Project with Gradle Files

Or skip Studio Run and use:
```powershell
cd C:\Users\User\poreiago; powershell -ExecutionPolicy Bypass -File .\scripts\wallet-boot-and-install.ps1
```

Gradle JDK must be **17 or 21** (not 25). Wrapper = **8.14.3**.

## Security checklist

- [x] JWT carries `tenant_id`
- [x] Account home office persisted (`wallet_tenant_id`)
- [x] Bookings/rentals APIs use sealed tenant (incl. auth’d rent catalog)
- [x] Client filters + storage namespace by office
- [x] Offline last-pass namespaced by office; cleared on office switch / logout
- [x] Cross-office Host/JWT mismatch → 403
- [ ] Native FCM/APNs push (later)
