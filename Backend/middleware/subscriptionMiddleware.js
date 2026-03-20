const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Mentor = require('../models/Mentor');
const { hasFeature, getSubscriptionForResponse } = require('../config/subscriptionFeatures');

function getToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

async function resolveActorFromRequest(req) {
  if (req.user && req.user._id) {
    return {
      actor: req.user,
      actorType: req.userType === 'mentor' ? 'mentor' : 'user'
    };
  }

  if (req.mentor && req.mentor._id) {
    return {
      actor: req.mentor,
      actorType: 'mentor'
    };
  }

  const token = getToken(req);
  if (!token) {
    return null;
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const actorId = decoded.id || decoded.userId || decoded.mentorId;

  if (!actorId) {
    return null;
  }

  const isMentorToken = decoded.role === 'mentor' || decoded.userType === 'mentor' || !!decoded.mentorId;

  if (isMentorToken) {
    const mentor = await Mentor.findById(actorId);
    if (!mentor) {
      return null;
    }

    req.user = mentor;
    req.mentor = mentor;
    req.userType = 'mentor';

    return {
      actor: mentor,
      actorType: 'mentor'
    };
  }

  const user = await User.findById(actorId);
  if (!user) {
    return null;
  }

  req.user = user;
  req.userType = 'user';

  return {
    actor: user,
    actorType: 'user'
  };
}

function requireFeature(featureKey) {
  return async (req, res, next) => {
    try {
      const resolved = await resolveActorFromRequest(req);
      if (!resolved || !resolved.actor) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const { actor } = resolved;
      const subscription = actor.subscription || {};
      const allowed = hasFeature(subscription, featureKey);

      req.subscription = getSubscriptionForResponse(subscription);
      req.featureAccess = {
        featureKey,
        allowed
      };

      if (!allowed) {
        return res.status(403).json({
          success: false,
          error: 'Feature locked for your current subscription plan',
          feature: featureKey,
          subscription: req.subscription,
          upgradeRequired: true
        });
      }

      return next();
    } catch (error) {
      console.error(`Feature access check failed for ${featureKey}:`, error);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  };
}

module.exports = {
  requireFeature,
  resolveActorFromRequest
};
