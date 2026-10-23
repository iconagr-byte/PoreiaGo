# PoreiaGo native — one Android app, role-routed

**Canonical package:** `com.poreiago.wallet` · display name **PoreiaGo**  
**Android project:** `android/`  
**Build flavor:** `VITE_NATIVE_APP=app` (unified)

Not three apps. One Capacitor install; login / cold start opens the right menu by account type.

| Role | Detection | Home after login / cold start |
|------|-----------|-------------------------------|
| Driver | Valid `driver_command_session` JWT (localStorage on native) | `/driver` → `DriverCommandCenter` |
| Bus / excursion customer | Customer JWT + role ≠ rent | `/wallet` → `SimpleWalletPage` |
| Rent customer | Customer JWT + remembered `rent` (or `/rent/login` path) | `/rent/wallet` → `RentalCustomerApp` |
| Logged out | No session | `/login` (links to rent login + driver entrance) |

Office isolation (Achillio / tenant seals) is unchanged: customer `wallet_tenant_id` + driver `driver_native_office_seal`.

## Migration from two installs

| Old | Status |
|-----|--------|
| `com.poreiago.wallet` | **Keep** — becomes the unified PoreiaGo app (same package id → Play updates replace Wallet) |
| `com.poreiago.driver` (`android-driver/`) | **Deprecated** — do not ship new installs; uninstall from devices; use `-LegacyDriver` only for emergency rebuilds |

Users who already have Wallet keep one icon. Users who installed Driver should uninstall `PoreiaGo Driver` and use PoreiaGo (login → driver menu).

## Layout

| Path | Role |
|------|------|
| `capacitor.config.json` | `com.poreiago.wallet` / PoreiaGo |
| `android/` | Canonical Android project |
| `scripts/cap-wallet-sync.mjs` | Vite (`VITE_NATIVE_APP=app`) + `cap sync android` |
| `scripts/wallet-run.ps1` | Windows: sync → Gradle → install → launch |
| `scripts/driver-run.ps1` | Forwards to `wallet-run.ps1` (unless `-LegacyDriver`) |
| `src/lib/capacitor/nativeRoleHome.js` | Role detection rules |
| `src/components/native/NativeUnifiedBoot.jsx` | Path seal for unified shell |
| `android-driver/` + `capacitor.driver.config.json` | Legacy only |

## Windows rebuild (PowerShell)

**Always build from `main` (or this feature branch while landing).**

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

`driver-run.ps1` without flags does the same (unified app).

### Legacy second APK (avoid)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\driver-run.ps1 -LegacyDriver
```

### Linux / CI (assets only)

```bash
npm ci
npm run cap:sync:packaged   # or cap:app:sync:packaged
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

## Product rules

- Web / PWA routes and sticky-session behaviour are unchanged.
- Native driver JWT persists across process death; web `/driver` still clears sticky auth.
- Marketing home, admin, and platform chrome stay blocked in Capacitor.
- Cold start shows the PoreiaGo brand splash once (`WalletNativeSplashGate`), then the role home — including when early boot rewrote `/` → `/driver`. Legacy `com.poreiago.driver` APK skips the React splash.
- Achillio office seals stay on the sealed host (`VITE_NATIVE_API_BASE` default `https://www.achilliotravel.com`).

## Related docs

- `docs/ANDROID-WALLET.md` — wallet tenant seal / Google Sign-In (still valid for customer path)
- `docs/ANDROID-DRIVER.md` — legacy driver package (deprecated)
