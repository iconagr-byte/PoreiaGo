# PoreiaGo — clear "Medium Phone is already running as process NNNN"
# when Android Studio Device Manager shows Play but Run fails with that toast.
# ASCII-only (no BOM) for Windows PowerShell 5.1.
#
# Usage:
#   cd C:\Users\User\poreiago
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-kill-emulator.ps1
#   # then Device Manager -> Cold Boot Now (or Play) -> wait for home screen
#   # prefer: powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1

param(
  [int]$PidHint = 0
)

$ErrorActionPreference = "Continue"

Write-Host "==> PoreiaGo: kill stuck Medium Phone / emulator locks" -ForegroundColor Cyan

if ($PidHint -gt 0) {
  Write-Host ("==> Stop-Process -Id " + $PidHint) -ForegroundColor DarkYellow
  Stop-Process -Id $PidHint -Force -ErrorAction SilentlyContinue
}

$names = @(
  "emulator",
  "qemu-system-x86_64",
  "qemu-system-aarch64",
  "qemu-system-x86_64-headless",
  "crashpad_handler"
)
Get-Process -Name $names -ErrorAction SilentlyContinue |
  ForEach-Object {
    Write-Host ("==> kill " + $_.ProcessName + " pid=" + $_.Id) -ForegroundColor DarkYellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
  }

# Stale AVD locks make Studio think the device is still running.
$avdRoot = Join-Path $env:USERPROFILE ".android\avd"
if (Test-Path -LiteralPath $avdRoot) {
  $locks = Get-ChildItem -Path $avdRoot -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -match '\.lock$' -or $_.Name -eq 'hardware-qemu.ini.lock' -or $_.Name -eq 'multiinstance.lock'
    }
  foreach ($lock in $locks) {
    Write-Host ("==> remove lock " + $lock.FullName) -ForegroundColor DarkYellow
    Remove-Item -LiteralPath $lock.FullName -Force -ErrorAction SilentlyContinue
  }
}

$sdkCandidates = @(
  $env:ANDROID_HOME,
  $env:ANDROID_SDK_ROOT,
  "$env:LOCALAPPDATA\Android\Sdk",
  "$env:USERPROFILE\AppData\Local\Android\Sdk"
) | Where-Object { $_ -and (Test-Path $_) }

$sdk = $sdkCandidates | Select-Object -First 1
if ($sdk) {
  $adb = Join-Path $sdk "platform-tools\adb.exe"
  if (Test-Path -LiteralPath $adb) {
    Write-Host "==> adb kill-server / start-server" -ForegroundColor Cyan
    & $adb kill-server 2>$null | Out-Null
    Start-Sleep -Seconds 1
    & $adb start-server 2>$null | Out-Null
    & $adb devices
  }
}

Write-Host ""
Write-Host "OK: emulator processes + AVD locks cleared." -ForegroundColor Green
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  1) Android Studio -> Device Manager -> Medium Phone -> dropdown -> Cold Boot Now"
Write-Host "  2) Wait until the emulator shows the HOME screen (not black / offline)"
Write-Host "  3) Prefer install without Studio Run:"
Write-Host "       powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1"
Write-Host "  4) Or Studio: pick Medium Phone in the toolbar, then Run"
Write-Host ""
Write-Host "If the toast returns with a new PID:" -ForegroundColor Yellow
Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\wallet-kill-emulator.ps1 -PidHint <PID>"
Write-Host ""
