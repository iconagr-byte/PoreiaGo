# PoreiaGo Wallet - Android (Capacitor)

Native shell **mono gia My Wallet** (eisitiria + QR).  
**Den** anoigei tin istoselida, admin, odigo i rent.

App id: `com.poreiago.wallet` · onoma: **PoreiaGo Wallet**

## Proapaitoumena

- Android Studio
- Gradle JDK **21** (oxi 25)
- Node 20+ / npm
- Emulator (Pixel 6 · API 34) i USB device

## Build (PowerShell - mia grammi ti fora)

```powershell
cd C:\Users\User\poreiago
git fetch origin
git reset --hard origin/cursor/wallet-android-capacitor-5ffb
powershell -ExecutionPolicy Bypass -File .\scripts\wallet-android-fix.ps1
```

To script kanei: sync packaged + `gradlew assembleDebug`.  
An to Gradle petyxei, vlepeis `BUILD OK` kai path tou APK.

## Android Studio Run

1. **File -> Open** -> `C:\Users\User\poreiago\android` (oxi to root)
2. Perimene Gradle sync
3. **Settings -> Build Tools -> Gradle -> Gradle JDK = 21**
4. **Tools -> Device Manager** -> Play sto emulator
5. Panw sti mpara na fainetai to onoma tou emulator -> **Run**

## An trexei `Error running 'app' / Unknown error`

To Unknown error einai sxedon panta **xoris emulator** i **lathos JDK**.

1. Device Manager -> start emulator (an den yparxei: Create Device -> Pixel 6 -> API 34)
2. Gradle JDK = 21
3. Build -> Clean Project -> Rebuild Project
4. File -> Invalidate Caches -> Restart
5. Manual install (emulator trexei):

```powershell
adb install -r C:\Users\User\poreiago\android\app\build\outputs\apk\debug\app-debug.apk
```

6. View -> Tool Windows -> **Build** / **Run** gia to pragmatiko kokkino log

## Ti fainetai sto app

| Othoni | Path |
|--------|------|
| My Wallet login / tickets | `/wallet` -> `/login` |
| Eyresi kratisis | `/my-booking` |

Krymena: Arxiki, Leoforeia storefront, Rent, admin, driver.

## Min kaneis

- `cap:sync:live` (fortonei to site)
- Open tou root `poreiago` anti gia `android`
- Run xoris epilegmeno emulator
