# Start first available AVD (if needed), then install PoreiaGo Wallet APK.
# Usage (ONE short line - do not paste multi-line blocks):
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-boot-and-install.ps1
# Optional: -WaitMinutes 5
# ASCII-only (no BOM) for Windows PowerShell 5.1.
# Treats adb "offline" as NOT ready; waits for state "device" + boot_completed.

param(
  [double]$WaitMinutes = 5
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

# Only "device" is ready. "offline" / "unauthorized" are NOT ready.
function Get-OnlineDevice {
  return @(
    & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
  )
}

function Test-AdbHasOffline {
  $rows = @(
    & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\S" }
  )
  foreach ($r in $rows) {
    if ($r -match "\toffline$" -or $r -match "\tunauthorized$") { return $true }
  }
  return $false
}

function Restart-AdbServer {
  Write-Host "==> adb kill-server / start-server (clears stuck offline)" -ForegroundColor DarkYellow
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $adb kill-server 2>$null | Out-Null
  Start-Sleep -Seconds 2
  & $adb start-server 2>$null | Out-Null
  Start-Sleep -Seconds 2
  $ErrorActionPreference = $prevEap
}

function Stop-EmulatorProcesses {
  Write-Host "==> killing stuck emulator / qemu processes..." -ForegroundColor DarkYellow
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  Get-Process -Name "emulator","qemu-system-x86_64","qemu-system-aarch64","crashpad_handler" -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 3
  $ErrorActionPreference = $prevEap
}

function Start-FirstAvd([string]$reason) {
  $avds = @(& $emu -list-avds 2>$null | Where-Object { $_.Trim() -ne "" })
  if (-not $avds -or $avds.Count -eq 0) {
    throw "No AVDs found. In Android Studio Device Manager create Medium Phone, wait for home screen, then rerun."
  }
  Write-Host ("==> " + $reason + ": AVD " + $avds[0]) -ForegroundColor Cyan
  Start-Process -FilePath $emu -ArgumentList @("-avd", $avds[0], "-netdelay", "none", "-netspeed", "full")
  return $avds[0]
}

function Show-InstallTimeoutHelp([string]$apkPath) {
  Write-Host ""
  Write-Host "=== TIMEOUT: no adb device in state 'device' ===" -ForegroundColor Red
  Write-Host "EN: emulator-5554 offline is NOT ready. Wait for home screen, or recover below." -ForegroundColor Yellow
  Write-Host "EL: to emulator-5554 offline DEN einai etoimo. Perimenete home screen, i kanete recover." -ForegroundColor Yellow
  Write-Host ""
  Write-Host ("APK ready: " + $apkPath) -ForegroundColor Green
  Write-Host "Exact install (after device is online):" -ForegroundColor Cyan
  Write-Host ("  & `"$adb`" install -r `"$apkPath`"") -ForegroundColor Cyan
  Write-Host ("  & `"$adb`" shell am start -n com.poreiago.wallet/com.poreiago.wallet.MainActivity") -ForegroundColor Cyan
  Write-Host ""
  Write-Host "If stuck OFFLINE:" -ForegroundColor Yellow
  Write-Host "  1) Close emulator window" -ForegroundColor Yellow
  Write-Host "  2) Device Manager -> Cold Boot Now (or Wipe Data)" -ForegroundColor Yellow
  Write-Host "  3) Wait for home screen, then rerun this script" -ForegroundColor Yellow
  Write-Host ("  Or: & `"$adb`" kill-server; & `"$adb`" start-server; & `"$adb`" devices") -ForegroundColor Cyan
  Write-Host ""
}

& $adb start-server | Out-Null
$online = Get-OnlineDevice
$hasOffline = Test-AdbHasOffline

if ($hasOffline) {
  Write-Host "adb shows OFFLINE (not ready). Only state 'device' can install." -ForegroundColor Yellow
  Write-Host "EL: to emulator einai offline - den einai etoimo gia install." -ForegroundColor Yellow
  Restart-AdbServer
  $online = Get-OnlineDevice
  $hasOffline = Test-AdbHasOffline
  if ($hasOffline -or (-not $online -or $online.Count -eq 0)) {
    Stop-EmulatorProcesses
    Restart-AdbServer
    [void](Start-FirstAvd "relaunch after offline")
  }
} elseif (-not $online -or $online.Count -eq 0) {
  Write-Host "NO DEVICE: adb devices is empty." -ForegroundColor Yellow
  Write-Host "Will try to start the first AVD. Or: Device Manager -> Play, or USB phone + debugging." -ForegroundColor Yellow
  [void](Start-FirstAvd "starting")
} else {
  Write-Host "==> emulator/device already online (state device)" -ForegroundColor Green
}

$waitMins = $WaitMinutes
if ($waitMins -lt 0.5) { $waitMins = 0.5 }
Write-Host ("==> waiting for adb state 'device' (up to " + $waitMins + " min)...") -ForegroundColor Cyan
Write-Host "    (offline / unauthorized do NOT count as ready)" -ForegroundColor DarkGray
$deadline = (Get-Date).AddMinutes($waitMins)
$emptyHintShown = $false
$offlineHintShown = $false
$adbRestartedOnce = $false
$emuRelaunchedOnce = $false
$lastWaitForDevice = (Get-Date).AddSeconds(-30)

while ((Get-Date) -lt $deadline) {
  & $adb devices | Out-Host
  $online = Get-OnlineDevice
  if ($online -and $online.Count -gt 0) { break }

  $stuckOffline = Test-AdbHasOffline
  if ($stuckOffline) {
    if (-not $offlineHintShown) {
      Write-Host "Still OFFLINE - not ready. Will try adb restart / emulator relaunch..." -ForegroundColor DarkYellow
      Write-Host "EL: akoma offline - den einai etoimo." -ForegroundColor DarkYellow
      $offlineHintShown = $true
    }
    if (-not $adbRestartedOnce) {
      Restart-AdbServer
      $adbRestartedOnce = $true
      continue
    }
    if (-not $emuRelaunchedOnce) {
      Stop-EmulatorProcesses
      Restart-AdbServer
      [void](Start-FirstAvd "cold relaunch (was stuck offline)")
      $emuRelaunchedOnce = $true
      Start-Sleep -Seconds 5
      continue
    }
  } elseif (-not $emptyHintShown) {
    Write-Host "Still empty - wait for emulator home screen (or unlock USB phone)..." -ForegroundColor DarkYellow
    $emptyHintShown = $true
  }

  if (((Get-Date) - $lastWaitForDevice).TotalSeconds -ge 20) {
    Write-Host "==> adb wait-for-device (20s nudge)..." -ForegroundColor DarkGray
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $wJob = Start-Job -ScriptBlock {
      param($adbPath)
      & $adbPath wait-for-device
    } -ArgumentList $adb
    Wait-Job $wJob -Timeout 18 | Out-Null
    if ($wJob.State -eq "Running") { Stop-Job $wJob -ErrorAction SilentlyContinue }
    Remove-Job $wJob -Force -ErrorAction SilentlyContinue
    $ErrorActionPreference = $prevEap
    $lastWaitForDevice = Get-Date
  }

  Start-Sleep -Seconds 4
}

if (-not $online -or $online.Count -eq 0) {
  Show-InstallTimeoutHelp $apk
  throw "Emulator never became 'device' (offline is not ready). Cold Boot / Wipe Data, wait for home, rerun."
}

Write-Host "==> waiting for sys.boot_completed=1 ..." -ForegroundColor Cyan
$bootDeadline = (Get-Date).AddMinutes(2)
while ((Get-Date) -lt $bootDeadline) {
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $boot = (& $adb shell getprop sys.boot_completed 2>$null | Out-String).Trim()
  $ErrorActionPreference = $prevEap
  if ($boot -eq "1") {
    Write-Host "OK: boot_completed=1" -ForegroundColor Green
    break
  }
  Start-Sleep -Seconds 3
}

Write-Host "==> waiting for PackageManager (cmd package) ..." -ForegroundColor Cyan
$pkgDeadline = (Get-Date).AddMinutes(3)
$pkgOk = $false
while ((Get-Date) -lt $pkgDeadline) {
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $pkgOut = (& $adb shell cmd package list packages 2>&1 | Out-String)
  $pkgCode = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  if ($pkgCode -eq 0 -and $pkgOut -match "(?m)^package:" -and $pkgOut -notmatch "Can't find service:\s*package") {
    Write-Host "OK: package service ready" -ForegroundColor Green
    $pkgOk = $true
    break
  }
  Start-Sleep -Seconds 3
}
if (-not $pkgOk) {
  Write-Host "WARN: package service missing - Cold Boot the AVD if install fails" -ForegroundColor Yellow
}

# Give system UI a moment after boot
Start-Sleep -Seconds 3

Write-Host "==> install + launch My Wallet" -ForegroundColor Cyan
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $adb shell am force-stop com.poreiago.wallet 2>$null | Out-Null
& $adb uninstall com.poreiago.wallet 2>$null | Out-Null
$ErrorActionPreference = $prevEap
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) {
  Write-Host "install failed - retry after adb restart..." -ForegroundColor Yellow
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $adb kill-server 2>$null | Out-Null
  Start-Sleep -Seconds 2
  & $adb start-server 2>$null | Out-Null
  Start-Sleep -Seconds 3
  $ErrorActionPreference = $prevEap
  & $adb wait-for-device
  & $adb install -r $apk
}
if ($LASTEXITCODE -ne 0) {
  Write-Host "=== Can't find service: package? Cold Boot the AVD, wait for home, rerun this script. ===" -ForegroundColor Red
  throw "adb install failed"
}
& $adb shell am start -n "com.poreiago.wallet/com.poreiago.wallet.MainActivity"
if ($LASTEXITCODE -ne 0) { throw "failed to start MainActivity" }

Write-Host "DONE - My Wallet should be open. Do not press Studio Run." -ForegroundColor Green
