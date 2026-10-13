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
- Switching offices requires a different account (or logout + first bind elsewhere is blocked if home already set)

## Windows rebuild

```powershell
cd C:\Users\User\poreiago
git fetch origin
git reset --hard origin/cursor/wallet-android-capacitor-5ffb
powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1
```

Gradle JDK must be **17 or 21** (not 25).

## Security checklist

- [x] JWT carries `tenant_id`
- [x] Account home office persisted (`wallet_tenant_id`)
- [x] Bookings/rentals APIs use sealed tenant (incl. auth’d rent catalog)
- [x] Client filters + storage namespace by office
- [x] Offline last-pass namespaced by office; cleared on office switch / logout
- [x] Cross-office Host/JWT mismatch → 403
- [ ] Native FCM/APNs push (later)
