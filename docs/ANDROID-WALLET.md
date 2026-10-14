# PoreiaGo Wallet — unified native app (buses + rent)

One My Wallet app for **λεωφορεία + ενοικιάσεις**.  
Office binding comes from the **customer account** (`wallet_tenant_id` + JWT `tenant_id`), not from a directory of offices.

App id: `com.poreiago.wallet` · name: **PoreiaGo Wallet**

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
- Marketing site / admin / driver stay blocked in Capacitor
<<<<<<< HEAD
- Native visual theme is separate (`src/styles/wallet-native-theme.css`, loaded only in Capacitor) — website `/wallet` keeps its own blue-card look
=======
- Google Sign-In always on login/register; native API → office host (`VITE_NATIVE_API_BASE` or `https://www.achilliotravel.com`)
>>>>>>> 7cd6358 (fix(wallet): show Google Sign-In in native Capacitor app)
- Switching offices requires a different account (or logout + first bind elsewhere is blocked if home already set)

## Windows rebuild

1. **Κλείσε** Android Studio τελείως.
2. Άνοιξε emulator (home screen).
3. Στο **PowerShell**:

```powershell
cd C:\Users\User\poreiago
powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1
```

Το script: `git reset main` → καθαρίζει `dist`/assets → `npm build` + `cap sync` → Gradle → uninstall παλιά app → install νέα.

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
