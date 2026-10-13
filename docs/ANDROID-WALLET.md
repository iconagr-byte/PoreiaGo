# PoreiaGo Wallet — Android (Capacitor)

Native shell **μόνο για My Wallet** πελάτη-ταξιδιώτη (εισιτήρια + QR).  
**Δεν** ανοίγει την ιστοσελίδα, admin, οδηγό ή rent.

App id: `com.poreiago.wallet` · όνομα: **PoreiaGo Wallet**

## Προαπαιτούμενα (στο PC σου)

- Android Studio (τελευταία σταθερή)
- **Gradle JDK 17 ή 21** (όχι 25)
- Node 20+ / npm
- Ένα emulator (π.χ. Pixel 6 · API 34) **ή** USB συσκευή με USB debugging

## Build + Run (σωστή σειρά)

Στο **PowerShell** (μία εντολή τη φορά):

```powershell
cd C:\Users\User\poreiago
git checkout -- capacitor.config.json
git pull
powershell -ExecutionPolicy Bypass -File .\scripts\wallet-android-fix.ps1
```

Αν το `git pull` λέει *local changes would be overwritten*, το `git checkout -- capacitor.config.json` τα καθαρίζει (ήταν παλιό live URL).

Μετά Android Studio:

1. **File → Open** → φάκελος `C:\Users\User\poreiago\android` (όχι το root `poreiago`)
2. Περίμενε να τελειώσει το Gradle sync (κάτω δεξιά)
3. Πάνω στη μπάρα: διάλεξε emulator (π.χ. `Medium Phone API 34`) — **όχι** κενό target
4. Αν δεν υπάρχει συσκευή: **Tools → Device Manager → Create Device → Pixel 6 → API 34 → Finish → ▶**
5. **Run ▶** (πράσινο τρίγωνο)

## Αν βλέπεις `Error running 'app' · Unknown error`

Κάνε **με τη σειρά**:

### 1) Gradle JDK = 21
**File → Settings → Build, Execution, Deployment → Build Tools → Gradle**  
→ **Gradle JDK** = `jbr-21` ή `Embedded JDK` / `17` / `21`  
→ Apply → OK  
**Μην** αφήσεις JDK 25.

### 2) Συσκευή / emulator
- Πάνω δεξιά δίπλα στο Run: πρέπει να φαίνεται όνομα emulator (π.χ. `Pixel_6_API_34`)
- Αν λέει `No devices`: άνοιξε Device Manager και πάτα ▶ στο AVD
- Αν το AVD κολλάει: ▼ μενού → **Cold Boot Now**

### 3) Clean + Invalidate
```
Build → Clean Project
Build → Rebuild Project
```
Μετά Run ▶ ξανά.

### 4) Invalidate Caches
**File → Invalidate Caches… → Invalidate and Restart**

### 5) Ξανά sync από PowerShell
Κλείσε το Android Studio, μετά:

```powershell
cd C:\Users\User\poreiago
npm.cmd run cap:sync:packaged
```

Άνοιξε πάλι μόνο τον φάκελο `android\` και Run.

### 6) Δες το πραγματικό μήνυμα
**View → Tool Windows → Build** (και **Run**)  
Αν υπάρχει κόκκινο log, αυτό μετράει περισσότερο από το «Unknown error».

## Τι φαίνεται μέσα στο app

| Οθόνη | Διαδρομή |
|-------|----------|
| My Wallet (login / εισιτήρια) | `/wallet` → `/login` |
| Εύρεση κράτησης | `/my-booking` |

Κρυμμένα: Αρχική, Λεωφορεία storefront, Rent, admin, driver.

## Αρχεία

- `capacitor.config.json` — app id / splash (**χωρίς** live `server.url`)
- `android/` — Android Studio project
- `src/components/wallet/WalletNativeBoot.jsx` — κλειδώνει μόνο wallet routes
- `scripts/cap-wallet-sync.mjs` — build + sync

## Μην κάνεις

- `npm run cap:sync:live` — φορτώνει το site, όχι μόνο My Wallet
- Open του root `poreiago` αντί για `android`
- Run χωρίς επιλεγμένο emulator

## Επόμενα (Driver / Rent)

Ξεχωριστά apps: `com.poreiago.driver`, `com.poreiago.rent`.
