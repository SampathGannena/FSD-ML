# Deployment Guide for FSD-ML Application

## 🚀 Overview
This guide covers deploying your full-stack application with security best practices and automatic updates.

## 📋 Prerequisites
- GitHub account
- MongoDB Atlas account (already configured)
- Domain name (optional but recommended)

## 🔐 Security Features Implemented

### 1. Environment Variables
- `.env` files are now gitignored
- `.env.example` templates provided for reference
- **Action Required**: Update `.env.example` with your actual values in production

### 2. Security Packages Added
- **Helmet**: Sets secure HTTP headers
- **Express Rate Limit**: Prevents brute force attacks
- **Express Mongo Sanitize**: Prevents NoSQL injection
- **XSS Clean**: Prevents cross-site scripting attacks
- **Compression**: Compresses responses for better performance

### 3. CORS Configuration
- Configured for production and development environments
- Only allows requests from trusted domains

## 🌐 Deployment Options

### Option 1: Vercel (Recommended for Full-Stack)
**Pros**: Free tier, automatic deployments, easy setup

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Add Environment Variables** in Vercel Dashboard:
   - Go to Project Settings → Environment Variables
   - Add all variables from `.env.example`

4. **Auto-Deploy**: Every push to `main` branch auto-deploys

### Option 2: Render (Backend) + Netlify/Vercel (Frontend)
**Pros**: Better for larger applications, separate scaling

#### Backend on Render:
1. Create account at [render.com](https://render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Root Directory**: `Backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Add all `.env` variables

#### Frontend on Netlify:
1. Create account at [netlify.com](https://netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub repository
4. Configure:
   - **Base Directory**: `Frontend`
   - **Publish Directory**: `Frontend`
   - **Build Command**: Leave empty (static site)

### Option 3: Railway
**Pros**: Simple, supports both frontend and backend

1. Create account at [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Add environment variables
5. Deploy!

## 🔄 Auto-Update Setup (CI/CD)

### GitHub Actions (Already Configured)
File created: `.github/workflows/deploy.yml`

**Features**:
- Automatically deploys on every push to `main`
- Runs on pull requests for testing
- Can be extended with tests and linting

**To activate**:
1. Push your code to GitHub
2. The workflow will trigger automatically
3. Check "Actions" tab in GitHub to see deployment status

## 📝 Step-by-Step Deployment Process

### 1. Prepare Your Code
```bash
# Install security dependencies
cd Backend
npm install

# Test locally
npm start
```

### 2. Update Environment Variables
```bash
# Update Backend/.env with production values
# Never commit .env file!
```

### 3. Push to GitHub
```bash
# Add all changes
git add .

# Commit with message
git commit -m "Add deployment configuration and security enhancements"

# Push to GitHub
git push origin main
```

### 4. Deploy (Choose one platform)

#### For Vercel:
```bash
vercel --prod
```

#### For Render:
- Go to dashboard and click "Deploy latest commit"

#### For Railway:
- Automatic deployment on push

## 🔒 Production Security Checklist

- [x] `.env` files gitignored
- [x] Security middleware configured (Helmet, Rate Limiting)
- [x] CORS configured for production
- [x] MongoDB connection secured
- [x] JWT secrets not exposed
- [ ] Update FRONTEND_URL in production `.env`
- [ ] Set NODE_ENV=production
- [ ] Use strong passwords for database
- [ ] Enable MongoDB IP whitelist (or allow all for cloud deployment)
- [ ] Set up custom domain with HTTPS
- [ ] Monitor application logs

## 🌍 Environment Variables Needed in Production

```env
PORT=5000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
EMAIL_FROM=your_email@gmail.com
EMAIL_PASS=your_app_specific_password
JWT_SECRET=super_long_random_string_change_this
NODE_ENV=production
FRONTEND_URL=https://your-actual-domain.com
```

## 🎯 Frontend Configuration

Update API URLs in your frontend files:

**Before Deployment**: Update base URL in all API calls
```javascript
// Instead of: http://localhost:5000/api/...
// Use: https://your-backend-url.com/api/...

// Or better, use environment-based URLs:
const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api'
  : 'https://your-backend-url.com/api';
```

## 📊 Monitoring

### After Deployment:
1. **Check Logs**: Monitor application logs in your hosting dashboard
2. **Test All Features**: Login, signup, file uploads, real-time features
3. **Monitor Performance**: Check response times and errors
4. **Set Up Alerts**: Configure email alerts for errors

## 🔄 How Auto-Update Works

1. **You make changes** to your code locally
2. **Commit and push** to GitHub
3. **GitHub Actions** detects the push
4. **Automatic deployment** to your hosting platform
5. **Your live site updates** within 1-5 minutes

## 🆘 Troubleshooting

### Deployment Fails
- Check build logs for errors
- Verify all environment variables are set
- Ensure `package.json` has correct start script

### CORS Errors
- Update `FRONTEND_URL` in backend `.env`
- Check `corsOptions` in `server.js`

### Database Connection Issues
- Verify `MONGO_URI` is correct
- Check MongoDB Atlas IP whitelist (allow `0.0.0.0/0` for cloud)

## 📞 Support
If you encounter issues:
1. Check deployment logs
2. Review this guide
3. Check platform-specific documentation

## 🎉 Next Steps
1. Install security dependencies: `cd Backend && npm install`
2. Update `.env` with production values
3. Choose a deployment platform
4. Push to GitHub
5. Configure auto-deploy
6. Test your live application!
