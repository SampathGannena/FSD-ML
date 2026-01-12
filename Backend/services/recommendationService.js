/**
 * Recommendation API Service
 * Exposes recommendation endpoints for Express.js backend
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger') || console;

class RecommendationService {
    constructor() {
        this.pythonScriptPath = path.join(__dirname, '../ml/api/recommendation_api.py');
        this.isInitialized = false;
        this.cachedRecommendations = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        
        // Determine Python executable (prefer virtual environment)
        this.pythonCommand = this.getPythonCommand();
    }

    /**
     * Get Python command - prefer virtual environment if available
     */
    getPythonCommand() {
        // Try virtual environment first (Windows)
        const venvPaths = [
            path.join(__dirname, '../ml/venv/Scripts/python.exe'),
            path.join(__dirname, '../ml/venv/bin/python'), // Linux/Mac
            path.join(__dirname, '../ml/.venv/Scripts/python.exe'),
            path.join(__dirname, '../ml/.venv/bin/python')
        ];

        for (const venvPath of venvPaths) {
            if (fs.existsSync(venvPath)) {
                logger.info(`Using virtual environment Python: ${venvPath}`);
                return venvPath;
            }
        }

        // Fallback to system Python
        logger.warn('Virtual environment not found, using system Python');
        logger.warn('Consider running: .\\setup-recommendations.ps1');
        return 'python';
    }

    /**
     * Initialize the recommendation system
     * Trains models if needed
     */
    async initialize() {
        try {
            logger.info('Initializing recommendation system...');
            
            // Call Python initialization script
            const result = await this.callPythonScript('initialize', {});
            
            this.isInitialized = true;
            logger.info('Recommendation system initialized successfully');
            return result;
        } catch (error) {
            logger.error('Failed to initialize recommendation system:', error);
            throw error;
        }
    }

    /**
     * Get mentor recommendations for a user
     */
    async recommendMentors(userId, options = {}) {
        const cacheKey = `mentors:${userId}`;
        
        // Check cache
        const cached = this.getCached(cacheKey);
        if (cached && !options.forceRefresh) {
            logger.debug(`Returning cached mentor recommendations for ${userId}`);
            return cached;
        }

        try {
            const params = {
                user_id: userId,
                top_k: options.limit || 10,
                ensemble_method: options.method || 'weighted'
            };

            const recommendations = await this.callPythonScript('recommend_mentors', params);
            
            // Cache results
            this.setCached(cacheKey, recommendations);
            
            logger.info(`Generated ${recommendations.length} mentor recommendations for user ${userId}`);
            return recommendations;
        } catch (error) {
            logger.error('Error generating mentor recommendations:', error);
            throw error;
        }
    }

    /**
     * Get study session recommendations for a user
     */
    async recommendSessions(userId, options = {}) {
        const cacheKey = `sessions:${userId}`;
        
        const cached = this.getCached(cacheKey);
        if (cached && !options.forceRefresh) {
            logger.debug(`Returning cached session recommendations for ${userId}`);
            return cached;
        }

        try {
            const params = {
                user_id: userId,
                top_k: options.limit || 10,
                ensemble_method: options.method || 'weighted'
            };

            const recommendations = await this.callPythonScript('recommend_sessions', params);
            
            this.setCached(cacheKey, recommendations);
            
            logger.info(`Generated ${recommendations.length} session recommendations for user ${userId}`);
            return recommendations;
        } catch (error) {
            logger.error('Error generating session recommendations:', error);
            throw error;
        }
    }

    /**
     * Get group recommendations for a user
     */
    async recommendGroups(userId, options = {}) {
        const cacheKey = `groups:${userId}`;
        
        const cached = this.getCached(cacheKey);
        if (cached && !options.forceRefresh) {
            logger.debug(`Returning cached group recommendations for ${userId}`);
            return cached;
        }

        try {
            const params = {
                user_id: userId,
                top_k: options.limit || 10,
                ensemble_method: options.method || 'weighted'
            };

            const recommendations = await this.callPythonScript('recommend_groups', params);
            
            this.setCached(cacheKey, recommendations);
            
            logger.info(`Generated ${recommendations.length} group recommendations for user ${userId}`);
            return recommendations;
        } catch (error) {
            logger.error('Error generating group recommendations:', error);
            throw error;
        }
    }

    /**
     * Train/update recommendation models
     */
    async trainModels(modelType = 'all') {
        try {
            logger.info(`Training ${modelType} models...`);
            
            const params = {
                model_type: modelType,
                epochs: 50
            };

            const result = await this.callPythonScript('train_models', params);
            
            // Clear cache after training
            this.clearCache();
            
            logger.info('Model training completed');
            return result;
        } catch (error) {
            logger.error('Error training models:', error);
            throw error;
        }
    }

    /**
     * Get recommendation system status
     */
    async getStatus() {
        try {
            const status = await this.callPythonScript('status', {});
            return status;
        } catch (error) {
            logger.error('Error getting status:', error);
            return {
                initialized: false,
                models: {
                    content: false,
                    collaborative: false,
                    gnn: false
                }
            };
        }
    }

    /**
     * Call Python recommendation script
     */
    callPythonScript(action, params) {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn(this.pythonCommand, [
                this.pythonScriptPath,
                '--action', action,
                '--params', JSON.stringify(params)
            ]);

            let dataString = '';
            let errorString = '';

            pythonProcess.stdout.on('data', (data) => {
                dataString += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorString += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python process exited with code ${code}: ${errorString}`));
                    return;
                }

                try {
                    const result = JSON.parse(dataString);
                    resolve(result);
                } catch (error) {
                    reject(new Error(`Failed to parse Python output: ${error.message}`));
                }
            });

            pythonProcess.on('error', (error) => {
                reject(new Error(`Failed to start Python process: ${error.message}`));
            });
        });
    }

    /**
     * Cache management
     */
    getCached(key) {
        const cached = this.cachedRecommendations.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > this.cacheExpiry) {
            this.cachedRecommendations.delete(key);
            return null;
        }

        return cached.data;
    }

    setCached(key, data) {
        this.cachedRecommendations.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cachedRecommendations.clear();
        logger.info('Recommendation cache cleared');
    }
}

module.exports = new RecommendationService();
