const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Add any additional fields you want to send
    res.json({
      username: user.fullname,
      email: user.email,
      avatar: user.avatar || 'https://i.pravatar.cc/120',
      streak: user.streak || 0,
      courses: user.courses || 0,
      badges: user.badges || [],
      groups: user.groups || [],
      bio: user.bio || ''
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;