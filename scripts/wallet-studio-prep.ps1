# PoreiaGo — prep Android Studio after a clean wallet build (or before first Studio open).
# Clears stale Run configs that often cause: Error running 'app' / Unknown error.
# Does NOT install the APK — use wallet-run.ps1 for that. Studio is for debug/logs.
#
# Usage (PowerShell):
#   cd C:\Users\User\poreiago
#   git fetch origin main; git checkout main; git pull origin main
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-studio-prep.ps1
# ASCII-only (no BOM) for Windows PowerShell 5.1.

param(
  [switch]$SyncFirst
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $repo "android\settings.gradle"))) {
  $repo = "C:\Users\User\poreiago"
}
Set-Location $repo

$androidDir = Join-Path $repo "android"
$assetsIndex = Join-Path $androidDir "app\src\main\assets\public\index.html"
$runConfigs = Join-Path $androidDir ".idea\runConfigurations"
$workspace = Join-Path $androidDir ".idea\workspace.xml"

Write-Host "==> PoreiaGo Studio prep" -ForegroundColor Cyan

if ($SyncFirst) {
  Write-Host "==> npm run cap:sync:packaged" -ForegroundColor Cyan
  npm.cmd run cap:sync:packaged
  if ($LASTEXITCODE -ne 0) { throw "cap:sync:packaged failed" }
}

if (-not (Test-Path -LiteralPath $assetsIndex)) {
  Write-Host "Missing android/app/src/main/assets/public/index.html" -ForegroundColor Red
  Write-Host "Run first: powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1" -ForegroundColor Yellow
  throw "Empty Capacitor assets — sync/build required before Studio"
}
Write-Host "OK: packaged assets present" -ForegroundColor Green

# Stale/wrong module names in local Run configs → Studio toast "Unknown error".
# Stale module names (e.g. android.app.main) → Studio toast "Unknown error".
# Shared repo config uses poreiago.app.main (settings.gradle rootProject.name).
$repoCfg = Join-Path $runConfigs "app.xml"
$shippedCfg = Join-Path $repo "android\.idea\runConfigurations\app.xml"
if (Test-Path -LiteralPath $runConfigs) {
  Get-ChildItem -LiteralPath $runConfigs -Filter "*.xml" -ErrorAction SilentlyContinue |
    ForEach-Object {
      Write-Host ("==> remove stale Run config: " + $_.Name) -ForegroundColor DarkYellow
      Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
    }
}
New-Item -ItemType Directory -Path $runConfigs -Force | Out-Null
if (Test-Path -LiteralPath $shippedCfg) {
  Copy-Item -LiteralPath $shippedCfg -Destination $repoCfg -Force
  Write-Host ("OK: restored shared Run config → " + $repoCfg) -ForegroundColor Green
} else {
  Write-Host "WARN: shipped app.xml missing — Studio will recreate after Gradle sync" -ForegroundColor Yellow
}

if (Test-Path -LiteralPath $workspace) {
  Write-Host "==> note: close Studio before prep if it was open (avoids rewrite fights)" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "Next in Android Studio:" -ForegroundColor Cyan
Write-Host "  1) File → Close Project (if something else is open)"
Write-Host "  2) File → Open → select folder: $androidDir"
Write-Host "     (NOT the repo root poreiago)"
Write-Host "  3) Wait for Gradle sync (bottom status bar)"
Write-Host "  4) Settings → Build Tools → Gradle:"
Write-Host "       Use Gradle from = gradle-wrapper.properties (8.14.3)"
Write-Host "       Gradle JDK = jbr-21 (17 or 21 only — not 25)"
Write-Host "  5) Device Manager → start an AVD → wait for home screen"
Write-Host "     OR plug phone with USB debugging"
Write-Host "  6) Top toolbar: pick that device (not 'No Devices')"
Write-Host "  7) Run ▶ only if you need Studio debugger"
Write-Host "     Prefer: already-running app from wallet-run.ps1 + Logcat"
Write-Host ""
Write-Host "If toast = Error running 'app' / Unknown error:" -ForegroundColor Yellow
Write-Host "  Run → Edit Configurations… → app → Module → choose the app module → Apply → OK"
Write-Host "  Then pick a device again and Run."
Write-Host "  Or skip Studio Run and use wallet-run.ps1 / wallet-boot-and-install.ps1"
Write-Host ""
Write-Host "DONE - Studio prep ready." -ForegroundColor Green
