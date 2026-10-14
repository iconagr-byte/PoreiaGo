# Start first available AVD (if needed), then install PoreiaGo Wallet APK.
# Usage (ONE short line — do not paste multi-line blocks):
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-boot-and-install.ps1

$ErrorActionPreference = "Stop"
$repo = "C:\Users\User\poreiago"
Set-Location $repo

$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$adb = Join-Path $sdk "platform-tools\adb.exe"
$emu = Join-Path $sdk "emulator\emulator.exe"
$apk = Join-Path $repo "android\app\build\outputs\apk\debug\app-debug.apk"

if (-not (Test-Path -LiteralPath $adb)) { throw "adb missing: $adb" }
if (-not (Test-Path -LiteralPath $emu)) { throw "emulator missing: $emu" }
if (-not (Test-Path -LiteralPath $apk)) {
  throw "APK missing. First run: powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1 -JavaHome `"$env:USERPROFILE\.jdks\jbr-21.0.11`""
}

function Get-OnlineDevice {
  return @(
    & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
  )
}

& $adb start-server | Out-Null
$online = Get-OnlineDevice
if (-not $online -or $online.Count -eq 0) {
  $avds = @(& $emu -list-avds 2>$null | Where-Object { $_.Trim() -ne "" })
  if (-not $avds -or $avds.Count -eq 0) {
    throw "No AVDs found. In Android Studio Device Manager create Medium Phone, then rerun."
  }
  $avd = $avds[0]
  Write-Host ("==> starting AVD: " + $avd) -ForegroundColor Cyan
  Start-Process -FilePath $emu -ArgumentList @("-avd", $avd, "-netdelay", "none", "-netspeed", "full")
} else {
  Write-Host "==> emulator already online" -ForegroundColor Green
}

Write-Host "==> waiting for adb device (up to 3 min)..." -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes(3)
while ((Get-Date) -lt $deadline) {
  & $adb devices | Out-Host
  $online = Get-OnlineDevice
  if ($online -and $online.Count -gt 0) { break }
  Start-Sleep -Seconds 4
}
if (-not $online -or $online.Count -eq 0) {
  throw "Emulator never became 'device'. Wait for home screen and rerun this script."
}

# Give system UI a moment after adb says device
Start-Sleep -Seconds 8

Write-Host "==> install + launch My Wallet" -ForegroundColor Cyan
& $adb shell am force-stop com.poreiago.wallet 2>$null
& $adb uninstall com.poreiago.wallet 2>$null
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { throw "adb install failed" }
& $adb shell am start -n "com.poreiago.wallet/com.poreiago.wallet.MainActivity"
if ($LASTEXITCODE -ne 0) { throw "failed to start MainActivity" }

Write-Host "DONE - My Wallet should be open. Do not press Studio Run." -ForegroundColor Green
