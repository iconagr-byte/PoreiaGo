# ONE paste in PowerShell. Sets Java/SDK, builds APK, installs if emulator is up.
$ErrorActionPreference = "Stop"

$repo = "C:\Users\User\poreiago"
if (-not (Test-Path $repo)) { $repo = (Get-Location).Path }
Set-Location $repo

function Find-Jbr {
  $direct = @(
    (Join-Path $env:ProgramFiles "Android\Android Studio\jbr"),
    (Join-Path $env:LOCALAPPDATA "Programs\Android\Android Studio\jbr")
  )
  foreach ($j in $direct) {
    if ($j -and (Test-Path (Join-Path $j "bin\java.exe"))) { return $j }
  }
  $roots = @(
    (Join-Path $env:ProgramFiles "Android"),
    (Join-Path $env:LOCALAPPDATA "Programs\Android")
  )
  foreach ($root in $roots) {
    if (-not (Test-Path $root)) { continue }
    $hit = Get-ChildItem -Path $root -Directory -Filter "jbr" -Recurse -ErrorAction SilentlyContinue -Depth 5 |
      Where-Object { Test-Path (Join-Path $_.FullName "bin\java.exe") } |
      Select-Object -First 1 -ExpandProperty FullName
    if ($hit) { return $hit }
  }
  return $null
}

function Test-AndroidSdk($sdk) {
  if (-not $sdk) { return $false }
  if ($sdk.Length -lt 4) { return $false }
  if (-not (Test-Path -LiteralPath $sdk)) { return $false }
  $adb = Join-Path $sdk "platform-tools\adb.exe"
  return (Test-Path -LiteralPath $adb)
}

function Find-Sdk {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
    (Join-Path $env:USERPROFILE "AppData\Local\Android\Sdk"),
    (Join-Path $env:SystemDrive "Android\Sdk"),
    (Join-Path $env:USERPROFILE "Android\Sdk")
  )
  # Also read sdk.dir from any existing local.properties
  $lp = Join-Path $repo "android\local.properties"
  if (Test-Path $lp) {
    $line = Get-Content $lp | Where-Object { $_ -match '^\s*sdk\.dir=' } | Select-Object -First 1
    if ($line) {
      $val = ($line -split '=', 2)[1].Trim()
      $val = $val -replace '/', '\'
      $candidates = @($val) + $candidates
    }
  }
  foreach ($c in $candidates) {
    if (Test-AndroidSdk $c) { return $c }
  }
  # Last resort: search for adb.exe under Local\Android
  $searchRoot = Join-Path $env:LOCALAPPDATA "Android"
  if (Test-Path $searchRoot) {
    $adbHit = Get-ChildItem -Path $searchRoot -Filter "adb.exe" -Recurse -ErrorAction SilentlyContinue -Depth 6 |
      Select-Object -First 1
    if ($adbHit) {
      return $adbHit.Directory.Parent.FullName
    }
  }
  return $null
}

Write-Host "==> resolve Java / SDK" -ForegroundColor Cyan
$jbr = Find-Jbr
if (-not $jbr) {
  Write-Host "ERROR: Android Studio JBR not found." -ForegroundColor Red
  exit 1
}
$env:JAVA_HOME = $jbr
Write-Host "JAVA_HOME=$env:JAVA_HOME" -ForegroundColor Green

$sdk = Find-Sdk
if (-not $sdk) {
  Write-Host "ERROR: Android SDK / platform-tools not found." -ForegroundColor Red
  Write-Host "Fix in Android Studio:"
  Write-Host "  1) More Actions / Settings -> Languages & Frameworks -> Android SDK"
  Write-Host "  2) Copy 'Android SDK Location' path"
  Write-Host "  3) SDK Tools tab -> enable Android SDK Platform-Tools -> Apply"
  Write-Host "Then set and rerun:"
  Write-Host '  $env:ANDROID_HOME = "PASTE_SDK_PATH_HERE"'
  exit 1
}
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
# Clear a broken short ANDROID_HOME if it was C
Write-Host "ANDROID_HOME=$env:ANDROID_HOME" -ForegroundColor Green

$adb = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
Write-Host "ADB=$adb"

$sdkSlash = ($env:ANDROID_HOME -replace '\\', '/')
Set-Content -Path (Join-Path $repo "android\local.properties") -Value ("sdk.dir=" + $sdkSlash) -Encoding ASCII

Write-Host "==> git sync branch tip" -ForegroundColor Cyan
git fetch origin cursor/wallet-android-capacitor-5ffb
git checkout cursor/wallet-android-capacitor-5ffb
git reset --hard origin/cursor/wallet-android-capacitor-5ffb

Write-Host "==> npm run cap:sync:packaged" -ForegroundColor Cyan
npm.cmd run cap:sync:packaged
if ($LASTEXITCODE -ne 0) { throw "cap:sync:packaged failed" }

Write-Host "==> gradlew assembleDebug" -ForegroundColor Cyan
Set-Location (Join-Path $repo "android")
& .\gradlew.bat --no-daemon assembleDebug
if ($LASTEXITCODE -ne 0) { throw "assembleDebug failed" }

$apk = Join-Path $repo "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path -LiteralPath $apk)) { throw "APK missing: $apk" }
Write-Host "BUILD OK: $apk" -ForegroundColor Green

Write-Host "==> adb devices" -ForegroundColor Cyan
& $adb start-server
& $adb devices
$online = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "device$" }
if (-not $online) {
  Write-Host "No emulator online. Device Manager -> Play, then:" -ForegroundColor Yellow
  Write-Host ('  & "' + $adb + '" install -r "' + $apk + '"')
  exit 0
}

Write-Host "==> adb install" -ForegroundColor Cyan
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { throw "adb install failed" }
Write-Host "Installed. Open PoreiaGo Wallet on the emulator." -ForegroundColor Green
