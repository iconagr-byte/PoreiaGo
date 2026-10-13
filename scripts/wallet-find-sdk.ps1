# Find Android SDK / adb / Java on this PC
$ErrorActionPreference = "Continue"
Write-Host "LOCALAPPDATA=$env:LOCALAPPDATA"
Write-Host "USERPROFILE=$env:USERPROFILE"
Write-Host "ANDROID_HOME(raw)=$env:ANDROID_HOME"
Write-Host "ANDROID_SDK_ROOT(raw)=$env:ANDROID_SDK_ROOT"
Write-Host ""

$paths = @(
  (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
  (Join-Path $env:USERPROFILE "AppData\Local\Android\Sdk"),
  (Join-Path $env:USERPROFILE "Android\Sdk")
)
foreach ($p in $paths) {
  $adb = Join-Path $p "platform-tools\adb.exe"
  Write-Host ("SDK candidate: " + $p)
  Write-Host ("  exists=" + (Test-Path -LiteralPath $p) + " adb=" + (Test-Path -LiteralPath $adb))
}

Write-Host ""
Write-Host "Searching for adb.exe under Local AppData (may take a minute)..."
$hits = Get-ChildItem -Path $env:LOCALAPPDATA -Filter "adb.exe" -Recurse -ErrorAction SilentlyContinue -Depth 8 |
  Select-Object -First 5 FullName
if ($hits) { $hits | ForEach-Object { Write-Host ("FOUND " + $_.FullName) -ForegroundColor Green } }
else { Write-Host "No adb.exe found under LOCALAPPDATA" -ForegroundColor Yellow }

Write-Host ""
Write-Host "In Android Studio: Settings -> Android SDK -> copy Android SDK Location"
