# ONE paste in PowerShell. Sets Java/SDK, builds APK, installs if emulator is up.
$ErrorActionPreference = "Stop"

$repo = "C:\Users\User\poreiago"
if (-not (Test-Path $repo)) { $repo = (Get-Location).Path }
Set-Location $repo

# Clear broken env values like ANDROID_HOME=C from earlier attempts
foreach ($name in @("ANDROID_HOME", "ANDROID_SDK_ROOT")) {
  $cur = [Environment]::GetEnvironmentVariable($name, "Process")
  if ($cur -and ($cur.Length -lt 4 -or -not (Test-Path -LiteralPath $cur))) {
    Remove-Item ("Env:" + $name) -ErrorAction SilentlyContinue
    Write-Host ("Cleared bad " + $name + "=" + $cur) -ForegroundColor Yellow
  }
}

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
  if ($sdk.Length -lt 8) { return $false }
  if ($sdk -notmatch '[\\/]') { return $false }
  if (-not (Test-Path -LiteralPath $sdk)) { return $false }
  return (Test-Path -LiteralPath (Join-Path $sdk "platform-tools\adb.exe"))
}

function Find-Sdk {
  $candidates = New-Object System.Collections.Generic.List[string]
  foreach ($c in @(
      (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
      (Join-Path $env:USERPROFILE "AppData\Local\Android\Sdk"),
      (Join-Path $env:SystemDrive "Android\Sdk"),
      (Join-Path $env:USERPROFILE "Android\Sdk")
    )) {
    if ($c) { [void]$candidates.Add($c) }
  }
  $lp = Join-Path $repo "android\local.properties"
  if (Test-Path $lp) {
    $line = Get-Content $lp | Where-Object { $_ -match '^\s*sdk\.dir=' } | Select-Object -First 1
    if ($line) {
      $val = ($line -split '=', 2)[1].Trim().Trim('"')
      $val = $val -replace '/', '\'
      $candidates.Insert(0, $val)
    }
  }
  foreach ($c in $candidates) {
    Write-Host ("check SDK: " + $c)
    if (Test-AndroidSdk $c) { return $c }
  }
  $searchRoot = Join-Path $env:LOCALAPPDATA "Android"
  if (Test-Path $searchRoot) {
    $adbHit = Get-ChildItem -Path $searchRoot -Filter "adb.exe" -Recurse -ErrorAction SilentlyContinue -Depth 6 |
      Select-Object -First 1
    if ($adbHit) { return $adbHit.Directory.Parent.FullName }
  }
  return $null
}

Write-Host "==> fetch latest branch" -ForegroundColor Cyan
git fetch origin cursor/wallet-android-capacitor-5ffb
git checkout cursor/wallet-android-capacitor-5ffb
git reset --hard origin/cursor/wallet-android-capacitor-5ffb
git log -1 --oneline

Write-Host "==> resolve Java / SDK" -ForegroundColor Cyan
$jbr = Find-Jbr
if (-not $jbr) { throw "Android Studio JBR not found" }
$env:JAVA_HOME = $jbr
Write-Host ("JAVA_HOME=" + $env:JAVA_HOME) -ForegroundColor Green

$sdk = Find-Sdk
if (-not $sdk) {
  Write-Host "ERROR: Android SDK platform-tools not found." -ForegroundColor Red
  Write-Host "Open Android Studio -> Settings -> Android SDK"
  Write-Host "  - note Android SDK Location"
  Write-Host "  - SDK Tools -> Android SDK Platform-Tools -> Apply"
  Write-Host "Then run:"
  Write-Host '  Remove-Item Env:ANDROID_HOME -ErrorAction SilentlyContinue'
  Write-Host '  $env:ANDROID_HOME = "C:\Users\User\AppData\Local\Android\Sdk"'
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\wallet-build-once.ps1"
  Write-Host "Or diagnose:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\wallet-find-sdk.ps1"
  exit 1
}
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
Write-Host ("ANDROID_HOME=" + $env:ANDROID_HOME) -ForegroundColor Green
$adb = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
Write-Host ("ADB=" + $adb)

$sdkSlash = ($env:ANDROID_HOME -replace '\\', '/')
Set-Content -Path (Join-Path $repo "android\local.properties") -Value ("sdk.dir=" + $sdkSlash) -Encoding ASCII

Write-Host "==> npm run cap:sync:packaged" -ForegroundColor Cyan
npm.cmd run cap:sync:packaged
if ($LASTEXITCODE -ne 0) { throw "cap:sync:packaged failed" }

Write-Host "==> gradlew assembleDebug" -ForegroundColor Cyan
Set-Location (Join-Path $repo "android")
& .\gradlew.bat --no-daemon assembleDebug
if ($LASTEXITCODE -ne 0) { throw "assembleDebug failed" }

$apk = Join-Path $repo "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path -LiteralPath $apk)) { throw "APK missing" }
Write-Host ("BUILD OK: " + $apk) -ForegroundColor Green

& $adb start-server
& $adb devices
$online = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "device$" }
if (-not $online) {
  Write-Host "Start emulator in Device Manager, then:" -ForegroundColor Yellow
  Write-Host ('  & "' + $adb + '" install -r "' + $apk + '"')
  exit 0
}
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { throw "adb install failed" }
Write-Host "Installed. Open PoreiaGo Wallet on the emulator." -ForegroundColor Green
