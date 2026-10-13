# ONE paste in PowerShell. Sets Java/SDK, builds APK, installs if emulator is up.
$ErrorActionPreference = "Stop"

$repo = "C:\Users\User\poreiago"
if (-not (Test-Path $repo)) { $repo = (Get-Location).Path }
Set-Location $repo

# --- find JAVA_HOME (Android Studio jbr) ---
$jbrHits = @()
$searchRoots = @(
  "$env:ProgramFiles\Android",
  "$env:LOCALAPPDATA\Programs\Android",
  "$env:ProgramFiles"
)
foreach ($root in $searchRoots) {
  if (-not (Test-Path $root)) { continue }
  $jbrHits += Get-ChildItem -Path $root -Directory -Filter "jbr" -Recurse -ErrorAction SilentlyContinue -Depth 4 |
    Where-Object { Test-Path (Join-Path $_.FullName "bin\java.exe") } |
    Select-Object -ExpandProperty FullName
}
$jbrHits = $jbrHits | Select-Object -Unique
if (-not $jbrHits -or $jbrHits.Count -eq 0) {
  Write-Host "ERROR: Android Studio JBR not found." -ForegroundColor Red
  Write-Host "Open Android Studio -> Settings -> Build Tools -> Gradle -> copy Gradle JDK path"
  exit 1
}
$env:JAVA_HOME = $jbrHits[0]
Write-Host "JAVA_HOME=$env:JAVA_HOME" -ForegroundColor Green

# --- find Android SDK ---
$sdkHits = @(
  "$env:LOCALAPPDATA\Android\Sdk",
  "$env:USERPROFILE\AppData\Local\Android\Sdk",
  $env:ANDROID_HOME,
  $env:ANDROID_SDK_ROOT
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
if (-not $sdkHits -or $sdkHits.Count -eq 0) {
  Write-Host "ERROR: Android SDK not found at %LOCALAPPDATA%\Android\Sdk" -ForegroundColor Red
  Write-Host "Open Android Studio -> SDK Manager -> install Android SDK Platform-Tools"
  exit 1
}
$env:ANDROID_HOME = $sdkHits[0]
$env:ANDROID_SDK_ROOT = $sdkHits[0]
Write-Host "ANDROID_HOME=$env:ANDROID_HOME" -ForegroundColor Green

$adb = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
  Write-Host "ERROR: adb missing: $adb" -ForegroundColor Red
  Write-Host "SDK Manager -> SDK Tools -> Android SDK Platform-Tools -> Apply"
  exit 1
}

# local.properties for Gradle
$sdkSlash = ($env:ANDROID_HOME -replace '\\','/')
Set-Content -Path (Join-Path $repo "android\local.properties") -Value "sdk.dir=$sdkSlash" -Encoding ASCII

# pull latest wallet branch files (optional if already current)
git fetch origin cursor/wallet-android-capacitor-5ffb 2>$null
git checkout cursor/wallet-android-capacitor-5ffb 2>$null
git reset --hard origin/cursor/wallet-android-capacitor-5ffb 2>$null

Write-Host "==> npm run cap:sync:packaged" -ForegroundColor Cyan
npm.cmd run cap:sync:packaged
if ($LASTEXITCODE -ne 0) { throw "cap:sync:packaged failed" }

Write-Host "==> gradlew assembleDebug" -ForegroundColor Cyan
Set-Location (Join-Path $repo "android")
& .\gradlew.bat --no-daemon assembleDebug
if ($LASTEXITCODE -ne 0) { throw "assembleDebug failed" }

$apk = Join-Path $repo "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apk)) { throw "APK missing: $apk" }
Write-Host "BUILD OK: $apk" -ForegroundColor Green

Write-Host "==> adb devices" -ForegroundColor Cyan
& $adb start-server
& $adb devices
$online = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "device$" }
if (-not $online) {
  Write-Host "No emulator online. In Android Studio: Device Manager -> Play on a device, then run again:" -ForegroundColor Yellow
  Write-Host "  & `"$adb`" install -r `"$apk`""
  exit 0
}

Write-Host "==> adb install" -ForegroundColor Cyan
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { throw "adb install failed" }
Write-Host "Installed. Open PoreiaGo Wallet on the emulator." -ForegroundColor Green
