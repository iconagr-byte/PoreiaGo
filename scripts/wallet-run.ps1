# PoreiaGo Wallet - build + install on running emulator
# Usage (ONE line):
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1

param(
  [string]$Sdk = ""
)

$ErrorActionPreference = "Stop"
$repo = "C:\Users\User\poreiago"
Set-Location $repo

Remove-Item Env:ANDROID_HOME -ErrorAction SilentlyContinue
Remove-Item Env:ANDROID_SDK_ROOT -ErrorAction SilentlyContinue

if (-not $Sdk) {
  $Sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}
$adb = Join-Path $Sdk "platform-tools\adb.exe"
$java = Join-Path $env:ProgramFiles "Android\Android Studio\jbr"

if (-not (Test-Path -LiteralPath (Join-Path $java "bin\java.exe"))) {
  throw "Java/JBR not found at $java"
}
if (-not (Test-Path -LiteralPath $adb)) {
  throw "adb not found at $adb - set -Sdk to your Android SDK Location"
}

$env:JAVA_HOME = $java
$env:ANDROID_HOME = $Sdk
$env:ANDROID_SDK_ROOT = $Sdk
Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host "ANDROID_HOME=$env:ANDROID_HOME"

$sdkSlash = $Sdk -replace '\\', '/'
Set-Content -Path (Join-Path $repo "android\local.properties") -Value ("sdk.dir=" + $sdkSlash) -Encoding ASCII

Write-Host "==> git fetch/reset" -ForegroundColor Cyan
git fetch origin cursor/wallet-android-capacitor-5ffb
git reset --hard origin/cursor/wallet-android-capacitor-5ffb
git log -1 --oneline

Write-Host "==> cap:sync:packaged" -ForegroundColor Cyan
npm.cmd run cap:sync:packaged
if ($LASTEXITCODE -ne 0) { throw "sync failed" }

# Prove new CSS is in the packaged assets
$cssHits = Select-String -Path (Join-Path $repo "android\app\src\main\assets\public\assets\*.css") -Pattern "pgWalletFade" -ErrorAction SilentlyContinue
if (-not $cssHits) {
  # also check index.html inline style
  $htmlHit = Select-String -Path (Join-Path $repo "android\app\src\main\assets\public\index.html") -Pattern "pgWalletFade" -ErrorAction SilentlyContinue
  if (-not $htmlHit) { throw "NEW full-bleed CSS missing from android assets - sync failed" }
}
Write-Host "OK: full-bleed fade CSS present in assets" -ForegroundColor Green

Set-Location (Join-Path $repo "android")
& .\gradlew.bat --no-daemon assembleDebug
if ($LASTEXITCODE -ne 0) { throw "build failed" }

$apk = Join-Path $repo "android\app\build\outputs\apk\debug\app-debug.apk"
& $adb start-server
& $adb devices
$online = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "device$" }
if (-not $online) {
  throw "Emulator not online. Start Medium Phone, wait for home screen, rerun."
}

Write-Host "==> wipe old app data + reinstall" -ForegroundColor Cyan
& $adb shell am force-stop com.poreiago.wallet
& $adb uninstall com.poreiago.wallet
& $adb shell pm clear com.poreiago.wallet 2>$null
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { throw "install failed" }
& $adb shell am start -n "com.poreiago.wallet/com.poreiago.wallet.MainActivity"
Write-Host "DONE - white full-screen My Wallet with fast fade" -ForegroundColor Green
