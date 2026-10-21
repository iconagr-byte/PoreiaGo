# Start first available AVD (if needed), then install PoreiaGo Wallet APK.
# Usage (ONE short line - do not paste multi-line blocks):
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-boot-and-install.ps1
# Optional: -WaitMinutes 5
# ASCII-only (no BOM) for Windows PowerShell 5.1.

param(
  [double]$WaitMinutes = 3
)

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
  throw "APK missing. First run: powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1"
}

function Get-OnlineDevice {
  return @(
    & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
  )
}

& $adb start-server | Out-Null
$online = Get-OnlineDevice
if (-not $online -or $online.Count -eq 0) {
  Write-Host "NO DEVICE: adb devices is empty." -ForegroundColor Yellow
  Write-Host "Will try to start the first AVD. Or: Device Manager -> Play, or USB phone + debugging." -ForegroundColor Yellow
  $avds = @(& $emu -list-avds 2>$null | Where-Object { $_.Trim() -ne "" })
  if (-not $avds -or $avds.Count -eq 0) {
    throw "No AVDs found. In Android Studio Device Manager create Medium Phone, wait for home screen, then rerun."
  }
  $avd = $avds[0]
  Write-Host ("==> starting AVD: " + $avd) -ForegroundColor Cyan
  Start-Process -FilePath $emu -ArgumentList @("-avd", $avd, "-netdelay", "none", "-netspeed", "full")
} else {
  Write-Host "==> emulator/device already online" -ForegroundColor Green
}

$waitMins = $WaitMinutes
if ($waitMins -lt 0.5) { $waitMins = 0.5 }
Write-Host ("==> waiting for adb device (up to " + $waitMins + " min)...") -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes($waitMins)
$emptyHintShown = $false
while ((Get-Date) -lt $deadline) {
  & $adb devices | Out-Host
  $online = Get-OnlineDevice
  if ($online -and $online.Count -gt 0) { break }
  if (-not $emptyHintShown) {
    Write-Host "Still empty - wait for emulator home screen (or unlock USB phone)..." -ForegroundColor DarkYellow
    $emptyHintShown = $true
  }
  Start-Sleep -Seconds 4
}
if (-not $online -or $online.Count -eq 0) {
  Write-Host ""
  Write-Host "Timed out: no device in 'adb devices'." -ForegroundColor Red
  Write-Host "  Android Studio -> Device Manager -> Play / Cold Boot Now" -ForegroundColor Yellow
  Write-Host "  OR phone: USB debugging ON, accept RSA prompt" -ForegroundColor Yellow
  Write-Host ("  Then: adb install -r `"$apk`"") -ForegroundColor Cyan
  throw "Emulator never became 'device'. Wait for home screen and rerun this script."
}

# Give system UI a moment after adb says device
Start-Sleep -Seconds 8

Write-Host "==> install + launch My Wallet" -ForegroundColor Cyan
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $adb shell am force-stop com.poreiago.wallet 2>$null | Out-Null
& $adb uninstall com.poreiago.wallet 2>$null | Out-Null
$ErrorActionPreference = $prevEap
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { throw "adb install failed" }
& $adb shell am start -n "com.poreiago.wallet/com.poreiago.wallet.MainActivity"
if ($LASTEXITCODE -ne 0) { throw "failed to start MainActivity" }

Write-Host "DONE - My Wallet should be open. Do not press Studio Run." -ForegroundColor Green
