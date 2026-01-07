/**
 * Group Recommendations Routes
 * Provides endpoints for intelligent group recommendations
 */

const express = require('express');
const router = express.Router();
const GroupRecommendationService = require('../services/groupRecommendationService');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * GET /api/groups/recommendations
 * Get personalized group recommendations for the authenticated user
 * Query params: limit (default: 10)
 */
router.get('/recommendations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 10;

    const recommendations = await GroupRecommendationService.getRecommendations(userId, limit);

    res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recommendations',
      message: error.message
    });
  }
});

/**
 * GET /api/groups/trending
 * Get trending groups (most active in last 7 days)
 * Query params: limit (default: 5)
 */
router.get('/trending', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const trending = await GroupRecommendationService.getTrendingGroups(limit);

    res.json({
      success: true,
      count: trending.length,
      trending
    });
  } catch (error) {
    console.error('Error getting trending groups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trending groups',
      message: error.message
    });
  }
});

/**
 * GET /api/groups/similar/:groupName
 * Get groups similar to a specific group
 * Query params: limit (default: 5)
 */
router.get('/similar/:groupName', authMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    const limit = parseInt(req.query.limit) || 5;

    const similar = await GroupRecommendationService.getSimilarGroups(groupName, limit);

    res.json({
      success: true,
      count: similar.length,
      similar
    });
  } catch (error) {
    console.error('Error getting similar groups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get similar groups',
      message: error.message
    });
  }
});

/**
 * POST /api/groups/recommendations/feedback
 * Record user feedback on recommendations (for future improvements)
 */
router.post('/recommendations/feedback', authMiddleware, async (req, res) => {
  try {
    const { groupId, action, helpful } = req.body;
    const userId = req.user._id;

    // Log feedback for analytics (you can store this in a separate collection)
    console.log('Recommendation feedback:', {
      userId,
      groupId,
      action, // 'joined', 'dismissed', 'viewed'
      helpful, // true/false
      timestamp: new Date()
    });

    // TODO: Store feedback in database for ML model training

    res.json({
      success: true,
      message: 'Feedback recorded'
    });
  } catch (error) {
    console.error('Error recording feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record feedback'
    });
  }
});

module.exports = router;
