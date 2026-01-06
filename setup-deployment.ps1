# Deployment Helper Script for Windows
# This script helps prepare your application for deployment

Write-Host "🚀 FSD-ML Deployment Helper" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the Backend directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Not in the Backend directory" -ForegroundColor Red
    Write-Host "Please run this script from the Backend folder" -ForegroundColor Yellow
    exit 1
}

Write-Host "1️⃣  Installing security dependencies..." -ForegroundColor Green
npm install helmet express-rate-limit express-mongo-sanitize xss-clean compression --save

Write-Host ""
Write-Host "2️⃣  Installing development dependencies..." -ForegroundColor Green
npm install nodemon --save-dev

Write-Host ""
Write-Host "3️⃣  Running security audit..." -ForegroundColor Green
npm audit

Write-Host ""
Write-Host "4️⃣  Checking for outdated packages..." -ForegroundColor Green
npm outdated

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Update Backend/.env with production values"
Write-Host "2. Test locally: npm start"
Write-Host "3. Commit changes: git add . && git commit -m 'Add security and deployment config'"
Write-Host "4. Push to GitHub: git push origin main"
Write-Host "5. Deploy to your chosen platform (see DEPLOYMENT.md)"
Write-Host ""
Write-Host "📖 For detailed instructions, see:" -ForegroundColor Cyan
Write-Host "   - DEPLOYMENT.md - Deployment guide"
Write-Host "   - SECURITY.md - Security best practices"
