# PoreiaGo Wallet - Windows helper (packaged My Wallet only)
# Usage (PowerShell) - ONE line at a time:
#   cd C:\Users\User\poreiago
#   git fetch origin
#   git reset --hard origin/cursor/wallet-android-capacitor-5ffb
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-android-fix.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Assert-Ok($code, $msg) {
  if ($code -ne 0) { throw $msg }
}

Write-Host "==> discard local capacitor.config.json" -ForegroundColor Cyan
git checkout -- capacitor.config.json 2>$null
git restore capacitor.config.json 2>$null

Write-Host "==> ensure wallet Android branch" -ForegroundColor Cyan
git fetch origin cursor/wallet-android-capacitor-5ffb
Assert-Ok $LASTEXITCODE "git fetch failed"
git checkout cursor/wallet-android-capacitor-5ffb
Assert-Ok $LASTEXITCODE "checkout branch failed"
git reset --hard origin/cursor/wallet-android-capacitor-5ffb
Assert-Ok $LASTEXITCODE "git reset --hard failed"

Write-Host "==> npm install" -ForegroundColor Cyan
npm.cmd install
Assert-Ok $LASTEXITCODE "npm install failed"

Write-Host "==> cap:sync:packaged (My Wallet only)" -ForegroundColor Cyan
npm.cmd run cap:sync:packaged
Assert-Ok $LASTEXITCODE "cap:sync:packaged failed"

$cfgPath = Join-Path $root "android\app\src\main\assets\capacitor.config.json"
if (-not (Test-Path $cfgPath)) {
  throw "ERROR: missing $cfgPath - sync did not copy assets"
}
$cfg = Get-Content $cfgPath -Raw
if ($cfg -match '"server"') {
  throw "ERROR: capacitor.config still has server.url - packaged sync failed"
}

$androidDir = Join-Path $root "android"
$gradlew = Join-Path $androidDir "gradlew.bat"
if (-not (Test-Path $gradlew)) {
  throw "ERROR: missing android\gradlew.bat"
}

Write-Host "==> Gradle assembleDebug (shows real build errors)" -ForegroundColor Cyan
Push-Location $androidDir
try {
  & .\gradlew.bat --no-daemon assembleDebug
  Assert-Ok $LASTEXITCODE "Gradle assembleDebug failed - copy the red lines above"
} finally {
  Pop-Location
}

$apk = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apk)) {
  throw "ERROR: APK not found at $apk"
}

Write-Host ""
Write-Host "BUILD OK: $apk" -ForegroundColor Green
Write-Host ""
Write-Host "Android Studio:" -ForegroundColor Green
Write-Host "  1) Close project if open"
Write-Host "  2) File -> Open -> $androidDir"
Write-Host "  3) Settings -> Build Tools -> Gradle -> Gradle JDK = 21 (not 25)"
Write-Host "  4) Tools -> Device Manager -> start emulator (Play icon)"
Write-Host "  5) Top bar must show emulator name, then Run"
Write-Host ""
Write-Host "If Run still says Unknown error, install APK manually:" -ForegroundColor Yellow
Write-Host "  adb install -r `"$apk`""
Write-Host ""
