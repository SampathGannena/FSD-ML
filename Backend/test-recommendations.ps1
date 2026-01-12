# PowerShell script to test recommendation system
# Run this from Backend directory: .\test-recommendations.ps1

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "RECOMMENDATION SYSTEM TEST SUITE" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Activate virtual environment if it exists
$venvPath = ".\ml\venv\Scripts\Activate.ps1"
if (Test-Path $venvPath) {
    Write-Host "[INFO] Activating virtual environment..." -ForegroundColor Yellow
    & $venvPath
    Write-Host "✓ Virtual environment activated" -ForegroundColor Green
} else {
    Write-Host "[WARN] No virtual environment found at ml\venv\" -ForegroundColor Yellow
    Write-Host "       Using system Python" -ForegroundColor Yellow
}

Write-Host ""

# Test 1: Python availability
Write-Host "[1/5] Checking Python..." -ForegroundColor Cyan
$pythonVersion = python --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Python not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Run dependency test
Write-Host "[2/5] Running dependency test..." -ForegroundColor Cyan
python .\ml\test_recommendations.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Dependency test failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 3: Check if server is running
Write-Host "[3/5] Checking if Node.js server is running..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/recommendations/status" -Method GET -TimeoutSec 3 -ErrorAction Stop
    Write-Host "✓ Server is running!" -ForegroundColor Green
    Write-Host "Status response:" -ForegroundColor Gray
    Write-Host $response.Content -ForegroundColor Gray
} catch {
    Write-Host "⚠ Server not running or endpoint not available" -ForegroundColor Yellow
    Write-Host "  Start server with: node server.js" -ForegroundColor Yellow
}

Write-Host ""

# Test 4: Test Python API directly
Write-Host "[4/5] Testing Python API directly..." -ForegroundColor Cyan
$statusResult = python .\ml\api\recommendation_api.py --action status --params '{}'
Write-Host "Status: $statusResult" -ForegroundColor Gray

Write-Host ""

# Test 5: Provide test commands
Write-Host "[5/5] Available test commands:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Initialize system:" -ForegroundColor Yellow
Write-Host '  Invoke-WebRequest -Uri "http://localhost:3000/api/recommendations/initialize" -Method POST' -ForegroundColor White
Write-Host ""
Write-Host "Get mentor recommendations:" -ForegroundColor Yellow
Write-Host '  Invoke-WebRequest -Uri "http://localhost:3000/api/recommendations/mentors?userId=YOUR_USER_ID&limit=10" -Method GET' -ForegroundColor White
Write-Host ""
Write-Host "Get session recommendations:" -ForegroundColor Yellow
Write-Host '  Invoke-WebRequest -Uri "http://localhost:3000/api/recommendations/sessions?userId=YOUR_USER_ID&limit=10" -Method GET' -ForegroundColor White
Write-Host ""
Write-Host "Get group recommendations:" -ForegroundColor Yellow
Write-Host '  Invoke-WebRequest -Uri "http://localhost:3000/api/recommendations/groups?userId=YOUR_USER_ID&limit=10" -Method GET' -ForegroundColor White
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "TEST COMPLETE" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
