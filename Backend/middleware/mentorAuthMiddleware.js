// middleware/mentorAuthMiddleware.js
const jwt = require('jsonwebtoken');
const Mentor = require('../models/Mentor');

const mentorAuthMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if this is a mentor token (check for role or mentorId)
    if (decoded.role !== 'mentor' && !decoded.mentorId) {
      return res.status(403).json({ error: 'Access denied. Mentor authentication required.' });
    }
    
    // Get mentor ID from token (support multiple field names)
    const mentorId = decoded.id || decoded.mentorId || decoded.userId;
    
    if (!mentorId) {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    const mentor = await Mentor.findById(mentorId);
    
    if (!mentor) {
      return res.status(401).json({ error: 'Mentor not found' });
    }
    
    // Check if token was issued before last logout (if applicable)
    if (mentor.lastLogout && decoded.iat * 1000 < mentor.lastLogout.getTime()) {
      return res.status(401).json({ error: 'Token has been invalidated. Please login again.' });
    }
    
    req.mentor = mentor;
    req.user = mentor; // For compatibility
    req.mentorId = mentor._id;
    next();
  } catch (err) {
    console.error('Mentor auth error:', err);
    res.status(403).json({ error: 'Invalid token' });
  }
};

module.exports = mentorAuthMiddleware;
