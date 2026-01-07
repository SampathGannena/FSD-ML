# Forgot Password Setup Guide

## Why It's Not Working

The forgot password feature requires **email configuration** to send reset links. Here's what needs to be set up:

## Step 1: Create .env File

Create a `.env` file in the `Backend` folder with these variables:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
EMAIL_FROM=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
JWT_SECRET=your_secret_key
FRONTEND_URL=http://localhost:5500
```

## Step 2: Get Gmail App Password

1. **Go to Google Account Settings**
   - Visit: https://myaccount.google.com/
   
2. **Enable 2-Step Verification**
   - Security → 2-Step Verification → Turn On

3. **Generate App Password**
   - Security → App passwords
   - Select "Mail" and "Other (Custom name)"
   - Name it "StudyFinder"
   - Copy the 16-character password

4. **Add to .env file**
   ```env
   EMAIL_FROM=youremail@gmail.com
   EMAIL_PASS=abcd efgh ijkl mnop
   ```
   (Remove spaces from the app password)

## Step 3: Update FRONTEND_URL

In your `.env` file, set the correct frontend URL:

```env
# For local development:
FRONTEND_URL=http://localhost:5500

# For production (Render):
FRONTEND_URL=https://fsd-ml-4knj.onrender.com
```

## Step 4: Restart Server

After creating/updating `.env`:

```bash
cd Backend
node server.js
```

## Testing the Feature

1. Go to: http://localhost:5500/Frontend/credentials/forgot.html
2. Enter a registered email address
3. Click "Send Reset Link"
4. Check your email inbox (and spam folder)
5. Click the reset link in the email
6. Enter new password

## Common Issues & Solutions

### ❌ "Error connecting to server"
- **Cause**: Backend server not running
- **Fix**: Start server with `node server.js` in Backend folder

### ❌ "No account found with this email"
- **Cause**: Email not registered in database
- **Fix**: Sign up first with that email

### ❌ Email not received
- **Cause**: Incorrect EMAIL_FROM or EMAIL_PASS
- **Fix**: 
  1. Check .env file has correct Gmail credentials
  2. Verify app password is correct (16 chars)
  3. Check spam/junk folder

### ❌ "Invalid credentials" email error
- **Cause**: Using regular Gmail password instead of app password
- **Fix**: Generate and use App Password (see Step 2)

### ❌ Reset link shows 404
- **Cause**: reset.html not in correct location
- **Fix**: Ensure reset.html exists at `Frontend/public/reset.html`

## Email Template

The system sends a professional email with:
- Branded header with StudyFinder colors
- Reset button (gradient orange/red)
- Plain text link (for email clients blocking buttons)
- 10-minute expiration notice
- Security notice (ignore if you didn't request)

## Security Features

✅ **Token expires in 10 minutes**
✅ **One-time use tokens** (cleared after password reset)
✅ **Secure bcrypt password hashing**
✅ **Email validation** before sending
✅ **Error handling** with user-friendly messages

## Files Modified

1. **Backend/controllers/authController.js** - Enhanced error handling
2. **Frontend/credentials/forgot.html** - Better UX with loading states
3. Both now show proper success/error notifications

## Need Help?

If still not working, check:
1. Server console logs for error messages
2. Browser console for frontend errors
3. Network tab for failed API requests
4. MongoDB connection is working

---
**Last Updated**: January 7, 2026
