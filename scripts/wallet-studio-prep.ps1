# PoreiaGo - prep Android Studio after a clean wallet build (or before first Studio open).
# Clears stale Run configs that often cause: Error running 'app' / Unknown error.
# For a USB tablet, pick that device in the toolbar then Run.
# If Run toasts Unknown error, use wallet-run.ps1 (USB is preferred over emulator).
#
# Usage (PowerShell):
#   cd C:\Users\User\poreiago
#   git fetch origin main; git checkout main; git pull origin main
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-studio-prep.ps1
# Optional:
#   -SyncFirst     (cap:sync:packaged before opening Studio)
#   -OpenStudio    (launch Android Studio on the android/ folder)
# ASCII-only (no BOM) for Windows PowerShell 5.1.

param(
  [switch]$SyncFirst,
  [switch]$OpenStudio
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
$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"

Write-Host "==> PoreiaGo Studio prep" -ForegroundColor Cyan

if ($SyncFirst) {
  Write-Host "==> npm run cap:sync:packaged" -ForegroundColor Cyan
  npm.cmd run cap:sync:packaged
  if ($LASTEXITCODE -ne 0) { throw "cap:sync:packaged failed" }
}

if (-not (Test-Path -LiteralPath $assetsIndex)) {
  Write-Host "Missing android/app/src/main/assets/public/index.html" -ForegroundColor Red
  Write-Host "Run first: powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1" -ForegroundColor Yellow
  throw "Empty Capacitor assets - sync/build required before Studio"
}
Write-Host "OK: packaged assets present" -ForegroundColor Green

# Stale/wrong module names in local Run configs -> Studio toast "Unknown error".
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
  Write-Host ("OK: restored shared Run config -> " + $repoCfg) -ForegroundColor Green
} else {
  Write-Host "WARN: shipped app.xml missing - Studio will recreate after Gradle sync" -ForegroundColor Yellow
}

if (Test-Path -LiteralPath $workspace) {
  Write-Host "==> note: close Studio before prep if it was open (avoids rewrite fights)" -ForegroundColor DarkYellow
}

if (Test-Path -LiteralPath $adb) {
  Write-Host "==> adb devices" -ForegroundColor Cyan
  & $adb start-server | Out-Null
  & $adb devices | Out-Host
  $usbDevice = @(
    & $adb devices | Select-Object -Skip 1 | Where-Object {
      $_ -match "\tdevice$" -and $_ -notmatch "^emulator-"
    }
  )
  $unauthorized = @(
    & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tunauthorized$" }
  )
  if ($usbDevice.Count -gt 0) {
    Write-Host "OK: USB tablet/phone is device - pick it in the Studio toolbar." -ForegroundColor Green
    Write-Host "EL: to tablet einai etoimo. Sto Studio epilexe ayto to device, meta Run." -ForegroundColor Green
  } elseif ($unauthorized.Count -gt 0) {
    Write-Host "USB listed as unauthorized." -ForegroundColor Yellow
    Write-Host "EL: sto tablet pata Allow USB debugging (epitrepre ayton ton ypologisti)." -ForegroundColor Yellow
    Write-Host "    USB mode = File Transfer / MTP (ochi Charging only)." -ForegroundColor Yellow
  } else {
    Write-Host "No USB tablet in state device yet." -ForegroundColor Yellow
    Write-Host "EL: syndese to tablet, Developer options -> USB debugging ON, pata Allow." -ForegroundColor Yellow
  }
} else {
  Write-Host ("WARN: adb missing: " + $adb) -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Tablet + Android Studio:" -ForegroundColor Cyan
Write-Host "  1) Tablet: Settings -> About tablet -> tap Build number 7 times"
Write-Host "  2) Developer options -> USB debugging ON"
Write-Host "  3) USB cable, USB mode = File Transfer / MTP (not Charging only)"
Write-Host "  4) Unlock tablet -> tap Allow USB debugging (Always allow this computer)"
Write-Host "  5) File -> Close Project (if something else is open)"
Write-Host "  6) File -> Open -> select folder: $androidDir"
Write-Host "     (NOT the repo root poreiago)"
Write-Host "  7) Wait for Gradle sync (bottom status bar)"
Write-Host "  8) Settings -> Build Tools -> Gradle:"
Write-Host "       Use Gradle from = gradle-wrapper.properties (8.14.3)"
Write-Host "       Gradle JDK = jbr-21 (17 or 21 only - not 25)"
Write-Host "  9) Top toolbar: pick the tablet (not emulator, not 'No Devices')"
Write-Host " 10) Run (green triangle) - module poreiago.app.main"
Write-Host ""
Write-Host "If toast = Error running 'app' / Unknown error:" -ForegroundColor Yellow
Write-Host "  Run -> Edit Configurations... -> app -> Module -> poreiago.app.main -> Apply -> OK"
Write-Host "  Then pick the tablet again and Run."
Write-Host "  Or skip Studio Run:"
Write-Host "    powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1"
Write-Host "  (USB tablet is preferred over emulator)"
Write-Host ""

if ($OpenStudio) {
  $studioCandidates = @()
  if ($env:ProgramFiles) {
    $studioCandidates += (Join-Path $env:ProgramFiles "Android\Android Studio\bin\studio64.exe")
  }
  $pf86 = ${env:ProgramFiles(x86)}
  if ($pf86) {
    $studioCandidates += (Join-Path $pf86 "Android\Android Studio\bin\studio64.exe")
  }
  if ($env:LOCALAPPDATA) {
    $studioCandidates += (Join-Path $env:LOCALAPPDATA "Programs\Android Studio\bin\studio64.exe")
  }
  $studio = $studioCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  if ($studio) {
    Write-Host ("==> opening Android Studio: " + $studio) -ForegroundColor Cyan
    Write-Host ("    project: " + $androidDir) -ForegroundColor Cyan
    Start-Process -FilePath $studio -ArgumentList @($androidDir)
  } else {
    Write-Host "Android Studio exe not found - open folder manually:" -ForegroundColor Yellow
    Write-Host ("  " + $androidDir) -ForegroundColor Yellow
  }
}

Write-Host "DONE - Studio prep ready. Pick the tablet, then Run." -ForegroundColor Green
