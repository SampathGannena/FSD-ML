# Recommendation System Setup Script
# Run this to install and configure the ML recommendation system

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  FSD-ML Recommendation System Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check Python installation
Write-Host "Checking Python installation..." -ForegroundColor Yellow
$pythonVersion = python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Python not found. Please install Python 3.8+" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Found: $pythonVersion" -ForegroundColor Green

# Check pip
Write-Host "Checking pip..." -ForegroundColor Yellow
$pipVersion = pip --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: pip not found. Please install pip" -ForegroundColor Red
    exit 1
}
Write-Host "✓ pip is available" -ForegroundColor Green

# Navigate to ml directory
Write-Host "`nNavigating to Backend/ml directory..." -ForegroundColor Yellow
$mlPath = Join-Path $PSScriptRoot "Backend\ml"
if (-not (Test-Path $mlPath)) {
    Write-Host "ERROR: Backend/ml directory not found at $mlPath" -ForegroundColor Red
    exit 1
}
Set-Location -Path $mlPath

# Create virtual environment
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Setting up Python Virtual Environment..." -ForegroundColor Yellow
Write-Host "This isolates dependencies from your global Python installation" -ForegroundColor Gray

$venvPath = "venv"
if (Test-Path $venvPath) {
    Write-Host "⚠ Virtual environment already exists" -ForegroundColor Yellow
    Write-Host "Delete and recreate? (Y/N)" -ForegroundColor Yellow
    $response = Read-Host
    
    if ($response -eq 'Y' -or $response -eq 'y') {
        Write-Host "Removing existing virtual environment..." -ForegroundColor Gray
        Remove-Item -Recurse -Force $venvPath
    } else {
        Write-Host "Using existing virtual environment" -ForegroundColor Gray
    }
}

if (-not (Test-Path $venvPath)) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Virtual environment created" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Failed to create virtual environment" -ForegroundColor Red
        exit 1
    }
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
$activateScript = Join-Path $venvPath "Scripts\Activate.ps1"

if (Test-Path $activateScript) {
    & $activateScript
    Write-Host "✓ Virtual environment activated" -ForegroundColor Green
} else {
    Write-Host "ERROR: Activation script not found" -ForegroundColor Red
    exit 1
}

# Upgrade pip in virtual environment
Write-Host "`nUpgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip --quiet

# Install Python dependencies
Write-Host "`nInstalling Python dependencies..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Gray

pip install -r requirements.txt

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Python dependencies installed successfully in virtual environment" -ForegroundColor Green
} else {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    Write-Host "Try manually:" -ForegroundColor Yellow
    Write-Host "  cd Backend\ml" -ForegroundColor Cyan
    Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor Cyan
    Write-Host "  pip install -r requirements.txt" -ForegroundColor Cyan
    exit 1
}

# Optional: Install PyTorch for GNN
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Optional: Install PyTorch for GNN support?" -ForegroundColor Cyan
Write-Host "This adds ~2GB but enables graph-based recommendations" -ForegroundColor Gray
Write-Host "Press 'Y' to install PyTorch, or any other key to skip" -ForegroundColor Yellow
$response = Read-Host

if ($response -eq 'Y' -or $response -eq 'y') {
    Write-Host "Installing PyTorch..." -ForegroundColor Yellow
    pip install torch torch-geometric
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ PyTorch installed successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠ PyTorch installation failed. GNN will be disabled" -ForegroundColor Yellow
    }
} else {
    Write-Host "Skipping PyTorch installation. GNN will be disabled" -ForegroundColor Gray
}

# Check MongoDB connection
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Checking MongoDB connection..." -ForegroundColor Yellow

# Load .env file
Set-Location -Path "$PSScriptRoot\Backend"
if (Test-Path ".env") {
    Write-Host "✓ Found .env file" -ForegroundColor Green
    
    # Simple check - we can't easily test MongoDB from PowerShell
    # User will need to verify manually
    Write-Host "⚠ Please verify MONGODB_URI in .env is correct" -ForegroundColor Yellow
} else {
    Write-Host "⚠ .env file not found" -ForegroundColor Yellow
    Write-Host "Creating .env from .env.example..." -ForegroundColor Gray
    
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✓ Created .env file. Please configure MONGODB_URI" -ForegroundColor Green
    } else {
        Write-Host "⚠ .env.example not found. Please create .env manually" -ForegroundColor Yellow
    }
}

# Add route to server.js
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Checking server.js integration..." -ForegroundColor Yellow

$serverFile = "server.js"
if (Test-Path $serverFile) {
    $content = Get-Content $serverFile -Raw
    
    if ($content -match "recommendationRoutes") {
        Write-Host "✓ Recommendation routes already integrated" -ForegroundColor Green
    } else {
        Write-Host "⚠ Please add this to server.js:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "const recommendationRoutes = require('./routes/recommendationRoutes');" -ForegroundColor Cyan
        Write-Host "app.use('/api/recommendations', recommendationRoutes);" -ForegroundColor Cyan
        Write-Host ""
    }
} else {
    Write-Host "⚠ server.js not found. Make sure you're in the correct directory" -ForegroundColor Yellow
}

# Installation complete
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "✓ Virtual environment created at: Backend/ml/venv" -ForegroundColor Green
Write-Host "✓ Python dependencies installed" -ForegroundColor Green
Write-Host ""

Write-Host "IMPORTANT: Activate the virtual environment before running Python scripts:" -ForegroundColor Yellow
Write-Host "  cd Backend\ml" -ForegroundColor Cyan
Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Verify MongoDB connection in Backend/.env" -ForegroundColor White
Write-Host "2. Add recommendation routes to server.js (if not already added)" -ForegroundColor White
Write-Host "3. Start your server: npm start" -ForegroundColor White
Write-Host "4. Initialize the system:" -ForegroundColor White
Write-Host "   POST http://localhost:3000/api/recommendations/initialize" -ForegroundColor Cyan
Write-Host ""

Write-Host "Documentation:" -ForegroundColor Yellow
Write-Host "- Quick Start: Backend/ml/QUICKSTART.md" -ForegroundColor White
Write-Host "- Full Docs:   Backend/ml/README.md" -ForegroundColor White
Write-Host ""

Write-Host "Virtual Environment Info:" -ForegroundColor Yellow
Write-Host "- Location: Backend/ml/venv/" -ForegroundColor White
Write-Host "- Activate:  .\venv\Scripts\Activate.ps1 (PowerShell)" -ForegroundColor White
Write-Host "- Activate:  venv\Scripts\activate.bat (CMD)" -ForegroundColor White
Write-Host "- Deactivate: deactivate" -ForegroundColor White
Write-Host ""

Write-Host "Need help? Check the README files or create an issue!" -ForegroundColor Gray
Write-Host ""

# Deactivate virtual environment
deactivate

# Return to original directory
Set-Location -Path $PSScriptRoot
