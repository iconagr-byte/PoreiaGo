# PoreiaGo - light Windows helper (sync + assembleDebug). Prefer wallet-run.ps1.
# Usage:
#   cd C:\Users\User\poreiago
#   git fetch origin main; git checkout main; git pull origin main
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-android-fix.ps1
# Studio Unknown error: see docs/ANDROID-WALLET.md or wallet-studio-prep.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Assert-Ok($code, $msg) {
  if ($code -ne 0) { throw $msg }
}

function Find-AndroidStudioJbr {
  $candidates = @(
    "$env:ProgramFiles\Android\Android Studio\jbr",
    "${env:ProgramFiles(x86)}\Android\Android Studio\jbr",
    "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr",
    "$env:ProgramFiles\Android\Android Studio\jre",
    "$env:LOCALAPPDATA\Programs\Android\Android Studio\jre"
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path (Join-Path $c "bin\java.exe"))) { return $c }
  }
  # Search one level under common install roots
  $roots = @(
    "$env:ProgramFiles\Android",
    "$env:LOCALAPPDATA\Programs\Android"
  )
  foreach ($r in $roots) {
    if (-not (Test-Path $r)) { continue }
    $hit = Get-ChildItem -Path $r -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like "Android Studio*" } |
      ForEach-Object {
        $jbr = Join-Path $_.FullName "jbr"
        if (Test-Path (Join-Path $jbr "bin\java.exe")) { $jbr }
      } | Select-Object -First 1
    if ($hit) { return $hit }
  }
  return $null
}

function Find-AndroidSdk {
  $candidates = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    "$env:LOCALAPPDATA\Android\Sdk",
    "$env:USERPROFILE\AppData\Local\Android\Sdk",
    "$env:ProgramFiles\Android\Sdk"
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { return $c }
  }
  return $null
}

Write-Host "==> resolve JAVA_HOME / Android SDK" -ForegroundColor Cyan
if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
  $jbr = Find-AndroidStudioJbr
  if (-not $jbr) {
    throw "JAVA_HOME missing. Install Android Studio, then set JAVA_HOME to its jbr folder (usually C:\Program Files\Android\Android Studio\jbr)"
  }
  $env:JAVA_HOME = $jbr
}
Write-Host "JAVA_HOME=$env:JAVA_HOME"

$sdk = Find-AndroidSdk
if (-not $sdk) {
  throw "Android SDK not found. Open Android Studio once -> More Actions -> SDK Manager -> install Android SDK"
}
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
Write-Host "ANDROID_HOME=$env:ANDROID_HOME"

$adb = Join-Path $sdk "platform-tools\adb.exe"
$localProps = Join-Path $root "android\local.properties"
$sdkPathEscaped = $sdk -replace '\\', '/'
Set-Content -Path $localProps -Value "sdk.dir=$sdkPathEscaped" -Encoding ASCII
Write-Host "Wrote android\local.properties"

Write-Host "==> discard local capacitor.config.json" -ForegroundColor Cyan
git checkout -- capacitor.config.json 2>$null
git restore capacitor.config.json 2>$null

Write-Host "==> ensure wallet Android branch" -ForegroundColor Cyan
git fetch origin cursor/wallet-android-capacitor-5ffb
Assert-Ok $LASTEXITCODE "git fetch failed"
git checkout cursor/wallet-android-capacitor-5ffb
Assert-Ok $LASTEXITCODE "checkout branch failed"
git reset --hard origin/cursor/wallet-android-capacitor-5ffb
Assert-Ok $LASTEXITCODE "git reset --hard failed"

Write-Host "==> npm install" -ForegroundColor Cyan
npm.cmd install
Assert-Ok $LASTEXITCODE "npm install failed"

Write-Host "==> cap:sync:packaged (My Wallet only)" -ForegroundColor Cyan
npm.cmd run cap:sync:packaged
Assert-Ok $LASTEXITCODE "cap:sync:packaged failed"

$cfgPath = Join-Path $root "android\app\src\main\assets\capacitor.config.json"
if (-not (Test-Path $cfgPath)) {
  throw "ERROR: missing $cfgPath - sync did not copy assets"
}
$cfg = Get-Content $cfgPath -Raw
if ($cfg -match '"server"') {
  throw "ERROR: capacitor.config still has server.url - packaged sync failed"
}

$androidDir = Join-Path $root "android"
$gradlew = Join-Path $androidDir "gradlew.bat"
if (-not (Test-Path $gradlew)) {
  throw "ERROR: missing android\gradlew.bat"
}

Write-Host "==> Gradle assembleDebug" -ForegroundColor Cyan
Push-Location $androidDir
try {
  & $gradlew --no-daemon assembleDebug
  Assert-Ok $LASTEXITCODE "Gradle assembleDebug failed - copy the red lines above"
} finally {
  Pop-Location
}

$apk = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apk)) {
  throw "ERROR: APK not found at $apk"
}

Write-Host ""
Write-Host "BUILD OK: $apk" -ForegroundColor Green

# Try install if emulator/device is up
if (Test-Path $adb) {
  Write-Host "==> adb devices" -ForegroundColor Cyan
  & $adb devices
  $devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "device$" }
  if ($devices) {
    Write-Host "==> adb install" -ForegroundColor Cyan
    & $adb install -r $apk
    if ($LASTEXITCODE -eq 0) {
      Write-Host "APK installed. Open PoreiaGo Wallet on the emulator." -ForegroundColor Green
    } else {
      Write-Host "adb install failed - start emulator in Android Studio, then rerun this script." -ForegroundColor Yellow
    }
  } else {
    Write-Host "No emulator/device online." -ForegroundColor Yellow
    Write-Host "Start emulator in Android Studio Device Manager, then run:"
    Write-Host "  & `"$adb`" install -r `"$apk`""
  }
} else {
  Write-Host "adb not found at $adb - install Platform-Tools from SDK Manager." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Android Studio:" -ForegroundColor Green
Write-Host "  1) File -> Open -> $androidDir"
Write-Host "  2) Settings -> Gradle -> Gradle JDK = 21 (or Studio jbr)"
Write-Host "  3) Device Manager -> start emulator"
Write-Host "  4) Run app"
Write-Host ""
