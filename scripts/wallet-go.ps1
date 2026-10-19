# One-shot: pull latest, install Wallet APK (rebuild only if needed).
# Paste this from ANY folder:
#   powershell -ExecutionPolicy Bypass -File C:\Users\User\poreiago\scripts\wallet-go.ps1
# ASCII-only (no BOM) for Windows PowerShell 5.1.

$ErrorActionPreference = "Stop"
$repo = "C:\Users\User\poreiago"
$branch = "main"

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

# Always full rebuild after pull — JS/native Google fixes must land in assets.
Write-Host "==> full rebuild + install (Google Sign-In fix)" -ForegroundColor Cyan
& powershell -ExecutionPolicy Bypass -File $open -Rebuild
if ($LASTEXITCODE -ne 0) { throw "wallet-open failed" }
Write-Host "DONE - try Σύνδεση με Google inside My Wallet (not Chrome)." -ForegroundColor Green
