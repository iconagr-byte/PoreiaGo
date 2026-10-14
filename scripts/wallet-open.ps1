# Force-stop, install latest APK, launch My Wallet. No Studio.
# Usage (ONE line, from anywhere):
#   powershell -ExecutionPolicy Bypass -File C:\Users\User\poreiago\scripts\wallet-open.ps1

$ErrorActionPreference = "Stop"
$repo = "C:\Users\User\poreiago"
Set-Location $repo

$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$adb = Join-Path $sdk "platform-tools\adb.exe"
$emu = Join-Path $sdk "emulator\emulator.exe"
$apk = Join-Path $repo "android\app\build\outputs\apk\debug\app-debug.apk"
$pkg = "com.poreiago.wallet"
$activity = "com.poreiago.wallet/.MainActivity"

if (-not (Test-Path -LiteralPath $adb)) { throw "adb missing: $adb" }
if (-not (Test-Path -LiteralPath $apk)) {
  throw "APK missing. Run first: powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1"
}

function Get-OnlineDevice {
  return @(
    & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
  )
}

Write-Host "==> adb restart (clears offline emulator-5554)" -ForegroundColor Cyan
& $adb kill-server 2>$null
Start-Sleep -Seconds 1
& $adb start-server | Out-Null
Start-Sleep -Seconds 1

$online = Get-OnlineDevice
if (-not $online -or $online.Count -eq 0) {
  # Stuck "offline" ghost — disconnect and try again
  & $adb disconnect 2>$null | Out-Null
  & $adb kill-server 2>$null
  Start-Sleep -Seconds 1
  & $adb start-server | Out-Null

  $online = Get-OnlineDevice
  if (-not $online -or $online.Count -eq 0) {
    if (-not (Test-Path -LiteralPath $emu)) { throw "emulator missing and no device online" }
    $avds = @(& $emu -list-avds 2>$null | Where-Object { $_.Trim() -ne "" })
    if (-not $avds -or $avds.Count -eq 0) {
      throw "No device. Start Medium Phone in Device Manager, wait for home screen, rerun."
    }
    Write-Host ("==> starting AVD: " + $avds[0]) -ForegroundColor Cyan
    Start-Process -FilePath $emu -ArgumentList @("-avd", $avds[0], "-netdelay", "none", "-netspeed", "full")
  }
}

Write-Host "==> waiting for device (up to 3 min)..." -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes(3)
while ((Get-Date) -lt $deadline) {
  & $adb devices | Out-Host
  $online = Get-OnlineDevice
  if ($online -and $online.Count -gt 0) { break }
  Start-Sleep -Seconds 4
}
if (-not $online -or $online.Count -eq 0) {
  throw "Still offline. Close emulator window, then: Device Manager → Cold Boot Now → wait for home → rerun this script."
}

Write-Host "==> uninstall + install" -ForegroundColor Cyan
& $adb shell am force-stop $pkg 2>$null
& $adb uninstall $pkg 2>$null
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { throw "adb install failed — copy the red error above" }

Write-Host "==> launch My Wallet" -ForegroundColor Cyan
& $adb shell am start -n $activity
if ($LASTEXITCODE -ne 0) {
  Write-Host "am start failed — trying launcher monkey..." -ForegroundColor Yellow
  & $adb shell monkey -p $pkg -c android.intent.category.LAUNCHER 1
  if ($LASTEXITCODE -ne 0) { throw "could not launch app" }
}

Start-Sleep -Seconds 2
$pidLine = & $adb shell pidof $pkg 2>$null
if (-not $pidLine) {
  Write-Host "WARN: process not running — checking crash log..." -ForegroundColor Yellow
  & $adb logcat -d -t 80 AndroidRuntime:E Capacitor:E chromium:E *:S | Out-Host
  throw "App installed but crashed on open. Paste the logcat lines above."
}

Write-Host ("DONE - Wallet running (pid " + $pidLine.Trim() + "). Do NOT press Studio Run.") -ForegroundColor Green
