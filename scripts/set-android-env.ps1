# Sets JAVA_HOME + ANDROID_HOME for this PowerShell session (Android Studio defaults).
# Usage:
#   cd C:\Users\User\poreiago
#   . .\scripts\set-android-env.ps1

$jbrCandidates = @(
  "$env:ProgramFiles\Android\Android Studio\jbr",
  "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr"
)
foreach ($j in $jbrCandidates) {
  if (Test-Path "$j\bin\java.exe") {
    $env:JAVA_HOME = $j
    break
  }
}
if (-not $env:JAVA_HOME) {
  Write-Host "JAVA_HOME not found. Open Android Studio once and install JDK / use embedded jbr." -ForegroundColor Red
} else {
  Write-Host "JAVA_HOME=$env:JAVA_HOME" -ForegroundColor Green
}

$sdkCandidates = @(
  $env:ANDROID_HOME,
  "$env:LOCALAPPDATA\Android\Sdk"
)
foreach ($s in $sdkCandidates) {
  if ($s -and (Test-Path $s)) {
    $env:ANDROID_HOME = $s
    $env:ANDROID_SDK_ROOT = $s
    break
  }
}
if (-not $env:ANDROID_HOME) {
  Write-Host "ANDROID_HOME not found." -ForegroundColor Red
} else {
  Write-Host "ANDROID_HOME=$env:ANDROID_HOME" -ForegroundColor Green
  $env:Path = "$env:ANDROID_HOME\platform-tools;$env:JAVA_HOME\bin;$env:Path"
}
