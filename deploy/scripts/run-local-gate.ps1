# Local OLYMPUS gate — start Docker services then run full pre-deploy.
# Usage: .\deploy\scripts\run-local-gate.ps1
param(
    [switch]$SkipDocker,
    [switch]$Migrate,
    [switch]$Strict
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $RepoRoot

function Test-DockerRunning {
    try {
        docker info 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

if (-not $SkipDocker) {
    if (-not (Test-DockerRunning)) {
        Write-Host ""
        Write-Host "Docker Desktop is not running." -ForegroundColor Yellow
        Write-Host "  1. Start Docker Desktop"
        Write-Host "  2. Re-run: .\deploy\scripts\run-local-gate.ps1"
        Write-Host ""
        Write-Host "Continuing with tests + API smoke only (no Postgres/Redis/migrate)..." -ForegroundColor Yellow
        $SkipDocker = $true
    } else {
        Write-Host "Starting db + redis..."
        docker compose up -d db redis
        Write-Host "Waiting for Postgres (15s)..."
        Start-Sleep -Seconds 15
        $Migrate = $true
    }
}

$predeployArgs = @("-Strict")
if ($Migrate) { $predeployArgs += "-Migrate" }

$apiUp = $false
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 3
    $apiUp = $r.StatusCode -eq 200
} catch { }

if ($apiUp) {
    $predeployArgs += @("-ApiBase", "http://localhost:8000")
} else {
    Write-Host "API not on :8000 — start with: npm run dev:backend" -ForegroundColor Yellow
    $predeployArgs += "-SkipConnectivity"
}

if ($SkipDocker -and -not $apiUp) {
    $predeployArgs += "-SkipConnectivity"
}

& "$RepoRoot\deploy\scripts\predeploy.ps1" @predeployArgs
exit $LASTEXITCODE
