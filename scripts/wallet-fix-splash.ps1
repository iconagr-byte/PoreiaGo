# Force-rebuild Wallet with Apple splash + full tabs (never uses stale main).
# ASCII-only (Windows PowerShell 5.1).
#
# If this file is MISSING (you are on main), run THIS instead:
#   cd C:\Users\User\poreiago
#   powershell -ExecutionPolicy Bypass -File .\scripts\wallet-run.ps1 -Branch cursor/wallet-splash-apple-5ffb

$ErrorActionPreference = "Stop"
$repo = "C:\Users\User\poreiago"
$branch = "cursor/wallet-splash-apple-5ffb"

if (-not (Test-Path -LiteralPath $repo)) {
  throw ("Repo missing: " + $repo)
}
Set-Location $repo

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  PoreiaGo Wallet - Apple splash rebuild" -ForegroundColor Cyan
Write-Host ("  Branch: " + $branch) -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

git fetch origin $branch
if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }
git checkout $branch
if ($LASTEXITCODE -ne 0) { throw "git checkout failed - run from C:\Users\User\poreiago" }
git reset --hard ("origin/" + $branch)
if ($LASTEXITCODE -ne 0) { throw "git reset failed" }
git log -1 --oneline

& powershell -ExecutionPolicy Bypass -File (Join-Path $repo "scripts\wallet-run.ps1") -Branch $branch
if ($LASTEXITCODE -ne 0) { throw "wallet-run failed" }

Write-Host ""
Write-Host "OK - rebuild finished. Confirm Apple splash + full tabs on device." -ForegroundColor Green
