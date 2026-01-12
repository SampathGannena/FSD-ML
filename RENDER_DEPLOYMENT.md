# Deploying Recommendation System to Render

## 🚀 Quick Setup for Render

Your application is already on Render. Follow these steps to add the recommendation system:

### Step 1: Update Your Render Service

#### A. Add Python Runtime

In your Render Dashboard:

1. Go to your service → **Environment** tab
2. Add these environment variables:

```bash
PYTHON_VERSION=3.11.0
```

#### B. Update Build Command

In **Settings** → **Build Command**, update to:

```bash
cd Backend && npm install && cd ml && pip install -r requirements.txt && cd ..
```

Or if you want a virtual environment (recommended):

```bash
cd Backend && npm install && cd ml && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt && cd ..
```

#### C. Start Command (should remain):

```bash
cd Backend && node server.js
```

### Step 2: Add Python Buildpack

In Render Dashboard:

1. Go to your service → **Settings**
2. Scroll to **Build & Deploy**
3. Click **Add Build Command**
4. Or add this to `render.yaml` if you're using it:

```yaml
services:
  - type: web
    name: fsd-ml-backend
    env: node
    buildCommand: cd Backend && npm install && cd ml && pip install -r requirements.txt && cd ..
    startCommand: cd Backend && node server.js
    envVars:
      - key: PYTHON_VERSION
        value: "3.11.0"
      - key: MONGODB_URI
        sync: false
      - key: JWT_SECRET
        sync: false
```

### Step 3: Commit and Push Changes

```bash
# From your project root
git add .
git commit -m "Add recommendation system integration"
git push origin main
```

Render will automatically deploy the changes.

### Step 4: Verify Deployment

Once deployed, test these endpoints:

```bash
# Replace YOUR_RENDER_URL with your actual URL
curl https://YOUR_RENDER_URL.onrender.com/health

# Check recommendation system status
curl https://YOUR_RENDER_URL.onrender.com/api/recommendations/status

# Initialize the system (do this once after deployment)
curl -X POST https://YOUR_RENDER_URL.onrender.com/api/recommendations/initialize
```

### Step 5: Initialize the System

After deployment, you need to initialize the recommendation models:

**Option 1: Via API (easiest)**

```bash
curl -X POST https://YOUR_RENDER_URL.onrender.com/api/recommendations/initialize \
  -H "Content-Type: application/json"
```

**Option 2: Via Render Shell**

1. Go to Render Dashboard → Your service → **Shell**
2. Run:

```bash
cd Backend/ml
python api/recommendation_api.py --action initialize --params '{}'
```

## 📋 Complete render.yaml Configuration

Create or update `render.yaml` in your project root:

```yaml
services:
  - type: web
    name: fsd-ml-backend
    env: node
    region: oregon
    plan: starter
    buildCommand: |
      cd Backend
      npm install
      cd ml
      pip install --upgrade pip
      pip install -r requirements.txt
      cd ../..
    startCommand: cd Backend && node server.js
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PYTHON_VERSION
        value: "3.11.0"
      - key: MONGODB_URI
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: PORT
        value: 3000
    autoDeploy: true
```

## 🔧 Environment Variables

Make sure these are set in Render Dashboard → Environment:

| Variable | Value | Notes |
|----------|-------|-------|
| `MONGODB_URI` | Your MongoDB Atlas URI | Required |
| `JWT_SECRET` | Your secret key | Required |
| `PYTHON_VERSION` | `3.11.0` | For Python support |
| `NODE_ENV` | `production` | For production mode |
| `PORT` | `3000` | Or Render's default |

## 🧪 Testing After Deployment

### 1. Test Health Check
```bash
curl https://YOUR_APP.onrender.com/health
```

Expected: `{"status":"OK","timestamp":"..."}`

### 2. Test Recommendation Status
```bash
curl https://YOUR_APP.onrender.com/api/recommendations/status
```

Expected:
```json
{
  "status": "success",
  "initialized": false,
  "models": {
    "content": true,
    "collaborative": false,
    "gnn": false
  },
  "database_connected": true
}
```

### 3. Initialize Models (First Time)
```bash
curl -X POST https://YOUR_APP.onrender.com/api/recommendations/initialize
```

### 4. Get Recommendations (Replace USER_ID)
```bash
curl "https://YOUR_APP.onrender.com/api/recommendations/mentors?userId=USER_ID&limit=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📱 Frontend Integration

Update your frontend API calls to use the Render URL:

```javascript
// In your frontend config
const API_BASE_URL = 'https://YOUR_APP.onrender.com';

// Get mentor recommendations
async function getMentorRecommendations(userId, limit = 10) {
  const response = await fetch(
    `${API_BASE_URL}/api/recommendations/mentors?userId=${userId}&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }
  );
  return response.json();
}

// Initialize recommendations (admin action)
async function initializeRecommendations() {
  const response = await fetch(
    `${API_BASE_URL}/api/recommendations/initialize`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }
  );
  return response.json();
}
```

## ⚠️ Important Notes for Render

### 1. Free Tier Limitations
- Render free tier spins down after 15 min of inactivity
- First request after spin-down takes 30-60 seconds
- Consider upgrading to Starter ($7/month) for always-on

### 2. Memory Limits
- Free tier: 512MB RAM
- Starter: 512MB RAM
- If you get memory errors, upgrade to Standard ($25/month) with 2GB RAM

### 3. Build Time
- Initial build may take 5-10 minutes (installing Python packages)
- Subsequent builds are faster (~2-3 minutes)

### 4. Python Package Size
- PyTorch is large (~200MB)
- Build might timeout on free tier
- If timeout occurs, remove `torch` and `torch-geometric` from requirements.txt
- GNN will be disabled but content-based and collaborative filtering will work

## 🐛 Troubleshooting

### Build Fails with "pip: command not found"

**Solution:** Add Python buildpack detection file:

Create `runtime.txt` in your Backend folder:
```
python-3.11.0
```

### "ModuleNotFoundError" in logs

**Solution:** Verify build command installed packages:
```bash
cd Backend && npm install && cd ml && pip install -r requirements.txt && cd ..
```

### Recommendations return empty

**Solution:** 
1. Ensure MongoDB has data
2. Run initialization: `POST /api/recommendations/initialize`
3. Check logs in Render Dashboard

### "Python script timeout"

**Solution:** 
- First request after spin-down takes time
- Upgrade from free tier
- Reduce model complexity in config

## ✅ Deployment Checklist

Before deploying:

- [ ] `server.js` has recommendation routes integrated
- [ ] `requirements.txt` exists in `Backend/ml/`
- [ ] MongoDB URI is set in Render environment variables
- [ ] Build command includes `pip install -r requirements.txt`
- [ ] Python version is set to 3.11.0
- [ ] Code is committed and pushed to GitHub
- [ ] Render is connected to your GitHub repo

After deploying:

- [ ] Health check endpoint works
- [ ] Recommendation status endpoint works
- [ ] Initialize models via POST request
- [ ] Test recommendations with real user ID
- [ ] Frontend can call recommendation APIs
- [ ] Monitor logs for errors

## 🎯 Next Steps

1. **Commit the changes** (server.js update)
2. **Push to GitHub** - Render will auto-deploy
3. **Wait for build** (~5-10 minutes first time)
4. **Initialize models** via API call
5. **Test recommendations** with real user IDs
6. **Integrate frontend** to call recommendation endpoints

## 📞 Support

If you encounter issues:

1. Check Render logs: Dashboard → Your Service → Logs
2. Verify environment variables are set
3. Test endpoints manually with curl
4. Check MongoDB connection
5. Ensure Python packages installed successfully

---

**Your recommendation system is now ready for Render! 🚀**

Once deployed, it will:
- ✅ Automatically detect Python environment
- ✅ Connect to your MongoDB Atlas
- ✅ Serve recommendations via REST API
- ✅ Scale with your user base
- ✅ Update models as users interact
