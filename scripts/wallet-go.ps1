# One-shot: pull latest, install Wallet APK (rebuild only if needed).
# Paste this from ANY folder:
#   powershell -ExecutionPolicy Bypass -File C:\Users\User\poreiago\scripts\wallet-go.ps1
# ASCII-only (no BOM) for Windows PowerShell 5.1.

$ErrorActionPreference = "Stop"
$repo = "C:\Users\User\poreiago"
$branch = "cursor/wallet-native-theme-isolate-5ffb"

if (-not (Test-Path -LiteralPath $repo)) {
  throw ("Repo missing: " + $repo)
}
Set-Location $repo

Write-Host ("==> git fetch/reset " + $branch) -ForegroundColor Cyan
git fetch origin $branch
if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }
git checkout $branch
if ($LASTEXITCODE -ne 0) { throw "git checkout failed" }
git reset --hard ("origin/" + $branch)
if ($LASTEXITCODE -ne 0) { throw "git reset failed" }
git log -1 --oneline

$apk = Join-Path $repo "android\app\build\outputs\apk\debug\app-debug.apk"
$open = Join-Path $repo "scripts\wallet-open.ps1"
if (-not (Test-Path -LiteralPath $open)) {
  throw ("Missing " + $open)
}

# Prefer install-only when a SocialLogin APK already exists (skips 30s+ gradle).
$needRebuild = $true
if (Test-Path -LiteralPath $apk) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $tmp = Join-Path $env:TEMP ("pg-go-" + [guid]::NewGuid().ToString("n"))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    [System.IO.Compression.ZipFile]::ExtractToDirectory($apk, $tmp)
    $plugins = Join-Path $tmp "assets\capacitor.plugins.json"
    if (Test-Path -LiteralPath $plugins) {
      $txt = Get-Content -LiteralPath $plugins -Raw -ErrorAction SilentlyContinue
      if ($txt -match 'SocialLoginPlugin') {
        foreach ($dex in @(Get-ChildItem -LiteralPath $tmp -Filter "classes*.dex" -File -ErrorAction SilentlyContinue)) {
          $ascii = [System.Text.Encoding]::ASCII.GetString([System.IO.File]::ReadAllBytes($dex.FullName))
          if ($ascii -match 'SocialLoginPlugin' -or $ascii -match 'ee/forgr/capacitor/social/login') {
            $needRebuild = $false
            break
          }
        }
      }
    }
  } catch {
    $needRebuild = $true
  } finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

if ($needRebuild) {
  Write-Host "==> no good SocialLogin APK - full rebuild" -ForegroundColor Yellow
  & powershell -ExecutionPolicy Bypass -File $open -Rebuild
} else {
  Write-Host "==> reusing existing SocialLogin APK - install only" -ForegroundColor Green
  & powershell -ExecutionPolicy Bypass -File $open
}
if ($LASTEXITCODE -ne 0) { throw "wallet-open failed" }
Write-Host "DONE - try Σύνδεση με Google inside My Wallet (not Chrome)." -ForegroundColor Green
