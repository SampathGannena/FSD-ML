const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');


exports.signup =   async (req, res) => {
    try {
      const { fullname, email, password, bio } = req.body;
      // const avatar = req.file ? req.file.filename : null; // or req.file.path for full path

  
      const existing = await User.findOne({ email });
      if (existing) return res.status(400).json({ message: 'Email already registered.' });
  
      const hashed = await bcrypt.hash(password, 10);
      const newUser = new User({ fullname, email, password: hashed, bio });
      await newUser.save();
  
      res.status(201).json({ message: 'User registered successfully!' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
};
  
exports.signin = async (req, res) => {
    try {
      const { email, password } = req.body;
  
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: 'User not found.' });
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

      const today = new Date();
      const last = user.lastActive ? new Date(user.lastActive) : null;
      let updateStreak = false;

      if (!last || today.toDateString() !== last.toDateString()) {
        const diff = last ? (today - last) / (1000 * 60 * 60 * 24) : null;
        if (diff === 1) {
          user.streak = (user.streak || 0) + 1; // continued streak
        } else {
          user.streak = 1; // reset streak
        }
        user.lastActive = today;
        updateStreak = true;
      }

      if (updateStreak) await user.save();
  
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  
      res.status(200).json({ token, user: { id: user._id, fullname: user.fullname, email: user.email } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    console.log(`[Forgot Password] Request received for email: ${email}`);

    const user = await User.findOne({ email });
    if (!user) {
      console.log(`[Forgot Password] No user found with email: ${email}`);
      return res.status(404).json({ message: 'No account found with this email address' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 1000 * 60 * 10; // 10 minutes
    await user.save();
    console.log(`[Forgot Password] Token generated and saved for: ${email}`);

    // Use environment variable for base URL or fallback to localhost
    const baseUrl = process.env.FRONTEND_URL || `http://localhost:5500`;
    const resetLink = `${baseUrl}/reset.html?token=${token}&email=${encodeURIComponent(email)}`;
    console.log(`[Forgot Password] Reset link: ${resetLink}`);

    // Check if SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      console.error('[Forgot Password] SENDGRID_API_KEY not configured!');
      return res.status(500).json({ 
        message: 'Email service not configured. Please contact administrator.' 
      });
    }

    if (!process.env.EMAIL_FROM) {
      console.error('[Forgot Password] EMAIL_FROM not configured!');
      return res.status(500).json({ 
        message: 'Email sender not configured. Please contact administrator.' 
      });
    }

    console.log(`[Forgot Password] Sending email from: ${process.env.EMAIL_FROM}`);

    try {
      await sendEmail(
        email,
        'Reset Your Password - StudyFinder',
        `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff6b00;">Password Reset Request</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password. Click the button below to reset it:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: linear-gradient(135deg, #ff6b00, #ff4b2b); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetLink}</p>
          <p><strong>This link will expire in 10 minutes.</strong></p>
          <p>If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">StudyFinder - AI-Powered Learning Platform</p>
        </div>`
      );
      console.log(`[Forgot Password] ✓ Email sent successfully to: ${email}`);
    } catch (emailError) {
      console.error('[Forgot Password] Email sending failed:', emailError);
      
      // Provide more specific error message
      let errorMessage = 'Failed to send reset email. ';
      if (emailError.message.includes('not configured')) {
        errorMessage += 'Email service not configured.';
      } else if (emailError.message.includes('Forbidden') || emailError.response?.body?.errors?.[0]?.message?.includes('not verified')) {
        errorMessage += 'Email sender not verified in SendGrid. Please verify your sender email.';
      } else {
        errorMessage += 'Please try again later or contact support.';
      }
      
      return res.status(500).json({ message: errorMessage });
    }

    res.json({ message: 'Reset link sent to your email. Please check your inbox and spam folder.' });
  } catch (error) {
    console.error('[Forgot Password] Unexpected error:', error);
    res.status(500).json({ message: 'An unexpected error occurred. Please try again later.' });
  }
};

exports.resetPassword = async (req, res) => {
    try {
      const { email, token, password } = req.body;
  
      const user = await User.findOne({
        email,
        resetToken: token,
        resetTokenExpiry: { $gt: Date.now() }, // token is still valid
      });
  
      if (!user) return res.status(400).json({ message: 'Invalid or expired token.' });
  
      // Hash and update new password
      user.password = await bcrypt.hash(password, 10);
      user.resetToken = undefined;
      user.resetTokenExpiry = undefined;
  
      await user.save();
      res.status(200).json({ message: 'Password reset successfully!' });
  
    } catch (err) {
      res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
  };

// Logout endpoint - invalidates the current session
exports.logout = async (req, res) => {
    try {
      // In a simple JWT implementation, we can't easily blacklist tokens
      // But we can update the user's lastLogout time and compare it with token issuance
      const user = req.user; // from authMiddleware
      
      // Update lastLogout timestamp
      user.lastLogout = new Date();
      await user.save();
      
      res.status(200).json({ message: 'Logged out successfully!' });
    } catch (err) {
      res.status(500).json({ error: 'Logout failed' });
    }
};
  
  
