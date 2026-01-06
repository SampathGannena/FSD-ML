#!/bin/bash

# Deployment Helper Script
# This script helps prepare your application for deployment

echo "🚀 FSD-ML Deployment Helper"
echo "==========================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in the Backend directory"
    echo "Please run this script from the Backend folder"
    exit 1
fi

echo "1️⃣  Installing security dependencies..."
npm install helmet express-rate-limit express-mongo-sanitize xss-clean compression --save

echo ""
echo "2️⃣  Installing development dependencies..."
npm install nodemon --save-dev

echo ""
echo "3️⃣  Running security audit..."
npm audit

echo ""
echo "4️⃣  Checking for outdated packages..."
npm outdated

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Update Backend/.env with production values"
echo "2. Test locally: npm start"
echo "3. Commit changes: git add . && git commit -m 'Add security and deployment config'"
echo "4. Push to GitHub: git push origin main"
echo "5. Deploy to your chosen platform (see DEPLOYMENT.md)"
echo ""
echo "📖 For detailed instructions, see:"
echo "   - DEPLOYMENT.md - Deployment guide"
echo "   - SECURITY.md - Security best practices"
