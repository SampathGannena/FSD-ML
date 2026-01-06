// middleware/combinedAuthMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Mentor = require('../models/Mentor');

/**
 * Combined authentication middleware that accepts both user and mentor tokens
 * Checks User collection first, then Mentor collection
 * Attaches the authenticated user/mentor to req.user
 */
const combinedAuthMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Try to find user first
    let user = await User.findById(decoded.id);
    
    if (user) {
      // Check if token was issued before last logout (token invalidation)
      if (user.lastLogout && decoded.iat * 1000 < user.lastLogout.getTime()) {
        return res.status(401).json({ error: 'Token has been invalidated. Please login again.' });
      }
      
      req.user = user;
      req.userType = 'user';
      return next();
    }
    
    // If not a user, try mentor
    let mentor = await Mentor.findById(decoded.id);
    
    if (mentor) {
      // Check if token was issued before last logout (token invalidation)
      if (mentor.lastLogout && decoded.iat * 1000 < mentor.lastLogout.getTime()) {
        return res.status(401).json({ error: 'Token has been invalidated. Please login again.' });
      }
      
      req.user = mentor;
      req.userType = 'mentor';
      return next();
    }
    
    // Neither user nor mentor found
    return res.status(401).json({ error: 'User not found' });
    
  } catch (err) {
    console.error('Combined auth middleware error:', err);
    res.status(403).json({ error: 'Invalid token' });
  }
};

module.exports = combinedAuthMiddleware;
