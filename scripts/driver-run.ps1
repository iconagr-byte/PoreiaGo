# PoreiaGo Driver - build + install on emulator/USB device
# Usage (from repo root; ALWAYS pull main first if this file is stale):
#   cd C:\Users\User\poreiago
#   git fetch origin main; git checkout main; git pull origin main
#   powershell -ExecutionPolicy Bypass -File .\scripts\driver-run.ps1
# Optional:
#   -Branch main          (default; do NOT use old feature branches)
#   -WaitMinutes 5        (adb device wait timeout; default 3)
#   -StartEmulator        (auto-start first AVD if adb devices is empty)
#   -SkipGit
# ASCII-only file (no BOM) so Windows PowerShell 5.1 always parses.

param(
  [string]$Sdk = "",
  [string]$JavaHome = "",
  # Always default to main (#836 merged). Old hardcode cursor/driver-native-app-5ffb
  # was deleted after merge and breaks git fetch on Windows.
  [string]$Branch = "main",
  [double]$WaitMinutes = 3,
  [switch]$StartEmulator,
  [switch]$SkipGit
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
    if (-not (Test-Path -LiteralPath $javaExe)) { continue }
    $major = Get-JavaMajor $c
    Write-Host ("check Java " + $c + " -> major=" + $major)
    if ($major -eq 21 -or $major -eq 17) { return $c }
    $leaf = Split-Path -Leaf $c
    if ($leaf -match '21' -or $leaf -match '17') { return $c }
  }
  return $null
}

function Pin-GradleJavaHome($javaHome, $gradleProps) {
  $line = "org.gradle.java.home=" + ($javaHome -replace '\\', '/')
  $lines = @()
  if (Test-Path $gradleProps) {
    $lines = Get-Content $gradleProps | Where-Object { $_ -notmatch '^\s*org\.gradle\.java\.home=' }
  }
  ($lines + $line) | Set-Content -Path $gradleProps -Encoding ASCII
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
  throw ("Need JDK 17 or 21 (not 25). Retry: powershell -ExecutionPolicy Bypass -File .\scripts\driver-run.ps1 -JavaHome '" + $hint + "'")
}
if (-not (Test-Path -LiteralPath $adb)) { throw "adb not found at $adb" }

$env:JAVA_HOME = $java
$env:ANDROID_HOME = $Sdk
$env:ANDROID_SDK_ROOT = $Sdk
$env:Path = (Join-Path $env:JAVA_HOME "bin") + ";" + (Join-Path $env:ANDROID_HOME "platform-tools") + ";" + $env:Path
Write-Host ("JAVA_HOME=" + $env:JAVA_HOME + " major=" + (Get-JavaMajor $env:JAVA_HOME)) -ForegroundColor Green
Write-Host ("ANDROID_HOME=" + $env:ANDROID_HOME)

$sdkSlash = $Sdk -replace '\\', '/'
$androidDriver = Join-Path $repo "android-driver"
if (-not (Test-Path -LiteralPath $androidDriver)) {
  throw "Missing android-driver/ - pull main (git checkout main; git pull origin main)"
}
Set-Content -Path (Join-Path $androidDriver "local.properties") -Value ("sdk.dir=" + $sdkSlash) -Encoding ASCII

if (-not $SkipGit) {
  if ($Branch -ne "main") {
    Write-Host ("WARNING: -Branch is '" + $Branch + "' (not main).") -ForegroundColor Yellow
    Write-Host "You will get an OLD Driver build. Prefer: -Branch main (default)." -ForegroundColor Yellow
    if ($Branch -match 'driver-native-app') {
      Write-Host "cursor/driver-native-app-5ffb was deleted after merge to main (#836). Use main." -ForegroundColor Red
    }
  }

  Write-Host ("==> git fetch/reset (" + $Branch + ")") -ForegroundColor Cyan
  git fetch origin $Branch
  if ($LASTEXITCODE -ne 0) { throw ("git fetch failed for " + $Branch) }
  git checkout $Branch
  if ($LASTEXITCODE -ne 0) { throw ("git checkout failed for " + $Branch) }
  git reset --hard ("origin/" + $Branch)
  if ($LASTEXITCODE -ne 0) { throw ("git reset --hard failed for origin/" + $Branch) }
  git clean -fd -e android/local.properties -e android-driver/local.properties -e android/.gradle -e android-driver/.gradle -e node_modules
  git log -1 --oneline
  Write-Host ("OK: building from origin/" + $Branch) -ForegroundColor Green
} else {
  Write-Host "==> -SkipGit: building current checkout" -ForegroundColor Yellow
  git log -1 --oneline
}

$staleDirs = @(
  (Join-Path $repo "dist"),
  (Join-Path $androidDriver "app\src\main\assets\public"),
  (Join-Path $androidDriver "app\build")
)
foreach ($d in $staleDirs) {
  if (Test-Path -LiteralPath $d) {
    Write-Host ("==> wipe " + $d) -ForegroundColor DarkYellow
    Remove-Item -LiteralPath $d -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Pin-GradleJavaHome $env:JAVA_HOME (Join-Path $androidDriver "gradle.properties")

Write-Host "==> npm install" -ForegroundColor Cyan
npm.cmd install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Write-Host "==> cap:driver:sync:packaged (VITE_NATIVE_APP=driver)" -ForegroundColor Cyan
npm.cmd run cap:driver:sync:packaged
if ($LASTEXITCODE -ne 0) { throw "driver sync failed" }

$assetsPublic = Join-Path $androidDriver "app\src\main\assets\public"
$indexHtml = Join-Path $assetsPublic "index.html"
if (-not (Test-Path -LiteralPath $indexHtml)) {
  throw "Driver packaged index.html missing after sync"
}
$driverBoot = Select-String -Path $indexHtml -Pattern "driver" -ErrorAction SilentlyContinue
if (-not $driverBoot) {
  throw "Driver flavor marker missing from android-driver assets"
}
Write-Host "OK: Driver native assets present" -ForegroundColor Green

$capCfg = Join-Path $androidDriver "app\src\main\assets\capacitor.config.json"
if (Test-Path -LiteralPath $capCfg) {
  $cfgText = Get-Content -LiteralPath $capCfg -Raw
  if ($cfgText -notmatch 'com\.poreiago\.driver') {
    throw "capacitor.config.json appId is not com.poreiago.driver"
  }
  Write-Host "OK: appId com.poreiago.driver" -ForegroundColor Green
}

Pin-GradleJavaHome $env:JAVA_HOME (Join-Path $androidDriver "gradle.properties")
Remove-Item Env:GRADLE_OPTS -ErrorAction SilentlyContinue

Write-Host "==> gradle clean assembleDebug (android-driver)" -ForegroundColor Cyan
$gradle = Start-Process -FilePath "cmd.exe" `
  -ArgumentList @("/c", "gradlew.bat --no-daemon clean assembleDebug") `
  -WorkingDirectory $androidDriver `
  -Wait -PassThru -NoNewWindow
if ($null -eq $gradle -or $gradle.ExitCode -ne 0) {
  throw "build failed - JDK must be 17/21 not 25"
}

$apk = Join-Path $androidDriver "app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path -LiteralPath $apk)) { throw ("APK missing: " + $apk) }

function Test-ApkHasDriverMainActivity([string]$apkPath) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $tmp = Join-Path $env:TEMP ("pg-driver-main-" + [guid]::NewGuid().ToString("n"))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    [System.IO.Compression.ZipFile]::ExtractToDirectory($apkPath, $tmp)
    $dexFiles = @(Get-ChildItem -LiteralPath $tmp -Filter "classes*.dex" -File -ErrorAction SilentlyContinue)
    if ($dexFiles.Count -eq 0) { return $false }
    foreach ($dex in $dexFiles) {
      $bytes = [System.IO.File]::ReadAllBytes($dex.FullName)
      $ascii = [System.Text.Encoding]::ASCII.GetString($bytes)
      if ($ascii -match 'Lcom/poreiago/driver/MainActivity;' -or $ascii -match 'com/poreiago/driver/MainActivity') {
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

if (-not (Test-ApkHasDriverMainActivity $apk)) {
  throw "APK built without com.poreiago.driver.MainActivity - check android-driver/app/src/main/java"
}
Write-Host "OK: Driver MainActivity present in APK" -ForegroundColor Green

& $adb start-server
$emu = Join-Path $Sdk "emulator\emulator.exe"

function Get-OnlineAdbDevice {
  return @(
    & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
  )
}

$online = Get-OnlineAdbDevice
if (-not $online -or $online.Count -eq 0) {
  Write-Host ""
  Write-Host "NO DEVICE: adb devices is empty." -ForegroundColor Yellow
  Write-Host "  1) Android Studio -> Device Manager -> Play on an AVD (e.g. Medium Phone)" -ForegroundColor Yellow
  Write-Host "  2) OR plug a phone with USB debugging ON (Developer options)" -ForegroundColor Yellow
  Write-Host "  3) OR: powershell -ExecutionPolicy Bypass -File .\scripts\driver-run.ps1 -StartEmulator" -ForegroundColor Yellow
  Write-Host ("APK ready at: " + $apk) -ForegroundColor DarkYellow
  Write-Host ""

  if ($StartEmulator -and (Test-Path -LiteralPath $emu)) {
    $avds = @(& $emu -list-avds 2>$null | Where-Object { $_.Trim() -ne "" })
    if ($avds -and $avds.Count -gt 0) {
      Write-Host ("==> -StartEmulator: launching AVD " + $avds[0]) -ForegroundColor Cyan
      Start-Process -FilePath $emu -ArgumentList @("-avd", $avds[0], "-netdelay", "none", "-netspeed", "full")
    } else {
      Write-Host "No AVDs found to auto-start. Create one in Device Manager." -ForegroundColor Yellow
    }
  }
}

$waitMins = $WaitMinutes
if ($waitMins -lt 0.5) { $waitMins = 0.5 }
Write-Host ("==> waiting for adb device (up to " + $waitMins + " min)...") -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes($waitMins)
$online = $null
$emptyHintShown = $false
while ((Get-Date) -lt $deadline) {
  $devs = & $adb devices
  $devs | Out-Host
  $online = @(
    $devs | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
  )
  if ($online -and $online.Count -gt 0) { break }
  if (-not $emptyHintShown) {
    Write-Host "Still empty - leave this window open, start the emulator, wait for home screen..." -ForegroundColor DarkYellow
    $emptyHintShown = $true
  }
  Start-Sleep -Seconds 3
}
if (-not $online -or $online.Count -eq 0) {
  Write-Host ""
  Write-Host "Timed out: no emulator/phone in 'adb devices'." -ForegroundColor Red
  Write-Host "APK was built OK. Install later with either:" -ForegroundColor Yellow
  Write-Host ("  adb install -r `"$apk`"") -ForegroundColor Cyan
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\driver-install.ps1" -ForegroundColor Cyan
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\driver-run.ps1 -StartEmulator" -ForegroundColor Cyan
  throw "No adb device online after build. Start AVD / USB phone, then install (commands above)."
}

Write-Host "==> wipe old Driver app + reinstall" -ForegroundColor Cyan
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $adb shell am force-stop com.poreiago.driver 2>$null | Out-Null
& $adb uninstall --user 0 com.poreiago.driver 2>$null | Out-Null
& $adb uninstall com.poreiago.driver 2>$null | Out-Null
$ErrorActionPreference = $prevEap
& $adb install -r -t --user 0 $apk
if ($LASTEXITCODE -ne 0) {
  Write-Host "install --user 0 failed - retry plain install -r" -ForegroundColor Yellow
  & $adb install -r $apk
}
if ($LASTEXITCODE -ne 0) { throw "install failed" }

Write-Host "==> launch PoreiaGo Driver" -ForegroundColor Cyan
$ErrorActionPreference = "Continue"
& $adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p com.poreiago.driver | Out-Host
$launchOk = ($LASTEXITCODE -eq 0)
if (-not $launchOk) {
  & $adb shell am start -W -n com.poreiago.driver/com.poreiago.driver.MainActivity | Out-Host
}
$ErrorActionPreference = "Stop"
Start-Sleep -Seconds 2
$ErrorActionPreference = "Continue"
$pidLine = & $adb shell pidof com.poreiago.driver 2>$null
$ErrorActionPreference = "Stop"
if (-not $pidLine) {
  throw "Driver app crashed on open - check logcat. Device Manager Wipe Data if Error type 3."
}
Write-Host ("DONE - Driver running (pid " + $pidLine.Trim() + "). Opens /driver command center.") -ForegroundColor Green
