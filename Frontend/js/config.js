// API Configuration
// This file centralizes all API endpoint configurations

const CONFIG = {
    // Automatically detect environment
    API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000/api'  // Development
        : 'https://fsd-ml-4knj.onrender.com/api',  // Production
    
    WS_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'ws://localhost:5000'  // Development
        : 'wss://fsd-ml-4knj.onrender.com',  // Production
    
    // Timeout settings
    REQUEST_TIMEOUT: 30000, // 30 seconds
    
    // File upload limits
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
};

// Helper function to make API calls
const apiCall = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token') || localStorage.getItem('mentorToken');
    
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
    
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, apiCall };
}
