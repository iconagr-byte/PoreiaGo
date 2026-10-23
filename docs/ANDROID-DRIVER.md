# PoreiaGo Driver — native Capacitor app

Android shell for the **existing** driver command center (`/driver`, `DriverCommandCenter`).  
Same office driver accounts and `/api/driver/session/*` APIs as the web/PWA flow — not a parallel product.

App id: `com.poreiago.driver` · name: **PoreiaGo Driver**  
Wallet stays separate: `com.poreiago.wallet` under `android/`.

## Auth → command center

1. Cold start always seals into `/driver` (never marketing home, never Wallet).
2. If a **valid driver JWT** is persisted (native uses `localStorage`) → open the menu / command center.
3. Otherwise show the in-place login gate (`MasterQrGate`: username/password or Master QR).
4. Login response `tenant_id` seals the office; packaged API defaults to `https://www.achilliotravel.com` (`VITE_NATIVE_API_BASE`) so Achillio drivers stay on Achillio.

Web `/driver` still clears sticky sessions on reopen (PWA security). Only the **native** shell keeps the JWT across launches.

## Layout in this repo

| Path | Role |
|------|------|
| `capacitor.driver.config.json` | Driver app id / plugins |
| `android-driver/` | Android project (`com.poreiago.driver`) |
| `scripts/cap-driver-sync.mjs` | Vite build (`VITE_NATIVE_APP=driver`) + Capacitor sync |
| `scripts/driver-run.ps1` | Windows: sync → Gradle → install → launch |
| `src/components/driver/DriverNativeBoot.jsx` | Path seal to `/driver` |
| `src/lib/capacitor/nativeAppId.js` | `wallet` vs `driver` flavor |

Wallet `android/` is untouched. Sync briefly swaps folders, then restores Wallet.

## Windows rebuild (PowerShell)

**Always build from `main`.** Do not use old feature branches (e.g. `cursor/driver-native-app-5ffb` was deleted after merge #836). `driver-run.ps1` defaults to `-Branch main`.

1. Close Android Studio (optional).
2. **Start a device first** (or the script will wait / fail with a clear message):
   - Android Studio → **Device Manager** → Play on an AVD → wait until you see the **home screen**, **or**
   - Plug a phone with **USB debugging** on (Developer options), **or**
   - Pass `-StartEmulator` to auto-start the first AVD.
3. From the repo:

```powershell
cd C:\Users\User\poreiago
git fetch origin main
git checkout main
git pull origin main
powershell -ExecutionPolicy Bypass -File .\scripts\driver-run.ps1
```

Optional:

```powershell
# Auto-start first AVD if adb devices is empty
powershell -ExecutionPolicy Bypass -File .\scripts\driver-run.ps1 -StartEmulator

# Longer wait (minutes) for slow cold boots
powershell -ExecutionPolicy Bypass -File .\scripts\driver-run.ps1 -WaitMinutes 5
```

What the script does: `git reset` to **`main`** (default) → wipe stale driver assets → `npm install` + `cap:driver:sync:packaged` → Gradle `assembleDebug` in `android-driver` → uninstall old Driver APK → install → launch `com.poreiago.driver/.MainActivity`.

### If build succeeds but install hangs / “waiting for emulator”

`adb devices` is empty — nothing to install onto.

```powershell
# Check
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices

# Install already-built APK after Device Manager Play + home screen
powershell -ExecutionPolicy Bypass -File .\scripts\driver-install.ps1

# Or rebuild and auto-start first AVD
powershell -ExecutionPolicy Bypass -File .\scripts\driver-run.ps1 -StartEmulator
```

### Install an already-built APK

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\driver-install.ps1
```

### Linux / CI (assets only)

```bash
npm ci
npm run cap:driver:sync:packaged
# On a machine with Android SDK:
cd android-driver && ./gradlew assembleDebug
# APK: android-driver/app/build/outputs/apk/debug/app-debug.apk
```

## Product rules (first slice)

- Driver accounts come from the office/tenant system (existing login + Master QR).
- After login / valid session → **command center**, not Wallet, not marketing.
- Camera + location permissions declared for scan + shift GPS.
- No Google Sign-In in the Driver shell (password / QR only).
- Play Store polish, FCM push, and branded splash can follow.

## Gradle notes

Same as Wallet: wrapper **8.14.3**, JDK **17 or 21** (not 25).  
Studio → Gradle from `gradle-wrapper.properties`, JDK = `jbr-21`.
