# Quick Activate Script for Virtual Environment
# Usage: .\activate-venv.ps1

$venvPath = Join-Path $PSScriptRoot "Backend\ml\venv\Scripts\Activate.ps1"

if (Test-Path $venvPath) {
    Write-Host "Activating virtual environment..." -ForegroundColor Green
    Set-Location (Join-Path $PSScriptRoot "Backend\ml")
    & $venvPath
    Write-Host "✓ Virtual environment activated" -ForegroundColor Green
    Write-Host "Location: Backend\ml\" -ForegroundColor Gray
    Write-Host "Type 'deactivate' to exit" -ForegroundColor Gray
} else {
    Write-Host "Virtual environment not found!" -ForegroundColor Red
    Write-Host "Run setup first: .\setup-recommendations.ps1" -ForegroundColor Yellow
    exit 1
}
