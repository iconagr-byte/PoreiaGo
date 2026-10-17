# Print DEBUG + APK signing SHA-1 for Google Cloud Android OAuth client.
# ASCII-only file (no BOM).
# Usage (from any folder):
#   powershell -ExecutionPolicy Bypass -File C:\Users\User\poreiago\scripts\wallet-google-sha1.ps1

$ErrorActionPreference = "Continue"
$repo = "C:\Users\User\poreiago"
$keystore = Join-Path $env:USERPROFILE ".android\debug.keystore"
$apk = Join-Path $repo "android\app\build\outputs\apk\debug\app-debug.apk"
$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$adb = Join-Path $sdk "platform-tools\adb.exe"
$pkg = "com.poreiago.wallet"
$webClient = "967076454927-c5goejio1jlqr2vki24j7g8133knnqlp.apps.googleusercontent.com"

Write-Host ""
Write-Host "=== Google Sign-In checklist (emulator) ===" -ForegroundColor Cyan
Write-Host ("Package name: " + $pkg)
Write-Host ("Web client ID (use as webClientId - NOT the Android client ID):")
Write-Host ("  " + $webClient)
Write-Host ""

function Find-Keytool {
  $candidates = New-Object System.Collections.Generic.List[string]
  if ($env:JAVA_HOME -and $env:JAVA_HOME.Trim() -ne "") {
    [void]$candidates.Add((Join-Path $env:JAVA_HOME "bin\keytool.exe"))
  }
  $jdks = Join-Path $env:USERPROFILE ".jdks"
  if (Test-Path -LiteralPath $jdks) {
    Get-ChildItem -Path $jdks -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match 'jbr-21|jdk-21|jbr-17|jdk-17|21\.|17\.' } |
      ForEach-Object { [void]$candidates.Add((Join-Path $_.FullName "bin\keytool.exe")) }
  }
  foreach ($name in @("Android Studio", "Android Studio1", "Android Studio2")) {
    [void]$candidates.Add((Join-Path $env:ProgramFiles ("Android\" + $name + "\jbr\bin\keytool.exe")))
    [void]$candidates.Add((Join-Path $env:LOCALAPPDATA ("Programs\Android\" + $name + "\jbr\bin\keytool.exe")))
  }
  $cmd = Get-Command "keytool.exe" -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { [void]$candidates.Add($cmd.Source) }
  foreach ($c in $candidates) {
    if ($c -and (Test-Path -LiteralPath $c)) { return $c }
  }
  return $null
}

function Get-Sha1FromKeytoolOut([string]$out) {
  if ($out -match 'SHA1:\s*([0-9A-Fa-f:]+)') { return $Matches[1].Trim().ToUpper() }
  if ($out -match 'SHA-1:\s*([0-9A-Fa-f:]+)') { return $Matches[1].Trim().ToUpper() }
  return $null
}

$keytool = Find-Keytool
$debugSha = $null
$apkSha = $null

if (-not $keytool) {
  Write-Host "keytool not found - set JAVA_HOME to jbr-21 then rerun." -ForegroundColor Yellow
} else {
  Write-Host ("Using keytool: " + $keytool) -ForegroundColor DarkGray
  if (Test-Path -LiteralPath $keystore) {
    $out = & $keytool -list -v -keystore $keystore -alias androiddebugkey -storepass android -keypass android 2>&1 | Out-String
    $debugSha = Get-Sha1FromKeytoolOut $out
    if ($debugSha) {
      Write-Host ("SHA-1 (debug.keystore): " + $debugSha) -ForegroundColor Green
    } else {
      Write-Host "Could not parse debug.keystore SHA-1:" -ForegroundColor Yellow
      Write-Host $out
    }
  } else {
    Write-Host ("Debug keystore missing: " + $keystore) -ForegroundColor Yellow
  }

  if (Test-Path -LiteralPath $apk) {
    $outApk = & $keytool -printcert -jarfile $apk 2>&1 | Out-String
    $apkSha = Get-Sha1FromKeytoolOut $outApk
    if ($apkSha) {
      Write-Host ("SHA-1 (app-debug.apk signing cert): " + $apkSha) -ForegroundColor Green
    } else {
      # Fallback: apksigner if present
      $bt = Get-ChildItem -Path (Join-Path $sdk "build-tools") -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | Select-Object -First 1
      if ($bt) {
        $apksigner = Join-Path $bt.FullName "apksigner.bat"
        if (Test-Path -LiteralPath $apksigner) {
          $asOut = & $apksigner verify --print-certs $apk 2>&1 | Out-String
          if ($asOut -match 'SHA-1 digest:\s*([0-9a-f:]+)') {
            $apkSha = ($Matches[1].Trim().ToUpper() -replace '([0-9A-F]{2})(?!$)', '$1:')
          }
          if ($apkSha) {
            Write-Host ("SHA-1 (apksigner): " + $apkSha) -ForegroundColor Green
          } else {
            Write-Host $asOut
          }
        }
      }
      if (-not $apkSha) {
        Write-Host "Could not parse APK SHA-1 - paste keytool -printcert output." -ForegroundColor Yellow
        Write-Host $outApk
      }
    }
  } else {
    Write-Host ("APK not built yet: " + $apk) -ForegroundColor DarkYellow
    Write-Host "Run wallet-go.ps1 once, then rerun this script."
  }
}

$useSha = if ($apkSha) { $apkSha } else { $debugSha }
Write-Host ""
Write-Host "Google Cloud Console steps:" -ForegroundColor White
Write-Host "1) https://console.cloud.google.com/apis/credentials"
Write-Host "2) Same project as the Web client above"
Write-Host "3) Create credentials -> OAuth client ID -> Android"
Write-Host ("4) Package name: " + $pkg)
if ($useSha) {
  Write-Host ("5) SHA-1 certificate fingerprint: " + $useSha) -ForegroundColor Yellow
} else {
  Write-Host "5) SHA-1: (run again after keytool works)"
}
Write-Host "6) Create. If consent screen = Testing, add your Gmail under Test users."
Write-Host "7) Wait (often 5-10 min, sometimes a few hours) then retry Sign-In in Wallet."
Write-Host ""
Write-Host "Do NOT put the Android client ID in the app. Keep the Web client ID."
Write-Host "Expected SHA-1 from earlier session (for compare):"
Write-Host "  CA:AE:18:B1:AC:66:41:37:08:23:8B:10:F1:E5:D6:F8:10:6D:2D:2F"
if ($useSha -and $useSha -ne "CA:AE:18:B1:AC:66:41:37:08:23:8B:10:F1:E5:D6:F8:10:6D:2D:2F") {
  Write-Host "WARNING: current SHA-1 differs from the one registered earlier - update Console!" -ForegroundColor Red
}

if (Test-Path -LiteralPath $adb) {
  Write-Host ""
  Write-Host "==> recent Logcat GoogleProvider (after a failed Sign-In):" -ForegroundColor Cyan
  & $adb logcat -d -t 80 GoogleProvider:I CapgoSocialLogin:I *:S 2>$null | Out-Host
}
Write-Host ""
