# Force-stop, (re)build if needed, install latest APK, launch My Wallet. No Studio.
# ASCII-only file (no BOM) so Windows PowerShell 5.1 always parses.
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-open.ps1 -Rebuild

param(
  [switch]$Rebuild
)

$ErrorActionPreference = "Stop"
$repo = "C:\Users\User\poreiago"
Set-Location $repo

$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$adb = Join-Path $sdk "platform-tools\adb.exe"
$emu = Join-Path $sdk "emulator\emulator.exe"
$apk = Join-Path $repo "android\app\build\outputs\apk\debug\app-debug.apk"
$assetsHtml = Join-Path $repo "android\app\src\main\assets\public\index.html"
$pkg = "com.poreiago.wallet"
$activity = "com.poreiago.wallet/com.poreiago.wallet.MainActivity"

if (-not (Test-Path -LiteralPath $adb)) { throw "adb missing: $adb" }

function Get-OnlineDevice {
  return @(
    & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
  )
}

function Test-WalletAssetsFresh {
  if (-not (Test-Path -LiteralPath $assetsHtml)) { return $false }
  $hit = Select-String -Path $assetsHtml -Pattern "replaceState|pgWalletFade" -ErrorAction SilentlyContinue
  return [bool]$hit
}

function Test-ApkHasSocialLogin([string]$apkPath) {
  if (-not (Test-Path -LiteralPath $apkPath)) { return $false }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $tmp = Join-Path $env:TEMP ("pg-open-social-" + [guid]::NewGuid().ToString("n"))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    [System.IO.Compression.ZipFile]::ExtractToDirectory($apkPath, $tmp)
    $plugins = Join-Path $tmp "assets\capacitor.plugins.json"
    if (-not (Test-Path -LiteralPath $plugins)) { return $false }
    $pluginsText = Get-Content -LiteralPath $plugins -Raw -ErrorAction SilentlyContinue
    if (-not $pluginsText -or $pluginsText -notmatch 'SocialLoginPlugin') { return $false }
    foreach ($dex in @(Get-ChildItem -LiteralPath $tmp -Filter "classes*.dex" -File -ErrorAction SilentlyContinue)) {
      $bytes = [System.IO.File]::ReadAllBytes($dex.FullName)
      $ascii = [System.Text.Encoding]::ASCII.GetString($bytes)
      if ($ascii -match 'SocialLoginPlugin' -or $ascii -match 'ee/forgr/capacitor/social/login') {
        return $true
      }
    }
    return $false
  } catch {
    return $false
  } finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$missingSocial = -not (Test-ApkHasSocialLogin $apk)
if ($missingSocial -and (Test-Path -LiteralPath $apk)) {
  Write-Host "==> APK missing SocialLoginPlugin - forcing rebuild" -ForegroundColor Yellow
}

$needBuild = $Rebuild -or $missingSocial -or (-not (Test-Path -LiteralPath $apk)) -or (-not (Test-WalletAssetsFresh))
if ($needBuild) {
  Write-Host "==> APK/assets stale or -Rebuild - running wallet-run.ps1 first..." -ForegroundColor Cyan
  & powershell -ExecutionPolicy Bypass -File (Join-Path $repo "scripts\wallet-run.ps1")
  if ($LASTEXITCODE -ne 0) { throw "wallet-run.ps1 failed - fix the red error above, then rerun wallet-open.ps1" }
  Start-Sleep -Seconds 2
  $pidLine = & $adb shell pidof $pkg 2>$null
  if ($pidLine) {
    Write-Host ("DONE - Wallet running (pid " + $pidLine.Trim() + "). Do NOT press Studio Run.") -ForegroundColor Green
    exit 0
  }
  Write-Host "wallet-run finished but process not up - continuing force launch..." -ForegroundColor Yellow
}

if (-not (Test-Path -LiteralPath $apk)) {
  throw "APK still missing after build. Paste wallet-run errors."
}

Write-Host "==> adb restart (clears offline emulator-5554)" -ForegroundColor Cyan
& $adb kill-server 2>$null
Start-Sleep -Seconds 1
& $adb start-server | Out-Null
Start-Sleep -Seconds 1

$online = Get-OnlineDevice
if (-not $online -or $online.Count -eq 0) {
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
  throw "Still offline. Close emulator window, then Device Manager -> Cold Boot Now -> wait for home -> rerun this script."
}

Write-Host "==> wait for boot_completed" -ForegroundColor Cyan
$bootDeadline = (Get-Date).AddMinutes(2)
while ((Get-Date) -lt $bootDeadline) {
  $boot = (& $adb shell getprop sys.boot_completed 2>$null | Out-String).Trim()
  if ($boot -eq "1") { break }
  Start-Sleep -Seconds 3
}

Write-Host "==> uninstall + install" -ForegroundColor Cyan
& $adb shell am force-stop $pkg 2>$null
& $adb uninstall $pkg 2>$null
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { throw "adb install failed - copy the red error above" }

Write-Host "==> launch My Wallet" -ForegroundColor Cyan
& $adb shell am start -W -n $activity -a android.intent.action.MAIN -c android.intent.category.LAUNCHER
if ($LASTEXITCODE -ne 0) {
  Write-Host "am start failed - trying launcher monkey..." -ForegroundColor Yellow
  & $adb shell monkey -p $pkg -c android.intent.category.LAUNCHER 1
  if ($LASTEXITCODE -ne 0) { throw "could not launch app" }
}

Start-Sleep -Seconds 3
$pidLine = & $adb shell pidof $pkg 2>$null
if (-not $pidLine) {
  Write-Host "WARN: process not running - checking crash log..." -ForegroundColor Yellow
  & $adb logcat -d -t 120 AndroidRuntime:E Capacitor:E chromium:E ActivityManager:I *:S | Out-Host
  throw "App installed but crashed on open. Paste the logcat lines above."
}

$dump = & $adb shell dumpsys activity activities 2>$null | Out-String
if ($dump -match "com\.poreiago\.wallet") {
  Write-Host "OK: MainActivity in foreground" -ForegroundColor Green
}

Write-Host ("DONE - Wallet running (pid " + $pidLine.Trim() + "). Screen should be My Wallet / login - not the website.") -ForegroundColor Green
Write-Host "Do NOT press Studio Run." -ForegroundColor Green
