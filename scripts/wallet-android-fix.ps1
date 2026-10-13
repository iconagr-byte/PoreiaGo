# PoreiaGo Wallet — Windows helper (packaged My Wallet only)
# Usage (PowerShell):
#   cd C:\Users\User\poreiago
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-android-fix.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "==> git pull" -ForegroundColor Cyan
git pull

Write-Host "==> npm install" -ForegroundColor Cyan
npm.cmd install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Write-Host "==> cap:sync:packaged (My Wallet only, no live site)" -ForegroundColor Cyan
npm.cmd run cap:sync:packaged
if ($LASTEXITCODE -ne 0) { throw "cap:sync:packaged failed" }

$cfg = Get-Content .\android\app\src\main\assets\capacitor.config.json -Raw
if ($cfg -match '"server"') {
  throw "ERROR: capacitor.config still has server.url — packaged sync failed"
}

Write-Host ""
Write-Host "OK. Next in Android Studio:" -ForegroundColor Green
Write-Host "  1) File → Open → $root\android"
Write-Host "  2) Settings → Gradle → Gradle JDK = 21 (not 25)"
Write-Host "  3) Device Manager → start an emulator"
Write-Host "  4) Run ▶ app"
Write-Host ""
