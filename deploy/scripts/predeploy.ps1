# OLYMPUS pre-deploy gate (Windows / local staging)
param(
    [string]$EnvFile = "",
    [string]$ApiBase = "",
    [switch]$Migrate,
    [switch]$Strict,
    [switch]$SkipTests,
    [switch]$SkipConnectivity
)

$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not $EnvFile) {
    $EnvFile = Join-Path $RepoRoot "deploy\.env.olympus.prod"
}

$Backend = Join-Path $RepoRoot "backend"
Set-Location $Backend

$args = @("-m", "scripts.predeploy_check")
if (Test-Path $EnvFile) {
    $args += @("--env-file", $EnvFile)
} else {
    Write-Host "WARN: Env file not found: $EnvFile — using current environment"
}
if ($Migrate) { $args += "--migrate" }
if ($ApiBase) { $args += @("--api-base", $ApiBase) }
if ($Strict) { $args += "--strict" }
if ($SkipTests) { $args += "--skip-tests" }
if ($SkipConnectivity) { $args += "--skip-connectivity" }

Write-Host "Running: python $($args -join ' ')"
python @args
exit $LASTEXITCODE
