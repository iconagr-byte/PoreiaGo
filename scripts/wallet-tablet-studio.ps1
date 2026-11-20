# One-shot: diagnose USB tablet + open Android Studio on android/.
# Safe to run from ANY folder (including C:\Windows\system32).
# Paste THIS one line only (normal PowerShell, not Administrator):
#   powershell -ExecutionPolicy Bypass -File C:\Users\User\poreiago\scripts\wallet-tablet-studio.ps1
# ASCII-only (no BOM) for Windows PowerShell 5.1.

param(
  [switch]$ForceStudio
)

$ErrorActionPreference = "Stop"
$repo = "C:\Users\User\poreiago"
if ($PSScriptRoot) {
  $fromScript = Split-Path -Parent $PSScriptRoot
  if (Test-Path -LiteralPath (Join-Path $fromScript "android\settings.gradle")) {
    $repo = $fromScript
  }
}
if (-not (Test-Path -LiteralPath (Join-Path $repo "android\settings.gradle"))) {
  throw "Repo not found: $repo"
}
Set-Location $repo

$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
$usbDriver = Join-Path $env:LOCALAPPDATA "Android\Sdk\extras\google\usb_driver"
$prep = Join-Path $repo "scripts\wallet-studio-prep.ps1"

function Test-IsAdmin {
  try {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  } catch {
    return $false
  }
}

Write-Host "==> PoreiaGo tablet USB -> Android Studio" -ForegroundColor Cyan
Write-Host ("cwd: " + (Get-Location)) -ForegroundColor DarkGray

if (Test-IsAdmin) {
  Write-Host "This window is Administrator PowerShell." -ForegroundColor Yellow
  Write-Host "EL: kleinste ayto to parathyro. Anoixe kanoniko PowerShell (ochi Run as admin)." -ForegroundColor Yellow
}

if (-not (Test-Path -LiteralPath $adb)) {
  throw "adb missing: $adb  (install Android Studio platform-tools)"
}

Write-Host "==> adb kill-server / start-server" -ForegroundColor Cyan
$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $adb kill-server 2>$null | Out-Null
Start-Sleep -Seconds 2
& $adb start-server 2>$null | Out-Null
Start-Sleep -Seconds 1
$ErrorActionPreference = $prev

Write-Host "==> adb devices" -ForegroundColor Cyan
& $adb devices | Out-Host
$rows = @(
  & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\S" }
)
$usbDevice = @($rows | Where-Object { $_ -match "\tdevice$" -and $_ -notmatch "^emulator-" })
$unauthorized = @($rows | Where-Object { $_ -match "\tunauthorized$" })
$offline = @($rows | Where-Object { $_ -match "\toffline$" -and $_ -notmatch "^emulator-" })

if ($usbDevice.Count -gt 0) {
  Write-Host "OK: tablet/phone is device. Opening Android Studio on android/ ..." -ForegroundColor Green
  Write-Host "EL: to tablet fainetai. Sto Studio epilexe to tablet, meta Run." -ForegroundColor Green
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $prep -OpenStudio
  exit $LASTEXITCODE
}

if ($unauthorized.Count -gt 0) {
  Write-Host "USB is UNAUTHORIZED." -ForegroundColor Yellow
  Write-Host "EL: kseklidose to tablet. Pata Allow USB debugging (Always allow)." -ForegroundColor Yellow
  Write-Host "Then run this same one-liner again." -ForegroundColor Yellow
  exit 2
}

if ($offline.Count -gt 0) {
  Write-Host "USB is OFFLINE (not ready)." -ForegroundColor Yellow
  Write-Host "EL: vgale/vale to kalodio. USB mode = File Transfer / MTP." -ForegroundColor Yellow
  Write-Host "Then run this same one-liner again." -ForegroundColor Yellow
  exit 3
}

Write-Host ""
Write-Host "=== adb devices is EMPTY - Windows does not see the tablet ===" -ForegroundColor Red
Write-Host "EL: to tablet den fainetai. To Studio DEN tha to deiksei os device." -ForegroundColor Yellow
Write-Host ""
Write-Host "On the TABLET:" -ForegroundColor Cyan
Write-Host "  1) Settings -> About tablet -> tap Build number 7 times"
Write-Host "  2) Developer options -> USB debugging = ON"
Write-Host "  3) USB notification -> File Transfer / MTP (not Charging only)"
Write-Host "  4) Unlock the screen. If a popup appears, tap Allow"
Write-Host ""
Write-Host "On the PC:" -ForegroundColor Cyan
Write-Host "  5) Use a DATA cable (charge-only cables show empty adb)"
Write-Host "  6) Try a USB-A port on the PC (avoid hubs)"
Write-Host "  7) Device Manager (devmgmt.msc):"
Write-Host "       Other devices / Android / Unknown -> yellow mark"
Write-Host "       right-click -> Update driver -> Browse my computer"
Write-Host ("       " + $usbDriver)
if (-not (Test-Path -LiteralPath $usbDriver)) {
  Write-Host "     Google USB Driver is NOT installed yet:" -ForegroundColor Yellow
  Write-Host "       Android Studio -> SDK Manager -> SDK Tools"
  Write-Host "       check Google USB Driver -> Apply"
}
Write-Host "  8) Close Administrator PowerShell. Open a normal PowerShell."
Write-Host "  9) Run the same one-liner again:"
Write-Host "       powershell -ExecutionPolicy Bypass -File C:\Users\User\poreiago\scripts\wallet-tablet-studio.ps1" -ForegroundColor Cyan
Write-Host ""

if ($ForceStudio) {
  Write-Host "-ForceStudio: opening Studio anyway (device list will be empty)." -ForegroundColor DarkYellow
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $prep -OpenStudio
}

exit 1
