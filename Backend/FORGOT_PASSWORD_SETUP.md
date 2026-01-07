# Forgot Password Setup Guide - SendGrid Edition

## Overview

The forgot password feature uses **SendGrid** for reliable email delivery on production platforms like Render.

## Step 1: Create SendGrid Account

1. **Sign up at SendGrid**
   - Visit: https://signup.sendgrid.com/
   - Choose the FREE plan (100 emails/day)
   
2. **Verify your email address**
   - Check your inbox and click the verification link

## Step 2: Set Up Sender Identity

1. **Go to Settings → Sender Authentication**
   - Click "Get Started" under Single Sender Verification
   
2. **Create a Sender**
   - From Name: `StudyFinder`
   - From Email: `noreply@yourdomain.com` (or your email)
   - Reply To: Your email
   - Fill in address fields
   
3. **Verify the sender email**
   - Check inbox and click verification link

## Step 3: Create API Key

1. **Go to Settings → API Keys**
   
2. **Click "Create API Key"**
   - Name: `StudyFinder Password Reset`
   - Permissions: **Full Access** (or Mail Send only)
   
3. **Copy the API Key**
   - It looks like: `SG.xxxxxxxxxxxxxxxxxxxxx`
   - ⚠️ **Save it now - you won't see it again!**

## Step 4: Update Render Environment Variables

1. **Go to your Render dashboard**
   - Select your backend service
   
2. **Go to Environment**
   
3. **Add/Update these variables**:
   ```
   SENDGRID_API_KEY=SG.your_api_key_here
   EMAIL_FROM=noreply@yourdomain.com
   FRONTEND_URL=https://fsd-ml-4knj.onrender.com
   ```
   
4. **Remove old variables** (if present):
   - EMAIL_PASS (no longer needed)

5. **Save Changes**
   - Render will automatically redeploy

## Step 5: Test It

1. Go to: https://fsd-ml-4knj.onrender.com/credentials/forgot.html
2. Enter a registered email
3. Click "Send Reset Link"
4. Check email inbox (and spam folder)
5. Click the reset link
6. Enter new password

## Local Development Setup

Update your local `.env` file in the Backend folder:

```env
PORT=5000
MONGO_URI=your_mongodb_uri
SENDGRID_API_KEY=SG.your_api_key_here
EMAIL_FROM=noreply@yourdomain.com
JWT_SECRET=your_secret_key
FRONTEND_URL=http://localhost:5500
```

## Troubleshooting

### ❌ "Email service not configured"
- **Cause**: Missing SENDGRID_API_KEY in environment
- **Fix**: Add the API key to Render environment variables

### ❌ "Failed to send email"
- **Cause**: Invalid API key or unverified sender
- **Fix**: 
  1. Verify the API key is correct
  2. Verify sender email in SendGrid dashboard

### ❌ Email not received
- **Cause**: Email in spam or sender not verified
- **Fix**:
  1. Check spam/junk folder
  2. Verify sender identity in SendGrid
  3. Check SendGrid Activity Feed for delivery status

### ❌ "Forbidden" error
- **Cause**: Sender email not verified in SendGrid
- **Fix**: Complete Single Sender Verification in SendGrid

## SendGrid Benefits

✅ **No SMTP blocking** - Works on Render, Vercel, Railway, etc.
✅ **100 emails/day free** - Perfect for small projects
✅ **Reliable delivery** - Professional email infrastructure
✅ **Activity tracking** - See email delivery status
✅ **No password needed** - Just API key

## Monitor Email Delivery

1. **Go to SendGrid Dashboard**
2. **Click Activity Feed**
3. **See real-time email status**:
   - Processed ✅
   - Delivered ✅
   - Bounced ❌
   - Spam Report ⚠️

## Files Changed

1. **Backend/utils/sendEmail.js** - Now uses SendGrid API
2. **Backend/package.json** - Added @sendgrid/mail dependency
3. **Backend/.env.example** - Updated with SendGrid variables

## Security Notes

⚠️ **Never commit .env file**
⚠️ **Keep API key secret**
⚠️ **Use environment variables only**
⚠️ **Regenerate API key if exposed**

---
**Email Service**: SendGrid  
**Package**: @sendgrid/mail v8.1.4  
**Last Updated**: January 7, 2026
