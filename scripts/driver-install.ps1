# Install already-built PoreiaGo Driver APK onto a running emulator.
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\driver-install.ps1

$ErrorActionPreference = "Stop"
$repo = "C:\Users\User\poreiago"
Set-Location $repo

$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
$apk = Join-Path $repo "android-driver\app\build\outputs\apk\debug\app-debug.apk"

if (-not (Test-Path -LiteralPath $adb)) { throw "adb not found: $adb" }
if (-not (Test-Path -LiteralPath $apk)) {
  throw "APK missing. Build first: powershell -ExecutionPolicy Bypass -File .\scripts\driver-run.ps1"
}

& $adb start-server
Write-Host "==> waiting for emulator/USB device (up to 3 min)..." -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes(3)
$online = $null
$emptyHintShown = $false
while ((Get-Date) -lt $deadline) {
  & $adb devices | Out-Host
  $online = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
  if ($online) { break }
  if (-not $emptyHintShown) {
    Write-Host "NO DEVICE yet. Device Manager -> Play (home screen), or USB phone + debugging." -ForegroundColor Yellow
    $emptyHintShown = $true
  }
  Start-Sleep -Seconds 3
}
if (-not $online) {
  throw "No emulator/phone online."
}

Write-Host "==> install + launch Driver" -ForegroundColor Cyan
& $adb shell am force-stop com.poreiago.driver 2>$null
& $adb uninstall com.poreiago.driver 2>$null
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { throw "install failed" }
& $adb shell am start -n "com.poreiago.driver/com.poreiago.driver.MainActivity"
Write-Host "DONE - PoreiaGo Driver should open on /driver." -ForegroundColor Green
