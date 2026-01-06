# 🚀 Quick Start - Deploy Your Application

This guide will help you deploy your FSD-ML application in **under 30 minutes**.

## Option 1: Deploy on Vercel (Easiest - Recommended)

### Step 1: Install Dependencies
```bash
cd Backend
npm install
```

### Step 2: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 3: Deploy
```bash
# From the root directory (FSD-ML)
vercel
```

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N**
- Project name? **fsd-ml** (or your choice)
- Directory? **./** (root)
- Override settings? **N**

### Step 4: Add Environment Variables
After deployment, run:
```bash
vercel env add
```

Or add them in the Vercel Dashboard:
1. Go to your project on vercel.com
2. Settings → Environment Variables
3. Add each variable from `Backend/.env`:
   - MONGO_URI
   - JWT_SECRET
   - EMAIL_FROM
   - EMAIL_PASS
   - NODE_ENV=production
   - FRONTEND_URL (your Vercel domain)

### Step 5: Redeploy
```bash
vercel --prod
```

✅ **Done!** Your app is live at `https://your-project.vercel.app`

---

## Option 2: Deploy Backend on Render + Frontend on Netlify

### Backend on Render

1. **Sign up** at [render.com](https://render.com)

2. **Create New Web Service**
   - Connect GitHub repository
   - Root Directory: `Backend`
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Add Environment Variables** (in Render Dashboard)
   ```
   MONGO_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   EMAIL_FROM=your_email
   EMAIL_PASS=your_email_password
   NODE_ENV=production
   FRONTEND_URL=https://your-netlify-site.netlify.app
   ```

4. **Deploy** - Render will automatically build and deploy

5. **Copy your backend URL** (e.g., `https://your-app.onrender.com`)

### Frontend on Netlify

1. **Sign up** at [netlify.com](https://netlify.com)

2. **New Site from Git**
   - Connect GitHub repository
   - Base directory: `Frontend`
   - Build command: (leave empty)
   - Publish directory: `Frontend`

3. **Update Frontend API URLs**
   - Edit `Frontend/js/config.js`
   - Update `API_BASE_URL` with your Render backend URL

4. **Commit and push** changes:
   ```bash
   git add .
   git commit -m "Update API URL for production"
   git push origin main
   ```

5. **Netlify auto-deploys!**

✅ **Done!** Frontend at Netlify URL, Backend at Render URL

---

## Option 3: Deploy on Railway (Simplest All-in-One)

1. **Sign up** at [railway.app](https://railway.app)

2. **New Project** → "Deploy from GitHub repo"

3. **Select your repository**

4. **Add Environment Variables**
   - Click on your service
   - Variables tab
   - Add all variables from `Backend/.env`

5. **Deploy!** Railway handles everything automatically

✅ **Done!** Your app is live!

---

## 🔄 Enable Auto-Deploy (All Platforms)

Once connected to GitHub, all platforms auto-deploy when you push to `main`:

```bash
# Make changes to your code
git add .
git commit -m "Your changes"
git push origin main

# 🎉 Automatic deployment happens!
```

---

## ✅ Pre-Deployment Checklist

Before deploying, make sure:

- [ ] Security dependencies installed: `cd Backend && npm install`
- [ ] `.env.example` reviewed and understood
- [ ] MongoDB Atlas configured and accessible
- [ ] Test app locally: `cd Backend && npm start`
- [ ] All changes committed to GitHub

---

## 🧪 Test Your Deployment

After deploying:

1. **Visit your live URL**
2. **Test signup/login**
3. **Test main features**
4. **Check browser console** for errors
5. **Monitor platform logs** for backend errors

---

## 🆘 Troubleshooting

### "Cannot connect to MongoDB"
- Check MongoDB Atlas Network Access
- Add `0.0.0.0/0` to IP whitelist for cloud deployment

### "CORS Error"
- Update `FRONTEND_URL` in backend environment variables
- Match your actual frontend domain

### "500 Internal Server Error"
- Check platform logs
- Verify all environment variables are set
- Check MongoDB connection string

---

## 📱 What You Get

After deployment:
- ✅ Live frontend (HTML/CSS/JS)
- ✅ Live backend API (Express.js)
- ✅ MongoDB database (Atlas)
- ✅ HTTPS automatically
- ✅ Auto-deploy on Git push
- ✅ Free tier (most platforms)

---

## 🎯 Recommended: Vercel

**Why?**
- Easiest setup
- One command deployment
- Automatic HTTPS
- Built-in CI/CD
- Free tier is generous
- Great performance

**Cost:** $0/month (hobby plan)

---

## ⏱️ Estimated Time
- Vercel: 15-20 minutes
- Render + Netlify: 20-30 minutes
- Railway: 15-20 minutes

---

## 📞 Need Help?

Check these files:
- `DEPLOYMENT.md` - Detailed deployment guide
- `SECURITY.md` - Security best practices
- `README.md` - Project overview

---

## 🎉 You're Ready!

Choose a platform and follow the steps above. Your app will be live in minutes!

**Pro Tip:** Start with Vercel for the easiest experience, then migrate to Render/Railway if you need more control later.
