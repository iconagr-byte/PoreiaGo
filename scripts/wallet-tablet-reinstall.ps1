# Rebuild PoreiaGo Wallet and install ONLY on the USB tablet (never emulator).
# Paste THIS one line in a normal (non-Admin) PowerShell:
#   powershell -ExecutionPolicy Bypass -File C:\Users\User\poreiago\scripts\wallet-tablet-reinstall.ps1
# ASCII-only (no BOM) for Windows PowerShell 5.1.

$ErrorActionPreference = "Stop"
$repo = "C:\Users\User\poreiago"
$branch = "cursor/wallet-tablet-usb-5ffb"
$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"

if (-not (Test-Path -LiteralPath $repo)) { throw "Repo missing: $repo" }
Set-Location $repo

Write-Host "==> pull tablet branch" -ForegroundColor Cyan
git fetch origin $branch
if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }
git checkout -B $branch ("origin/" + $branch)
if ($LASTEXITCODE -ne 0) { throw "git checkout failed" }
git reset --hard ("origin/" + $branch)
if ($LASTEXITCODE -ne 0) { throw "git reset failed" }

if (Test-Path -LiteralPath $adb) {
  Write-Host "==> uninstall old PoreiaGo on USB device" -ForegroundColor Cyan
  & $adb start-server | Out-Null
  & $adb devices | Out-Host
  & $adb uninstall com.poreiago.wallet 2>$null | Out-Host
}

$run = Join-Path $repo "scripts\wallet-run.ps1"
Write-Host "==> build + install on USB tablet only" -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $run -Branch $branch -UsbOnly
$code = $LASTEXITCODE
if ($code -ne 0) { exit $code }

if (Test-Path -LiteralPath $adb) {
  Write-Host "==> installed package" -ForegroundColor Cyan
  & $adb shell dumpsys package com.poreiago.wallet | Select-String -Pattern "versionName=","versionCode=" | Select-Object -First 4
}

Write-Host "DONE - tablet must show splash version 1.0.31 and NO Live Tracking map." -ForegroundColor Green
exit 0
