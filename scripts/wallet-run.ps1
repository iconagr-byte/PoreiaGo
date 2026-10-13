# PoreiaGo Wallet - build + install on running emulator
# Usage (ONE line):
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1
# Optional SDK path:
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1 -Sdk "C:\Users\User\AppData\Local\Android\Sdk"

param(
  [string]$Sdk = ""
)

$ErrorActionPreference = "Stop"
$repo = "C:\Users\User\poreiago"
Set-Location $repo

# Always clear broken ANDROID_HOME=C
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
  throw "adb not found at $adb - set -Sdk to your Android SDK Location from Android Studio"
}

$env:JAVA_HOME = $java
$env:ANDROID_HOME = $Sdk
$env:ANDROID_SDK_ROOT = $Sdk
Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host "ANDROID_HOME=$env:ANDROID_HOME"

$sdkSlash = $Sdk -replace '\\', '/'
Set-Content -Path (Join-Path $repo "android\local.properties") -Value ("sdk.dir=" + $sdkSlash) -Encoding ASCII

git fetch origin cursor/wallet-android-capacitor-5ffb
git reset --hard origin/cursor/wallet-android-capacitor-5ffb

npm.cmd run cap:sync:packaged
if ($LASTEXITCODE -ne 0) { throw "sync failed" }

Set-Location (Join-Path $repo "android")
& .\gradlew.bat --no-daemon assembleDebug
if ($LASTEXITCODE -ne 0) { throw "build failed" }

$apk = Join-Path $repo "android\app\build\outputs\apk\debug\app-debug.apk"
& $adb start-server
& $adb devices
$online = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "device$" }
if (-not $online) {
  throw "Emulator not online. In Android Studio start Medium Phone API 37, wait for home screen, rerun this script."
}
& $adb uninstall com.poreiago.wallet 2>$null
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { throw "install failed" }
& $adb shell am start -n "com.poreiago.wallet/com.poreiago.wallet.MainActivity"
Write-Host "DONE - Wallet should open on emulator" -ForegroundColor Green
