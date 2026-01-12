/**
 * Recommendation Routes
 * Provides endpoints for mentor, session, and group recommendations
 */

const express = require('express');
const router = express.Router();
const recommendationService = require('../services/recommendationService');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * GET /api/recommendations/status
 * Get recommendation system status (public endpoint)
 */
router.get('/status', async (req, res) => {
    try {
        const status = await recommendationService.getStatus();
        
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting recommendation status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get recommendation system status',
            error: error.message
        });
    }
});

/**
 * POST /api/recommendations/initialize
 * Initialize the recommendation system (public endpoint)
 */
router.post('/initialize', async (req, res) => {
    try {
        const result = await recommendationService.initialize();
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error initializing recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initialize recommendation system',
            error: error.message
        });
    }
});

// Apply authentication to all remaining recommendation routes
router.use(authMiddleware);

/**
 * GET /api/recommendations/mentors
 * Get mentor recommendations for the authenticated user
 */
router.get('/mentors', async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const limit = parseInt(req.query.limit) || 10;
        const method = req.query.method || 'context_aware'; // weighted, cascading, context_aware
        
        const recommendations = await recommendationService.recommendMentors(userId, {
            limit,
            method,
            forceRefresh: req.query.refresh === 'true'
        });
        
        res.json({
            success: true,
            data: recommendations,
            count: recommendations.length
        });
    } catch (error) {
        console.error('Error getting mentor recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate mentor recommendations',
            error: error.message
        });
    }
});

/**
 * GET /api/recommendations/sessions
 * Get study session recommendations for the authenticated user
 */
router.get('/sessions', async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const limit = parseInt(req.query.limit) || 10;
        const method = req.query.method || 'context_aware';
        
        const recommendations = await recommendationService.recommendSessions(userId, {
            limit,
            method,
            forceRefresh: req.query.refresh === 'true'
        });
        
        res.json({
            success: true,
            data: recommendations,
            count: recommendations.length
        });
    } catch (error) {
        console.error('Error getting session recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate session recommendations',
            error: error.message
        });
    }
});

/**
 * GET /api/recommendations/groups
 * Get group recommendations for the authenticated user
 */
router.get('/groups', async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const limit = parseInt(req.query.limit) || 10;
        const method = req.query.method || 'context_aware';
        
        const recommendations = await recommendationService.recommendGroups(userId, {
            limit,
            method,
            forceRefresh: req.query.refresh === 'true'
        });
        
        res.json({
            success: true,
            data: recommendations,
            count: recommendations.length
        });
    } catch (error) {
        console.error('Error getting group recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate group recommendations',
            error: error.message
        });
    }
});

/**
 * POST /api/recommendations/train
 * Train/update recommendation models (admin only)
 */
router.post('/train', async (req, res) => {
    try {
        // Add admin check here if needed
        // if (!req.user.isAdmin) return res.status(403).json({ message: 'Unauthorized' });
        
        const modelType = req.body.modelType || 'all'; // all, collaborative, gnn
        
        // Start training in background
        recommendationService.trainModels(modelType).then(result => {
            console.log('Model training completed:', result);
        }).catch(error => {
            console.error('Model training failed:', error);
        });
        
        res.json({
            success: true,
            message: 'Model training started in background',
            modelType
        });
    } catch (error) {
        console.error('Error starting model training:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start model training',
            error: error.message
        });
    }
});

/**
 * DELETE /api/recommendations/cache
 * Clear recommendation cache
 */
router.delete('/cache', async (req, res) => {
    try {
        recommendationService.clearCache();
        
        res.json({
            success: true,
            message: 'Recommendation cache cleared'
        });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear cache',
            error: error.message
        });
    }
});

module.exports = router;
