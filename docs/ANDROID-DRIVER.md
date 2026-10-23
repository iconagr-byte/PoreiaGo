# PoreiaGo Driver — legacy Capacitor package (deprecated)

> **Do not ship new installs.**  
> Canonical app: [`ANDROID-NATIVE.md`](./ANDROID-NATIVE.md) — package **`com.poreiago.wallet`**, one install, role-routed to `/driver` when a driver JWT is present.

## Deprecated package

App id: `com.poreiago.driver` · name: **PoreiaGo Driver** · folder: `android-driver/`

Kept in-repo only for emergency rebuilds (`driver-run.ps1 -LegacyDriver`). New work must use the unified app.

## Auth → command center (still true inside unified app)

1. Cold start with a **valid driver JWT** → `/driver` command center.
2. Otherwise unified `/login` offers «Είσοδος οδηγού» → `/driver` (`MasterQrGate`).
3. Login response `tenant_id` seals the office; API defaults to `https://www.achilliotravel.com`.

Web `/driver` still clears sticky sessions on reopen. Only **native** keeps the JWT across launches.

## Windows (prefer unified)

```powershell
cd C:\Users\User\poreiago
git fetch origin main; git checkout main; git pull origin main
powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1
# or: .\scripts\driver-run.ps1   (forwards to wallet-run)
```

### Legacy second APK only

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\driver-run.ps1 -LegacyDriver
```

## Gradle notes

Same as Wallet: wrapper **8.14.3**, JDK **17 or 21** (not 25).
