# Install already-built PoreiaGo Wallet APK onto a USB tablet/phone or emulator.
# USB serial is preferred when both are connected (ANDROID_SERIAL).
# Usage (ONE line):
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-install.ps1
# Optional: -Serial <adb-serial>

param(
  [string]$Serial = ""
)

$ErrorActionPreference = "Stop"
$repo = "C:\Users\User\poreiago"
Set-Location $repo

$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
$apk = Join-Path $repo "android\app\build\outputs\apk\debug\app-debug.apk"

if (-not (Test-Path -LiteralPath $adb)) { throw "adb not found: $adb" }
if (-not (Test-Path -LiteralPath $apk)) {
  throw "APK missing. Build first: powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1 -JavaHome `"$env:USERPROFILE\.jdks\jbr-21.0.11`""
}

function Get-OnlineRows {
  return @(
    & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
  )
}

function Get-PreferredSerial {
  if ($Serial) { return $Serial }
  $usb = $null
  $emuSerial = $null
  foreach ($r in (Get-OnlineRows)) {
    $s = ($r -split "\s+")[0]
    if (-not $s) { continue }
    if ($s -match "^emulator-") {
      if (-not $emuSerial) { $emuSerial = $s }
    } elseif (-not $usb) {
      $usb = $s
    }
  }
  if ($usb) { return $usb }
  return $emuSerial
}

& $adb start-server
Write-Host "==> waiting for USB tablet/phone or emulator (up to 3 min)..." -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes(3)
$online = $null
$emptyHintShown = $false
while ((Get-Date) -lt $deadline) {
  & $adb devices | Out-Host
  $online = Get-OnlineRows
  if ($online) { break }
  if (-not $emptyHintShown) {
    Write-Host "NO DEVICE yet. Unlock tablet, tap Allow USB debugging, USB = File Transfer." -ForegroundColor Yellow
    Write-Host "EL: sto tablet pata Allow. USB mode = File Transfer / MTP." -ForegroundColor Yellow
    Write-Host "Or Device Manager -> Play (home screen)." -ForegroundColor Yellow
    $emptyHintShown = $true
  }
  Start-Sleep -Seconds 3
}
if (-not $online) {
  throw "No tablet/phone/emulator online. Allow USB debugging, wait for adb devices = device."
}

$target = Get-PreferredSerial
if ($target) {
  $env:ANDROID_SERIAL = $target
  $kind = "emulator"
  if ($target -notmatch "^emulator-") { $kind = "USB tablet/phone" }
  Write-Host ("==> adb target " + $target + " (" + $kind + ")") -ForegroundColor Green
}

Write-Host "==> install + launch" -ForegroundColor Cyan
& $adb shell am force-stop com.poreiago.wallet 2>$null
& $adb uninstall com.poreiago.wallet 2>$null
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { throw "install failed" }
& $adb shell am start -n "com.poreiago.wallet/com.poreiago.wallet.MainActivity"
Write-Host "DONE - My Wallet should be open on the tablet/emulator." -ForegroundColor Green
