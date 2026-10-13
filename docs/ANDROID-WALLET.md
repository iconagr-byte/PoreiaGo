# PoreiaGo Wallet — Android (Capacitor)

Native shell **μόνο για My Wallet** πελάτη-ταξιδιώτη (εισιτήρια + QR).  
**Δεν** ανοίγει την ιστοσελίδα, admin, οδηγό ή rent.

App id: `com.poreiago.wallet` · όνομα: **PoreiaGo Wallet**

## Προαπαιτούμενα (στο PC σου)

- Android Studio
- JDK 17 ή 21 (όχι 25)
- Node 20+ / npm

## Build (μόνο My Wallet από τοπικό `dist/`)

Στο PowerShell:

```powershell
cd C:\Users\User\poreiago
git pull
npm.cmd install
npm.cmd run cap:sync:packaged
```

Μετά στο Android Studio: άνοιξε τον φάκελο `android/` → **Run ▶**.

Ή όλα μαζί:

```powershell
npm.cmd run cap:android
```

Χωρίς `server.url` το WebView φορτώνει τα τοπικά αρχεία — όχι το live site.

## Τι φαίνεται μέσα στο app

| Οθόνη | Διαδρομή |
|-------|----------|
| My Wallet (login / εισιτήρια) | `/wallet` → `/login` |
| Εύρεση κράτησης | `/my-booking` |

Κρυμμένα: Αρχική, Λεωφορεία storefront, Rent, admin, driver.

## Αρχεία

- `capacitor.config.json` — app id / splash (χωρίς live URL)
- `android/` — Android Studio project
- `src/components/wallet/WalletNativeBoot.jsx` — κλειδώνει μόνο wallet routes
- `src/components/wallet/WalletNativeShell.jsx` — κάτω tabs
- `scripts/cap-wallet-sync.mjs` — build + sync

## Προαιρετικά: live URL (όχι για Wallet-only)

```bash
npm run cap:sync:live
```

Φορτώνει το production site — **μην** το χρησιμοποιείς αν θέλεις μόνο My Wallet.

## Επόμενα (Driver / Rent)

Ξεχωριστά apps: `com.poreiago.driver`, `com.poreiago.rent`.
