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

## Windows rebuild (preferred)

Rebuild native whenever Wallet UI/nav changes land on `main`. Stale `android/app/src/main/assets/public` is gitignored — only a fresh `npm run build` + `npx cap sync android` (or `wallet-run.ps1`) picks up the new WebView bundle. Current packaged app version: **1.0.10** (`versionCode` 10).

**Always build from `main`.** Do not use old feature branches. `wallet-run.ps1` defaults to `-Branch main`.

### Preferred path: `wallet-run.ps1` (not Studio Run)

1. **Close** Android Studio (avoids Gradle cache fights).
2. **Start a device** (or the script waits / fails with a clear message):
   - Android Studio → **Device Manager** → ▶ on an AVD → wait for **home screen**, **or**
   - USB phone with **USB debugging** on.
3. Pull `main` and run:

```powershell
cd C:\Users\User\poreiago
git fetch origin main
git checkout main
git pull origin main
powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1
```

Optional:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1 -StartEmulator
powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1 -WaitMinutes 5
```

What the script does: reset to **`main`** → wipe stale `dist`/assets → `npm install` + `cap:sync:packaged` → Gradle `assembleDebug` → uninstall → install → launch.

**After DONE:** do **not** press Studio **Run** (reinstalls a stale/cached APK). Open Studio only for **Logcat / debug** on the already-running app.

### If build OK but install hangs

`adb devices` is empty.

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
powershell -ExecutionPolicy Bypass -File .\scripts\wallet-boot-and-install.ps1
```

### Linux / CI (assets only)

```bash
npm ci
npm run cap:sync:packaged
cd android && ./gradlew assembleDebug
```

Expect: `OK: Google Sign-In present in packaged assets` then `DONE`.

## Android Studio — when you need it

Use Studio for **debugger / Logcat**. Prefer `wallet-run.ps1` for install.

### Open the right folder

1. File → **Close Project** (if repo root is open)
2. File → **Open** → `C:\Users\User\poreiago\android` (**only** `android`, not `poreiago`)
3. Wait for Gradle sync
4. Settings → Build Tools → **Gradle**:
   - **Use Gradle from** = `gradle-wrapper.properties` (**8.14.3**, not local 9.6)
   - **Gradle JDK** = `jbr-21` (17 or 21 — **not 25**)
5. Toolbar: pick a **device** (not «No Devices»)
6. Optional: Run ▶ — or attach Logcat to the app already launched by `wallet-run.ps1`

Prep helper (clears stale Run configs):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\wallet-studio-prep.ps1
```

### `Error running 'app'` / `Unknown error`

Studio often shows that toast with **no details**. Usual causes for this project:

| Cause | What to do |
|-------|------------|
| No device selected | Device Manager → ▶ AVD → wait home screen → pick it in toolbar |
| Wrong/stale Run module | Run → Edit Configurations… → **app** → Module = `poreiago.app.main` → Apply |
| Opened repo root | Close → Open folder `android\` only |
| Gradle JDK 25 / Gradle 9.6 | Wrapper + `jbr-21` (see above) |
| Empty `assets/public` | Run `wallet-run.ps1` or `wallet-studio-prep.ps1 -SyncFirst` first |
| Studio Run after script | Skip Run; use Logcat on the installed app |

Quick recovery (PowerShell):

```powershell
cd C:\Users\User\poreiago
git fetch origin main; git checkout main; git pull origin main
powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1 -StartEmulator
powershell -ExecutionPolicy Bypass -File .\scripts\wallet-studio-prep.ps1
```

Then Studio → Open `android\` → pick device → debug only.

If Gradle says `InternalProblems ... removed in Gradle 9.6.0`: force **wrapper** (8.14.3), not a local Gradle install.

## Security checklist

- [x] JWT carries `tenant_id`
- [x] Account home office persisted (`wallet_tenant_id`)
- [x] Bookings/rentals APIs use sealed tenant (incl. auth’d rent catalog)
- [x] Client filters + storage namespace by office
- [x] Offline last-pass namespaced by office; cleared on office switch / logout
- [x] Cross-office Host/JWT mismatch → 403
- [ ] Native FCM/APNs push (later)
