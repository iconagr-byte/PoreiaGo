# Print debug keystore SHA-1 for Google Cloud Android OAuth client.
# ASCII-only file (no BOM).
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-google-sha1.ps1

$ErrorActionPreference = "Continue"
$keystore = Join-Path $env:USERPROFILE ".android\debug.keystore"
$pkg = "com.poreiago.wallet"

Write-Host ""
Write-Host "=== Google Sign-In for emulator (one-time Console setup) ===" -ForegroundColor Cyan
Write-Host "Package name: $pkg"
Write-Host "Web client ID (already used by website): keep as-is"
Write-Host "  838114974488-8q36brogbldig001k9n88qrnciqle1j1.apps.googleusercontent.com"
Write-Host ""

if (-not (Test-Path -LiteralPath $keystore)) {
  Write-Host "Debug keystore missing: $keystore" -ForegroundColor Yellow
  Write-Host "Build the app once (wallet-run) then rerun this script."
  exit 0
}

$keytool = $null
foreach ($c in @(
  (Join-Path $env:JAVA_HOME "bin\keytool.exe"),
  "keytool.exe",
  "keytool"
)) {
  if ($c -and (Get-Command $c -ErrorAction SilentlyContinue)) { $keytool = $c; break }
  if ($c -and (Test-Path -LiteralPath $c)) { $keytool = $c; break }
}

if (-not $keytool) {
  Write-Host "keytool not found. Set JAVA_HOME to JDK 17/21 and rerun." -ForegroundColor Yellow
  exit 0
}

$out = & $keytool -list -v -keystore $keystore -alias androiddebugkey -storepass android -keypass android 2>&1 | Out-String
$sha1 = $null
if ($out -match 'SHA1:\s*([0-9A-Fa-f:]+)') { $sha1 = $Matches[1].Trim() }
elseif ($out -match 'SHA-1:\s*([0-9A-Fa-f:]+)') { $sha1 = $Matches[1].Trim() }

if (-not $sha1) {
  Write-Host $out
  Write-Host "Could not parse SHA-1 - paste keytool output above." -ForegroundColor Yellow
  exit 0
}

Write-Host "SHA-1 (DEBUG): $sha1" -ForegroundColor Green
Write-Host ""
Write-Host "1) Open: https://console.cloud.google.com/apis/credentials" -ForegroundColor White
Write-Host "2) Create credentials -> OAuth client ID -> Application type: Android"
Write-Host "3) Name: PoreiaGo Wallet Debug"
Write-Host "4) Package name: $pkg"
Write-Host "5) SHA-1: $sha1"
Write-Host "6) Create -> wait 5-10 minutes"
Write-Host "7) Emulator: open Wallet -> Sign in with Google (native sheet, not WebView)"
Write-Host ""
Write-Host "Same Google Cloud project as the Web client. Do NOT put the Android client ID in the app."
Write-Host "If consent screen is Testing, add your Gmail under Test users."
