# Install already-built PoreiaGo Wallet APK onto a running emulator.
# Usage (ONE line):
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-install.ps1

$ErrorActionPreference = "Stop"
$repo = "C:\Users\User\poreiago"
Set-Location $repo

$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
$apk = Join-Path $repo "android\app\build\outputs\apk\debug\app-debug.apk"

if (-not (Test-Path -LiteralPath $adb)) { throw "adb not found: $adb" }
if (-not (Test-Path -LiteralPath $apk)) {
  throw "APK missing. Build first: powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1 -JavaHome `"$env:USERPROFILE\.jdks\jbr-21.0.11`""
}

& $adb start-server
Write-Host "==> waiting for emulator device..." -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes(3)
$online = $null
while ((Get-Date) -lt $deadline) {
  & $adb devices | Out-Host
  $online = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
  if ($online) { break }
  Start-Sleep -Seconds 3
}
if (-not $online) {
  throw "No emulator online. Device Manager -> Play on Medium Phone, wait for home screen, rerun this script."
}

Write-Host "==> install + launch" -ForegroundColor Cyan
& $adb shell am force-stop com.poreiago.wallet 2>$null
& $adb uninstall com.poreiago.wallet 2>$null
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { throw "install failed" }
& $adb shell am start -n "com.poreiago.wallet/com.poreiago.wallet.MainActivity"
Write-Host "DONE - My Wallet should be open on the emulator." -ForegroundColor Green
