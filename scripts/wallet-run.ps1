# PoreiaGo Wallet - build + install on running emulator
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1
# ASCII-only file (no BOM) so Windows PowerShell 5.1 always parses.

param(
  [string]$Sdk = "",
  [string]$JavaHome = "",
  [string]$Branch = "cursor/wallet-native-theme-isolate-5ffb"
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

  $release = Join-Path $javaHome "release"
  if (Test-Path -LiteralPath $release) {
    $rel = Get-Content -LiteralPath $release -Raw -ErrorAction SilentlyContinue
    if ($rel -match 'JAVA_VERSION="1\.(\d+)') { return [int]$Matches[1] }
    if ($rel -match 'JAVA_VERSION="(\d+)') { return [int]$Matches[1] }
  }

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
  $line = "org.gradle.java.home=" + ($javaHome -replace '\\', '/')
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
  throw ("Need JDK 17 or 21 (not 25). Retry: powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1 -JavaHome '" + $hint + "'")
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

Write-Host ("==> git fetch/reset (" + $Branch + ")") -ForegroundColor Cyan
git fetch origin $Branch
if ($LASTEXITCODE -ne 0) { throw ("git fetch failed for " + $Branch) }
git checkout $Branch
if ($LASTEXITCODE -ne 0) { throw ("git checkout failed for " + $Branch) }
git reset --hard ("origin/" + $Branch)
if ($LASTEXITCODE -ne 0) { throw ("git reset --hard failed for origin/" + $Branch) }
git clean -fd -e android/local.properties -e android/.gradle -e node_modules
git log -1 --oneline

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

Write-Host "==> npm install (native Google plugin + lockfile)" -ForegroundColor Cyan
npm.cmd install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
$socialPkg = Join-Path $repo "node_modules\@capgo\capacitor-social-login\package.json"
if (-not (Test-Path -LiteralPath $socialPkg)) {
  throw "Missing @capgo/capacitor-social-login after npm install - check package.json"
}
Write-Host "OK: @capgo/capacitor-social-login installed" -ForegroundColor Green

Write-Host "==> cap:sync:packaged (native Google Sign-In)" -ForegroundColor Cyan
npm.cmd run cap:sync:packaged
if ($LASTEXITCODE -ne 0) { throw "sync failed" }

$settingsGradle = Join-Path $repo "android\capacitor.settings.gradle"
$settingsText = Get-Content -LiteralPath $settingsGradle -Raw -ErrorAction SilentlyContinue
if (-not $settingsText -or $settingsText -notmatch 'capgo-capacitor-social-login') {
  throw "SocialLogin missing from android/capacitor.settings.gradle after sync - native Google will fail"
}
Write-Host "OK: SocialLogin in capacitor.settings.gradle" -ForegroundColor Green

$assetsPublic = Join-Path $repo "android\app\src\main\assets\public"
$htmlHit = Select-String -Path (Join-Path $assetsPublic "index.html") -Pattern "pgWalletFade" -ErrorAction SilentlyContinue
if (-not $htmlHit) { throw "NEW full-bleed CSS missing from android assets" }

$walletHit = Get-ChildItem -Path $assetsPublic -Recurse -Include *.js -ErrorAction SilentlyContinue |
  Select-String -Pattern "My Wallet" -SimpleMatch -ErrorAction SilentlyContinue |
  Select-Object -First 1
if (-not $walletHit) {
  throw "My Wallet copy missing from android assets - wrong branch or stale build"
}
Write-Host "OK: My Wallet assets present" -ForegroundColor Green

$googleHit = Get-ChildItem -Path $assetsPublic -Recurse -Include *.js -ErrorAction SilentlyContinue |
  Select-String -Pattern "Google" -SimpleMatch -ErrorAction SilentlyContinue |
  Select-Object -First 1
if (-not $googleHit) {
  throw "Google Sign-In copy missing from android assets - wrong branch or stale build"
}
Write-Host "OK: Google Sign-In present in packaged assets" -ForegroundColor Green

Pin-GradleJavaHome $env:JAVA_HOME
Remove-Item Env:GRADLE_OPTS -ErrorAction SilentlyContinue

$androidDir = Join-Path $repo "android"
Write-Host "==> gradle clean assembleDebug" -ForegroundColor Cyan
$gradle = Start-Process -FilePath "cmd.exe" `
  -ArgumentList @("/c", "gradlew.bat --no-daemon clean assembleDebug") `
  -WorkingDirectory $androidDir `
  -Wait -PassThru -NoNewWindow
if ($null -eq $gradle -or $gradle.ExitCode -ne 0) {
  throw "build failed - JDK must be 17/21 not 25"
}

$apk = Join-Path $repo "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path -LiteralPath $apk)) { throw ("APK missing: " + $apk) }

# Prove native SocialLogin is inside THIS APK (not just gradle files on disk).
function Test-ApkHasSocialLogin([string]$apkPath) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $tmp = Join-Path $env:TEMP ("pg-social-" + [guid]::NewGuid().ToString("n"))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    [System.IO.Compression.ZipFile]::ExtractToDirectory($apkPath, $tmp)
    $plugins = Join-Path $tmp "assets\capacitor.plugins.json"
    if (-not (Test-Path -LiteralPath $plugins)) { return $false }
    $pluginsText = Get-Content -LiteralPath $plugins -Raw -ErrorAction SilentlyContinue
    if (-not $pluginsText -or $pluginsText -notmatch 'SocialLoginPlugin') { return $false }
    $dexFiles = @(Get-ChildItem -LiteralPath $tmp -Filter "classes*.dex" -File -ErrorAction SilentlyContinue)
    if ($dexFiles.Count -eq 0) { return $false }
    foreach ($dex in $dexFiles) {
      $bytes = [System.IO.File]::ReadAllBytes($dex.FullName)
      $ascii = [System.Text.Encoding]::ASCII.GetString($bytes)
      if ($ascii -match 'SocialLoginPlugin' -or $ascii -match 'ee/forgr/capacitor/social/login') {
        return $true
      }
    }
    return $false
  } catch {
    Write-Host ("APK SocialLogin check error: " + $_) -ForegroundColor Yellow
    return $false
  } finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Test-ApkHasMainActivity([string]$apkPath) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $tmp = Join-Path $env:TEMP ("pg-mainact-" + [guid]::NewGuid().ToString("n"))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    [System.IO.Compression.ZipFile]::ExtractToDirectory($apkPath, $tmp)
    $dexFiles = @(Get-ChildItem -LiteralPath $tmp -Filter "classes*.dex" -File -ErrorAction SilentlyContinue)
    if ($dexFiles.Count -eq 0) { return $false }
    foreach ($dex in $dexFiles) {
      $bytes = [System.IO.File]::ReadAllBytes($dex.FullName)
      $ascii = [System.Text.Encoding]::ASCII.GetString($bytes)
      # Dalvik type descriptor for com.poreiago.wallet.MainActivity
      if ($ascii -match 'Lcom/poreiago/wallet/MainActivity;' -or $ascii -match 'com/poreiago/wallet/MainActivity') {
        return $true
      }
    }
    return $false
  } catch {
    Write-Host ("APK MainActivity check error: " + $_) -ForegroundColor Yellow
    return $false
  } finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

if (-not (Test-ApkHasSocialLogin $apk)) {
  throw "APK built without SocialLoginPlugin class - Google Sign-In will fail. Check npm install + cap sync."
}
Write-Host "OK: SocialLoginPlugin inside APK (v1.0.9)" -ForegroundColor Green

if (-not (Test-ApkHasMainActivity $apk)) {
  throw "APK built without com.poreiago.wallet.MainActivity in classes.dex - check android/app/src/main/java"
}
Write-Host "OK: MainActivity class present in APK dex" -ForegroundColor Green

# Prefer aapt dump badging when SDK build-tools is available.
$aapt = $null
$btRoot = Join-Path $Sdk "build-tools"
if (Test-Path -LiteralPath $btRoot) {
  $bt = Get-ChildItem -LiteralPath $btRoot -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 1
  if ($bt) {
    $cand = Join-Path $bt.FullName "aapt.exe"
    if (Test-Path -LiteralPath $cand) { $aapt = $cand }
  }
}
if ($aapt) {
  Write-Host "==> aapt dump badging (launchable-activity)" -ForegroundColor Cyan
  $badging = & $aapt dump badging $apk 2>$null | Out-String
  if ($badging -notmatch 'launchable-activity:\s*name=''com\.poreiago\.wallet\.MainActivity''') {
    Write-Host $badging
    throw "APK has no launchable MainActivity in manifest - check AndroidManifest.xml merge"
  }
  Write-Host "OK: launchable-activity = com.poreiago.wallet.MainActivity" -ForegroundColor Green
}

Write-Host "==> gradle signingReport (SHA-1 for Google Console)" -ForegroundColor Cyan
$signReport = Start-Process -FilePath "cmd.exe" `
  -ArgumentList @("/c", "gradlew.bat --no-daemon signingReport") `
  -WorkingDirectory $androidDir `
  -Wait -PassThru -NoNewWindow -RedirectStandardOutput (Join-Path $env:TEMP "pg-signing-report.txt") `
  -RedirectStandardError (Join-Path $env:TEMP "pg-signing-report.err.txt")
$signOut = ""
$signFile = Join-Path $env:TEMP "pg-signing-report.txt"
if (Test-Path -LiteralPath $signFile) {
  $signOut = Get-Content -LiteralPath $signFile -Raw -ErrorAction SilentlyContinue
}
$debugSha = $null
# Prefer Variant: debug / Config: debug block SHA1
if ($signOut -match '(?s)Variant:\s*debug.*?SHA1:\s*([0-9A-Fa-f:]+)') {
  $debugSha = $Matches[1].Trim().ToUpper()
} elseif ($signOut -match 'SHA1:\s*([0-9A-Fa-f:]+)') {
  $debugSha = $Matches[1].Trim().ToUpper()
}
if ($debugSha) {
  Write-Host ("SHA-1 (gradle signingReport debug): " + $debugSha) -ForegroundColor Green
  Write-Host "Put this exact SHA-1 on Android OAuth client for package com.poreiago.wallet" -ForegroundColor Yellow
} else {
  Write-Host "Could not parse signingReport SHA-1 - run wallet-google-sha1.ps1" -ForegroundColor Yellow
}

& $adb start-server
Write-Host "==> waiting for emulator (home screen / adb device)" -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes(3)
$online = $null
while ((Get-Date) -lt $deadline) {
  & $adb devices | Out-Host
  $online = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
  if ($online) { break }
  Start-Sleep -Seconds 3
}
if (-not $online) {
  throw ("Emulator not online. Open Medium Phone, wait for home screen, then rerun OR: adb install -r `"$apk`"")
}

Write-Host "==> wipe old app + reinstall (user 0)" -ForegroundColor Cyan
# adb writes "Failed" to stderr when the package is already gone; with
# ErrorActionPreference=Stop that becomes a terminating NativeCommandError.
# Uninstall already removes app data — do not pm clear after uninstall.
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $adb shell am force-stop com.poreiago.wallet 2>$null | Out-Null
& $adb uninstall --user 0 com.poreiago.wallet 2>$null | Out-Null
& $adb uninstall com.poreiago.wallet 2>$null | Out-Null
$ErrorActionPreference = $prevEap
# Fresh install for user 0 — avoids Error type 3 on API 36/37 when a stale
# Studio deploy left a package with no launcher activities.
& $adb install -r -t --user 0 $apk
if ($LASTEXITCODE -ne 0) {
  Write-Host "install --user 0 failed - retry plain install -r" -ForegroundColor Yellow
  & $adb install -r $apk
}
if ($LASTEXITCODE -ne 0) { throw "install failed" }

$ErrorActionPreference = "Continue"
& $adb shell pm enable com.poreiago.wallet/com.poreiago.wallet.MainActivity 2>$null | Out-Null
& $adb shell cmd package resolve-activity --brief com.poreiago.wallet 2>$null | Out-Host
$ErrorActionPreference = "Stop"

$bootHit = Select-String -Path (Join-Path $assetsPublic "index.html") -Pattern "replaceState" -ErrorAction SilentlyContinue
if (-not $bootHit) { throw "Native /wallet cold-start missing from android assets - rebuild failed" }
Write-Host "OK: native cold-start replaceState present" -ForegroundColor Green

Write-Host "==> launch My Wallet" -ForegroundColor Cyan
$ErrorActionPreference = "Continue"
# Prefer launcher intent (lets PackageManager resolve MainActivity).
& $adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p com.poreiago.wallet | Out-Host
$launchOk = ($LASTEXITCODE -eq 0)
if (-not $launchOk) {
  & $adb shell am start -W -n com.poreiago.wallet/com.poreiago.wallet.MainActivity | Out-Host
  $launchOk = ($LASTEXITCODE -eq 0)
}
if (-not $launchOk) {
  & $adb shell monkey -p com.poreiago.wallet -c android.intent.category.LAUNCHER 1 | Out-Host
}
$ErrorActionPreference = "Stop"
Start-Sleep -Seconds 3
$ErrorActionPreference = "Continue"
$pidLine = & $adb shell pidof com.poreiago.wallet 2>$null
$ErrorActionPreference = "Stop"
if (-not $pidLine) {
  $ErrorActionPreference = "Continue"
  Write-Host "==> package activities (diagnose Error type 3):" -ForegroundColor Yellow
  & $adb shell dumpsys package com.poreiago.wallet | Select-String -Pattern 'Activity|enabled|versionName|ActivityInfo' | Select-Object -First 40 | Out-Host
  & $adb logcat -d -t 80 AndroidRuntime:E ActivityManager:E Capacitor:E chromium:E *:S | Out-Host
  $ErrorActionPreference = "Stop"
  throw "App crashed on open - paste logcat above. If Activity class does not exist: Device Manager -> Wipe Data on the AVD, Cold Boot, rerun wallet-open.ps1 -Rebuild. Do NOT press Studio Run."
}
Write-Host ""
Write-Host "==> Google Android OAuth (required once for emulator Sign-In)" -ForegroundColor Cyan
$shaScript = Join-Path $repo "scripts\wallet-google-sha1.ps1"
if (Test-Path -LiteralPath $shaScript) {
  & powershell -ExecutionPolicy Bypass -File $shaScript
} else {
  Write-Host "Run: keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android"
}
Write-Host ("DONE - Wallet running (pid " + $pidLine.Trim() + "). Native Google Sign-In. Do NOT press Studio Run.") -ForegroundColor Green
