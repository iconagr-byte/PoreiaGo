# PoreiaGo Wallet - build + install on running emulator
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1

param(
  [string]$Sdk = "",
  [string]$JavaHome = ""
)

$ErrorActionPreference = "Stop"
$repo = "C:\Users\User\poreiago"
Set-Location $repo

Remove-Item Env:ANDROID_HOME -ErrorAction SilentlyContinue
Remove-Item Env:ANDROID_SDK_ROOT -ErrorAction SilentlyContinue

function Get-JavaMajor($javaHome) {
  if (-not $javaHome) { return -1 }
  $javaExe = Join-Path $javaHome "bin\java.exe"
  if (-not (Test-Path -LiteralPath $javaExe)) { return -1 }

  # Most reliable: JAVA_HOME\release (avoids PowerShell stderr trap on `java -version`)
  $release = Join-Path $javaHome "release"
  if (Test-Path -LiteralPath $release) {
    $rel = Get-Content -LiteralPath $release -Raw -ErrorAction SilentlyContinue
    if ($rel -match 'JAVA_VERSION="1\.(\d+)') { return [int]$Matches[1] }
    if ($rel -match 'JAVA_VERSION="(\d+)') { return [int]$Matches[1] }
  }

  # Folder name hint: jbr-21.0.11 / jdk-17.0.x
  $leaf = Split-Path -Leaf $javaHome
  if ($leaf -match '(?:^|[^\d])(21)(?:[^\d]|$)') { return 21 }
  if ($leaf -match '(?:^|[^\d])(17)(?:[^\d]|$)') { return 17 }

  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $lines = & $javaExe -version 2>&1
    $out = ($lines | ForEach-Object { "$_" }) -join "`n"
    if ($out -match 'version "1\.(\d+)') { return [int]$Matches[1] }
    if ($out -match 'version "(\d+)') { return [int]$Matches[1] }
  } catch {
    # ignore
  } finally {
    $ErrorActionPreference = $prevEap
  }
  return -1
}

function Find-Java21 {
  $candidates = New-Object System.Collections.Generic.List[string]
  $jdks = Join-Path $env:USERPROFILE ".jdks"
  if (Test-Path $jdks) {
    Get-ChildItem -Path $jdks -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match 'jbr-21|jdk-21|jbr-17|jdk-17|21\.|17\.' } |
      ForEach-Object { [void]$candidates.Add($_.FullName) }
  }
  foreach ($name in @("Android Studio","Android Studio1","Android Studio2")) {
    [void]$candidates.Add((Join-Path $env:ProgramFiles ("Android\" + $name + "\jbr")))
    [void]$candidates.Add((Join-Path $env:LOCALAPPDATA ("Programs\Android\" + $name + "\jbr")))
  }
  # Prefer explicit 21 folders first
  $ordered = $candidates | Sort-Object {
    if ($_ -match '21') { 0 } elseif ($_ -match '17') { 1 } else { 2 }
  }
  foreach ($c in $ordered) {
    if (-not $c) { continue }
    $javaExe = Join-Path $c "bin\java.exe"
    if (-not (Test-Path -LiteralPath $javaExe)) {
      Write-Host ("skip Java (no java.exe): " + $c)
      continue
    }
    $major = Get-JavaMajor $c
    Write-Host ("check Java " + $c + " -> major=" + $major)
    if ($major -eq 21 -or $major -eq 17) { return $c }
    # Last resort: path clearly names 21/17 and java.exe exists (parse bugs on some hosts).
    $leaf = Split-Path -Leaf $c
    if ($leaf -match '21') {
      Write-Host ("accept by folder name (21): " + $c) -ForegroundColor Yellow
      return $c
    }
    if ($leaf -match '17') {
      Write-Host ("accept by folder name (17): " + $c) -ForegroundColor Yellow
      return $c
    }
  }
  return $null
}

function Pin-GradleJavaHome($javaHome) {
  $gp = Join-Path $repo "android\gradle.properties"
  $line = "org.gradle.java.home=" + ($javaHome -replace '\\','\\')
  $lines = @()
  if (Test-Path $gp) {
    $lines = Get-Content $gp | Where-Object { $_ -notmatch '^\s*org\.gradle\.java\.home=' }
  }
  ($lines + $line) | Set-Content -Path $gp -Encoding ASCII
  Write-Host ("Pinned " + $line) -ForegroundColor Green
}

if (-not $Sdk) { $Sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
$adb = Join-Path $Sdk "platform-tools\adb.exe"
$java = $null
if ($JavaHome) {
  if (-not (Test-Path -LiteralPath (Join-Path $JavaHome "bin\java.exe"))) {
    throw ("JavaHome has no bin\\java.exe: " + $JavaHome)
  }
  $java = $JavaHome
  Write-Host ("Using -JavaHome " + $java) -ForegroundColor Green
} else {
  $java = Find-Java21
}
if (-not $java) {
  $hint = Join-Path $env:USERPROFILE ".jdks\jbr-21.0.11"
  throw @"
Need JDK 17 or 21 (not 25).
Retry with explicit path:
  powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1 -JavaHome '$hint'
"@
}
if (-not (Test-Path -LiteralPath $adb)) { throw "adb not found at $adb" }

$env:JAVA_HOME = $java
$env:ANDROID_HOME = $Sdk
$env:ANDROID_SDK_ROOT = $Sdk
$env:Path = (Join-Path $env:JAVA_HOME "bin") + ";" + (Join-Path $env:ANDROID_HOME "platform-tools") + ";" + $env:Path
Write-Host ("JAVA_HOME=" + $env:JAVA_HOME + " major=" + (Get-JavaMajor $env:JAVA_HOME)) -ForegroundColor Green
Write-Host ("ANDROID_HOME=" + $env:ANDROID_HOME)

$sdkSlash = $Sdk -replace '\\', '/'
Set-Content -Path (Join-Path $repo "android\local.properties") -Value ("sdk.dir=" + $sdkSlash) -Encoding ASCII

Write-Host "==> git fetch/reset (main)" -ForegroundColor Cyan
git fetch origin main
git checkout main
git reset --hard origin/main
git clean -fd -e android/local.properties -e android/.gradle -e node_modules
git log -1 --oneline

# Force a clean web bundle so Android never keeps stale login copy.
$staleDirs = @(
  (Join-Path $repo "dist"),
  (Join-Path $repo "android\app\src\main\assets\public"),
  (Join-Path $repo "android\app\build")
)
foreach ($d in $staleDirs) {
  if (Test-Path -LiteralPath $d) {
    Write-Host ("==> wipe " + $d) -ForegroundColor DarkYellow
    Remove-Item -LiteralPath $d -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Pin-GradleJavaHome $env:JAVA_HOME

Write-Host "==> cap:sync:packaged (npm build + cap sync)" -ForegroundColor Cyan
npm.cmd run cap:sync:packaged
if ($LASTEXITCODE -ne 0) { throw "sync failed" }

$assetsPublic = Join-Path $repo "android\app\src\main\assets\public"
$htmlHit = Select-String -Path (Join-Path $assetsPublic "index.html") -Pattern "pgWalletFade" -ErrorAction SilentlyContinue
if (-not $htmlHit) { throw "NEW full-bleed CSS missing from android assets" }

$oldCopy = Get-ChildItem -Path $assetsPublic -Recurse -Include *.js,*.css,*.html -ErrorAction SilentlyContinue |
  Select-String -Pattern "Σύνδεση για εισιτήρια" -SimpleMatch -ErrorAction SilentlyContinue |
  Select-Object -First 1
if ($oldCopy) {
  throw ("STALE bundle still has old login subtitle in: " + $oldCopy.Path)
}
Write-Host "OK: new My Wallet login assets (no ticket/QR subtitle)" -ForegroundColor Green

Pin-GradleJavaHome $env:JAVA_HOME

Set-Location (Join-Path $repo "android")
& .\gradlew.bat --no-daemon -Dorg.gradle.java.home="$env:JAVA_HOME" clean assembleDebug
if ($LASTEXITCODE -ne 0) { throw "build failed - JDK must be 17/21 not 25" }

$apk = Join-Path $repo "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path -LiteralPath $apk)) { throw ("APK missing: " + $apk) }
& $adb start-server
& $adb devices
$online = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "device$" }
if (-not $online) { throw "Emulator not online. Start Medium Phone, wait home screen, rerun." }

Write-Host "==> wipe old app + reinstall" -ForegroundColor Cyan
& $adb shell am force-stop com.poreiago.wallet
& $adb uninstall com.poreiago.wallet
# Clear WebView cache leftovers for this package if still present
& $adb shell pm clear com.poreiago.wallet 2>$null
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { throw "install failed" }
& $adb shell am start -n "com.poreiago.wallet/com.poreiago.wallet.MainActivity"
Write-Host "DONE - Apple My Wallet login (no ticket/QR subtitle). Do NOT press Studio Run after this." -ForegroundColor Green
