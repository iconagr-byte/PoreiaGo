# PoreiaGo Wallet — Android (Capacitor)

Native shell για **My Wallet πελάτη-ταξιδιώτη** (εισιτήρια + εύρεση κράτησης).  
App id: `com.poreiago.wallet` · όνομα: **PoreiaGo Wallet**

## Προαπαιτούμενα (στο PC σου)

- Android Studio (εγκατεστημένο)
- JDK 17
- Node 20+ / npm

## Γρήγορο άνοιγμα (live site μέσα στο app)

Δείχνει το storefront λεωφορείων του γραφείου + `/wallet` για εισιτήρια:

```bash
cd /path/to/poreiago
npm install
# Προεπιλογή: My Wallet πελάτη (όχι όλη η ιστοσελίδα)
npm run cap:android
```

Άλλο γραφείο:

```bash
node scripts/cap-wallet-sync.mjs --live https://YOUR-OFFICE-DOMAIN/wallet
npx cap open android
```

Στο Android Studio: άνοιξε τον φάκελο `android/` → **Run ▶** σε emulator ή USB συσκευή.

## Packaged build (από `dist/`)

```bash
npm run cap:android:packaged
```

Χωρίς `server.url` το WebView φορτώνει τα τοπικά αρχεία από το `vite build`.  
Για multi-tenant γραφεία προτίμησε το live URL μέχρι να υπάρχει office picker στο app.

## Πλοήγηση μέσα στο app

Το app ανοίγει στο **`/wallet`** (μόνο πελάτης-ταξιδιώτης).  
Η αρχική ιστοσελίδα / admin / οδηγός / rent μπλοκάρονται.

| Tab | Διαδρομή |
|-----|----------|
| Εισιτήρια | `/wallet` |
| Κράτηση | `/my-booking` |
| Λογαριασμός | `/login` |

## Αρχεία

- `capacitor.config.json` — app id / splash / live storefront URL
- `android/` — Android Studio project
- `src/components/wallet/WalletNativeShell.jsx` — bottom tabs
- `scripts/cap-wallet-sync.mjs` — build + sync helper

## Επόμενα (Driver / Rent)

Ξεχωριστά apps: `com.poreiago.driver`, `com.poreiago.rent` — ίδια τεχνική, διαφορετικό `appId` + start URL.
