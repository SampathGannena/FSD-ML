// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>

  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) return res.status(401).json({ error: 'User not found' });
    
    // Check if token was issued before last logout (token invalidation)
    if (user.lastLogout && decoded.iat * 1000 < user.lastLogout.getTime()) {
      return res.status(401).json({ error: 'Token has been invalidated. Please login again.' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;
